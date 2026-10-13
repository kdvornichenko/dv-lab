import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import type { Logger } from 'pino'
import { z } from 'zod'

import {
	BUDGET_WARNING_PERCENT,
	type BudgetSnapshot,
	type ChatModelPricing,
	type ConversationUsage,
	chatModelPricing,
} from '@dv-lab/contracts'
import { zonedParts } from '@dv-lab/core'
import { type Database, type DbExecutor, chatBudgetPeriods, chatConversations, chatUsageAttempts } from '@dv-lab/db'

import { readAssistantSettings, readTeacherSettings } from '../settings/settings.ts'
import type { ModelChoice } from './model-config.ts'

type ResolvedChoice = Extract<ModelChoice, { kind: 'resolved' }>

type ReserveResult =
	| { ok: true; attemptId: string; periodId: string; reservedNano: bigint }
	| { ok: false; code: 'budget_reached' | 'budget_insufficient' }

const NANO_PER_USD = 1_000_000_000n
const TOKENS_PER_PRICE = 1_000_000n
const USD_TEXT = /^(\d+)(?:\.(\d{1,9}))?$/
const OPEN_STATES = ['reserved', 'dispatched', 'unknown']

const tokenCount = z.number().int().min(0)

const chatUsage = z.strictObject({
	inputTokens: tokenCount,
	outputTokens: tokenCount,
	cacheCreationInputTokens: tokenCount,
	cacheReadInputTokens: tokenCount,
})

type ChatUsage = z.infer<typeof chatUsage>

export function usdToNano(text: string): bigint {
	const match = USD_TEXT.exec(text)
	if (!match?.[1]) throw new Error('Invalid USD amount')
	return BigInt(match[1]) * NANO_PER_USD + BigInt((match[2] ?? '').padEnd(9, '0'))
}

export function nanoToUsd(nano: bigint): string {
	const sign = nano < 0n ? '-' : ''
	const magnitude = nano < 0n ? -nano : nano
	const fraction = (magnitude % NANO_PER_USD).toString().padStart(9, '0').replace(/0+$/, '').padEnd(2, '0')
	return `${sign}${magnitude / NANO_PER_USD}.${fraction}`
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
	return (value + divisor - 1n) / divisor
}

export function reserveNano(choice: ResolvedChoice): bigint {
	const { pricing } = choice.model
	const input = usdToNano(pricing.inputPerMTok)
	const cacheWrite = usdToNano(pricing.cacheWrite5mPerMTok)
	const inputRate = input > cacheWrite ? input : cacheWrite
	return ceilDiv(
		BigInt(choice.maxInputTokens) * inputRate + BigInt(choice.maxOutputTokens) * usdToNano(pricing.outputPerMTok),
		TOKENS_PER_PRICE
	)
}

export function costNano(pricing: ChatModelPricing, usage: ChatUsage): bigint {
	return ceilDiv(
		BigInt(usage.inputTokens) * usdToNano(pricing.inputPerMTok) +
			BigInt(usage.cacheCreationInputTokens) * usdToNano(pricing.cacheWrite5mPerMTok) +
			BigInt(usage.cacheReadInputTokens) * usdToNano(pricing.cacheReadPerMTok) +
			BigInt(usage.outputTokens) * usdToNano(pricing.outputPerMTok),
		TOKENS_PER_PRICE
	)
}

function monthBounds(now: Date, zone: string): { startsOn: string; endsBefore: string } {
	const today = zonedParts(now, zone).date
	const year = Number.parseInt(today.slice(0, 4), 10)
	const month = Number.parseInt(today.slice(5, 7), 10)
	const endsBefore = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
	return { startsOn: `${today.slice(0, 7)}-01`, endsBefore }
}

const bigintParam = (value: bigint) => sql`${value.toString()}::bigint`

export async function reserveAttempt(
	tx: DbExecutor,
	accountId: string,
	conversationId: string,
	choice: ResolvedChoice,
	now = new Date(),
	turnId: string | null = null
): Promise<ReserveResult> {
	const { defaultTimeZone } = await readTeacherSettings(tx, accountId)
	const cap = usdToNano((await readAssistantSettings(tx, accountId)).monthlyCapUsd)
	const bounds = monthBounds(now, defaultTimeZone)
	await tx
		.insert(chatBudgetPeriods)
		.values({ accountId, ...bounds, timeZone: defaultTimeZone })
		.onConflictDoNothing({ target: [chatBudgetPeriods.accountId, chatBudgetPeriods.startsOn] })
	const [period] = await tx
		.select({ id: chatBudgetPeriods.id, spent: chatBudgetPeriods.spentNano, held: chatBudgetPeriods.heldNano })
		.from(chatBudgetPeriods)
		.where(and(eq(chatBudgetPeriods.accountId, accountId), eq(chatBudgetPeriods.startsOn, bounds.startsOn)))
		.for('update')
	if (!period) throw new Error('Budget period missing after insert')
	const reserve = reserveNano(choice)
	const used = period.spent + period.held
	if (used >= cap) return { ok: false, code: 'budget_reached' }
	if (used + reserve > cap) return { ok: false, code: 'budget_insufficient' }
	const [attempt] = await tx
		.insert(chatUsageAttempts)
		.values({
			accountId,
			conversationId,
			periodId: period.id,
			turnId,
			model: choice.model.id,
			effort: choice.effort,
			pricing: choice.model.pricing,
			maxInputTokens: choice.maxInputTokens,
			maxOutputTokens: choice.maxOutputTokens,
			reservedNano: reserve,
			state: 'reserved',
		})
		.returning({ id: chatUsageAttempts.id })
	if (!attempt) throw new Error('Usage attempt insert returned no row')
	await tx
		.update(chatBudgetPeriods)
		.set({ heldNano: sql`${chatBudgetPeriods.heldNano} + ${bigintParam(reserve)}`, updatedAt: sql`now()` })
		.where(eq(chatBudgetPeriods.id, period.id))
	return { ok: true, attemptId: attempt.id, periodId: period.id, reservedNano: reserve }
}

export async function markDispatched(db: Database, attemptId: string): Promise<boolean> {
	const rows = await db
		.update(chatUsageAttempts)
		.set({ state: 'dispatched', updatedAt: sql`now()` })
		.where(and(eq(chatUsageAttempts.id, attemptId), eq(chatUsageAttempts.state, 'reserved')))
		.returning({ id: chatUsageAttempts.id })
	return rows.length === 1
}

async function lockAttempt(tx: DbExecutor, attemptId: string) {
	const [attempt] = await tx.select().from(chatUsageAttempts).where(eq(chatUsageAttempts.id, attemptId)).for('update')
	return attempt ?? null
}

async function moveHeld(tx: DbExecutor, periodId: string, reserved: bigint, cost: bigint) {
	await tx
		.update(chatBudgetPeriods)
		.set({
			heldNano: sql`${chatBudgetPeriods.heldNano} - ${bigintParam(reserved)}`,
			spentNano: sql`${chatBudgetPeriods.spentNano} + ${bigintParam(cost)}`,
			updatedAt: sql`now()`,
		})
		.where(eq(chatBudgetPeriods.id, periodId))
}

export function settleAttempt(
	db: Database,
	logger: Logger,
	attemptId: string,
	usage: ChatUsage
): Promise<{ settled: boolean }> {
	const counted = chatUsage.parse(usage)
	return db.transaction(async (tx) => {
		const attempt = await lockAttempt(tx, attemptId)
		if (!attempt || !OPEN_STATES.includes(attempt.state)) return { settled: false }
		const cost = costNano(chatModelPricing.parse(attempt.pricing), counted)
		await tx
			.update(chatUsageAttempts)
			.set({ state: 'settled', usage: counted, costNano: cost, updatedAt: sql`now()` })
			.where(eq(chatUsageAttempts.id, attemptId))
		await moveHeld(tx, attempt.periodId, attempt.reservedNano, cost)
		if (cost > attempt.reservedNano)
			logger.warn(
				{
					attemptId,
					model: attempt.model,
					reservedNano: attempt.reservedNano.toString(),
					costNano: cost.toString(),
					...counted,
				},
				'chat usage cost above reserve'
			)
		return { settled: true }
	})
}

export async function markUnknown(db: Database, attemptId: string): Promise<boolean> {
	const rows = await db
		.update(chatUsageAttempts)
		.set({ state: 'unknown', updatedAt: sql`now()` })
		.where(and(eq(chatUsageAttempts.id, attemptId), inArray(chatUsageAttempts.state, ['reserved', 'dispatched'])))
		.returning({ id: chatUsageAttempts.id })
	return rows.length === 1
}

export function release(db: Database, attemptId: string): Promise<boolean> {
	return db.transaction(async (tx) => {
		const attempt = await lockAttempt(tx, attemptId)
		if (attempt?.state !== 'reserved') return false
		await tx
			.update(chatUsageAttempts)
			.set({ state: 'released', updatedAt: sql`now()` })
			.where(eq(chatUsageAttempts.id, attemptId))
		await moveHeld(tx, attempt.periodId, attempt.reservedNano, 0n)
		return true
	})
}

export async function readBudgetSnapshot(
	executor: DbExecutor,
	accountId: string,
	now = new Date()
): Promise<{ budget: BudgetSnapshot; periodId: string | null }> {
	const { defaultTimeZone } = await readTeacherSettings(executor, accountId)
	const settings = await readAssistantSettings(executor, accountId)
	const cap = usdToNano(settings.monthlyCapUsd)
	const bounds = monthBounds(now, defaultTimeZone)
	const [period] = await executor
		.select({
			id: chatBudgetPeriods.id,
			spent: chatBudgetPeriods.spentNano,
			held: chatBudgetPeriods.heldNano,
			endsBefore: chatBudgetPeriods.endsBefore,
		})
		.from(chatBudgetPeriods)
		.where(and(eq(chatBudgetPeriods.accountId, accountId), eq(chatBudgetPeriods.startsOn, bounds.startsOn)))
	const spent = period?.spent ?? 0n
	const held = period?.held ?? 0n
	let unknownAttempts = 0
	if (period) {
		const [row] = await executor
			.select({ count: sql<number>`count(*)::int` })
			.from(chatUsageAttempts)
			.where(and(eq(chatUsageAttempts.periodId, period.id), eq(chatUsageAttempts.state, 'unknown')))
		unknownAttempts = row?.count ?? 0
	}
	const used = spent + held
	const state = used >= cap ? 'reached' : used * 100n >= cap * BigInt(BUDGET_WARNING_PERCENT) ? 'warning' : 'ok'
	return {
		budget: {
			capUsd: nanoToUsd(cap),
			spentUsd: nanoToUsd(spent),
			heldUsd: nanoToUsd(held),
			remainingUsd: nanoToUsd(cap > used ? cap - used : 0n),
			unknownAttempts,
			resetOn: period?.endsBefore ?? bounds.endsBefore,
			state,
		},
		periodId: period?.id ?? null,
	}
}

export async function usageByConversation(
	executor: DbExecutor,
	accountId: string,
	periodId: string | null,
	limit: number
): Promise<ConversationUsage[]> {
	if (periodId === null) return []
	const cost = sql`coalesce(sum(case when ${chatUsageAttempts.state} = 'settled' then ${chatUsageAttempts.costNano} else ${chatUsageAttempts.reservedNano} end), 0)`
	const rows = await executor
		.select({
			conversationId: chatUsageAttempts.conversationId,
			title: chatConversations.title,
			cost: sql<string>`${cost}::text`,
			attempts: sql<number>`count(*)::int`,
			models: sql<string[]>`array_agg(distinct ${chatUsageAttempts.model} order by ${chatUsageAttempts.model})`,
		})
		.from(chatUsageAttempts)
		.innerJoin(chatConversations, eq(chatConversations.id, chatUsageAttempts.conversationId))
		.where(
			and(
				eq(chatUsageAttempts.accountId, accountId),
				eq(chatUsageAttempts.periodId, periodId),
				ne(chatUsageAttempts.state, 'released')
			)
		)
		.groupBy(chatUsageAttempts.conversationId, chatConversations.title)
		.orderBy(sql`${cost} desc`, chatUsageAttempts.conversationId)
		.limit(limit)
	return rows.map((row) => ({
		conversationId: row.conversationId,
		title: row.title,
		costUsd: nanoToUsd(BigInt(row.cost)),
		attempts: row.attempts,
		models: row.models,
	}))
}
