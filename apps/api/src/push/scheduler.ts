import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Logger } from 'pino'

import { type ScheduleBlock, type TeacherSettings, lessonLink, studentPaymentsLink } from '@dv-lab/contracts'
import { type BalanceState, balanceState, lessonDay, lessonsPhrase } from '@dv-lab/core'
import {
	type Database,
	type DbExecutor,
	accounts,
	pushDeliveries,
	pushPaymentAlerts,
	pushSubscriptions,
	readSnapshot,
} from '@dv-lab/db'

import { listCards, listLessonStudents } from '../cards/cards.ts'
import { readWindowBlocks } from '../schedule/window-blocks.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import { isPresent } from './presence.ts'
import { type ActiveSubscription, activeSubscriptions } from './subscriptions.ts'

export type PushPayload = { title: string; body: string; tag: string; url: string }

export type PushUrgency = { urgency: 'high' | 'normal'; ttlSeconds: number }

export type PushDeliver = (
	subscription: ActiveSubscription,
	payload: PushPayload,
	urgency?: PushUrgency
) => Promise<void>

export type PushScheduler = {
	name: string
	start: () => void
	runOnce: (at?: Date) => Promise<void>
	close: () => Promise<void>
}

type PushSchedulerOptions = {
	db: Database
	logger: Logger
	deliver: PushDeliver
	intervalMs?: number
	paysEveryMs?: number
}

const MINUTE_MS = 60_000
const LESSON_LOOKAHEAD_MS = 120 * MINUTE_MS
const VIETNAM_ZONES = new Set(['Asia/Ho_Chi_Minh', 'Asia/Saigon'])
const MOSCOW_ZONES = new Set(['Europe/Moscow', 'Europe/Minsk'])

type Delivery = {
	payload: (subscription: ActiveSubscription) => PushPayload
	skip: (subscription: ActiveSubscription) => boolean
	urgency?: PushUrgency
}

function zoneLabel(zone: string, at: Date): string {
	if (VIETNAM_ZONES.has(zone)) return 'VN'
	if (MOSCOW_ZONES.has(zone)) return 'MSK'
	const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'short' })
		.formatToParts(at)
		.find((part) => part.type === 'timeZoneName')?.value
	if (name !== undefined && !name.startsWith('GMT')) return name
	return (zone.split('/').pop() ?? zone).replaceAll('_', ' ')
}

function clock(at: Date, zone: string): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone: zone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(at)
}

function weekday(at: Date, zone: string): string {
	return new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(at)
}

function lessonPayload(block: ScheduleBlock, now: Date, zone: string, secondZone: string | null): PushPayload {
	const startsAt = new Date(block.startsAt)
	const minutes = Math.max(1, Math.round((startsAt.getTime() - now.getTime()) / MINUTE_MS))
	const main = `${weekday(startsAt, zone)}, ${clock(startsAt, zone)} ${zoneLabel(zone, startsAt)}`
	const second =
		secondZone === null || zoneLabel(secondZone, startsAt) === zoneLabel(zone, startsAt)
			? ''
			: ` · ${clock(startsAt, secondZone)} ${zoneLabel(secondZone, startsAt)}`
	return {
		title: `Lesson with ${block.studentName} in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
		body: `${main}${second}`,
		tag: `lesson:${block.key}`,
		url: lessonLink(lessonDay(startsAt, zone), block.ref),
	}
}

async function claim(
	executor: DbExecutor,
	accountId: string,
	kind: 'lesson_soon' | 'pays_soon',
	key: string
): Promise<boolean> {
	const rows = await executor
		.insert(pushDeliveries)
		.values({ accountId, kind, key })
		.onConflictDoNothing()
		.returning({ id: pushDeliveries.id })
	return rows.length > 0
}

async function subscribedTeachers(db: Database): Promise<string[]> {
	const rows = await db
		.selectDistinct({ accountId: pushSubscriptions.accountId })
		.from(pushSubscriptions)
		.innerJoin(accounts, eq(accounts.id, pushSubscriptions.accountId))
		.where(and(isNull(pushSubscriptions.revokedAt), eq(accounts.role, 'teacher'), eq(accounts.status, 'active')))
	return rows.map((row) => row.accountId)
}

export function dueLessons(blocks: readonly ScheduleBlock[], now: Date, minutesBefore: number): ScheduleBlock[] {
	const at = now.getTime()
	return blocks.filter((block) => {
		const startsAt = Date.parse(block.startsAt)
		return (
			block.outcome === 'planned' &&
			block.studentStatus === 'active' &&
			startsAt > at &&
			startsAt - minutesBefore * MINUTE_MS <= at
		)
	})
}

export function createPushScheduler({
	db,
	logger,
	deliver,
	intervalMs = MINUTE_MS,
	paysEveryMs = 5 * MINUTE_MS,
}: PushSchedulerOptions): PushScheduler {
	let timer: ReturnType<typeof setInterval> | undefined
	let current: Promise<void> | undefined
	let closed = false
	let lastPaysAt: number | undefined

	async function send(subscriptions: readonly ActiveSubscription[], delivery: Delivery): Promise<number> {
		let sent = 0
		for (const subscription of subscriptions) {
			if (delivery.skip(subscription)) continue
			try {
				await deliver(subscription, delivery.payload(subscription), delivery.urgency)
				sent += 1
			} catch {
				logger.warn({ subscriptionId: subscription.id }, 'push delivery threw')
			}
		}
		return sent
	}

	async function lessonPass(
		accountId: string,
		settings: TeacherSettings,
		subscriptions: readonly ActiveSubscription[],
		now: Date
	): Promise<number> {
		if (!settings.notifyLessonSoon) return 0
		const context = { accountId, now, defaultTimeZone: settings.defaultTimeZone }
		const blocks = await readSnapshot(db, async (executor) => {
			const studentIds = (await listLessonStudents(executor)).map((student) => student.id)
			if (studentIds.length === 0) return []
			const range = { from: now, to: new Date(now.getTime() + LESSON_LOOKAHEAD_MS), studentIds }
			return (await readWindowBlocks(executor, context, range)).blocks
		})
		let sent = 0
		for (const block of dueLessons(blocks, now, settings.notifyLessonMinutes)) {
			if (!(await claim(db, accountId, 'lesson_soon', `${block.key}@${block.startsAt}`))) continue
			const untilStart = Math.floor((Date.parse(block.startsAt) - now.getTime()) / 1000)
			sent += await send(subscriptions, {
				urgency: { urgency: 'high', ttlSeconds: Math.max(60, untilStart) },
				payload: (subscription) => lessonPayload(block, now, settings.defaultTimeZone, subscription.secondTimeZone),
				skip: (subscription) => isPresent(subscription.endpoint, 'schedule', null, now),
			})
		}
		return sent
	}

	async function advanceAlert(
		accountId: string,
		studentId: string,
		state: Exclude<BalanceState, 'not_set'>,
		notify: boolean,
		now: Date
	): Promise<boolean> {
		return db.transaction(async (tx) => {
			const [row] = await tx
				.select({ armed: pushPaymentAlerts.armed, lastState: pushPaymentAlerts.lastState })
				.from(pushPaymentAlerts)
				.where(and(eq(pushPaymentAlerts.accountId, accountId), eq(pushPaymentAlerts.studentId, studentId)))
				.for('update')
			if (!row) {
				await tx
					.insert(pushPaymentAlerts)
					.values({ accountId, studentId, armed: state === 'plenty', lastState: state })
					.onConflictDoNothing()
				return false
			}
			const armed = state === 'plenty'
			const reached = row.armed && state === 'pays_soon'
			if (armed !== row.armed || state !== row.lastState)
				await tx
					.update(pushPaymentAlerts)
					.set({ armed, lastState: state, updatedAt: sql`now()` })
					.where(and(eq(pushPaymentAlerts.accountId, accountId), eq(pushPaymentAlerts.studentId, studentId)))
			if (!reached || !notify) return false
			return claim(tx, accountId, 'pays_soon', `${studentId}:${now.toISOString()}`)
		})
	}

	async function paysPass(
		accountId: string,
		settings: TeacherSettings,
		subscriptions: readonly ActiveSubscription[],
		now: Date
	): Promise<number> {
		const context = { accountId, now, defaultTimeZone: settings.defaultTimeZone }
		const cards = await readSnapshot(db, async (executor) => (await listCards(executor, context)).students)
		let sent = 0
		for (const card of cards) {
			if (card.status !== 'active') continue
			const state = balanceState(card.balanceMinutes, card.defaultLessonMinutes, settings.paysSoonLessons)
			if (state === 'not_set' || card.balanceMinutes === null) continue
			if (!(await advanceAlert(accountId, card.id, state, settings.notifyPaysSoon, now))) continue
			const payload: PushPayload = {
				title: `${card.displayName} has ${lessonsPhrase(card.balanceMinutes, card.defaultLessonMinutes)} left`,
				body: 'Pays soon. Open payments to record a payment.',
				tag: `pays:${card.id}`,
				url: studentPaymentsLink(card.id),
			}
			sent += await send(subscriptions, {
				payload: () => payload,
				skip: (subscription) => isPresent(subscription.endpoint, 'payments', card.id, now),
			})
		}
		return sent
	}

	async function pass(now: Date): Promise<void> {
		let accountIds: string[]
		try {
			accountIds = await subscribedTeachers(db)
		} catch (err) {
			logger.warn({ err }, 'push scheduler failed')
			return
		}
		const paysDue = lastPaysAt === undefined || now.getTime() < lastPaysAt || now.getTime() - lastPaysAt >= paysEveryMs
		if (paysDue) lastPaysAt = now.getTime()
		for (const accountId of accountIds) {
			try {
				const { settings, subscriptions } = await readSnapshot(db, async (executor) => ({
					settings: await readTeacherSettings(executor, accountId),
					subscriptions: await activeSubscriptions(executor, accountId),
				}))
				if (subscriptions.length === 0) continue
				const lessons = await lessonPass(accountId, settings, subscriptions, now)
				const pays = paysDue ? await paysPass(accountId, settings, subscriptions, now) : 0
				if (lessons + pays > 0) logger.info({ accountId, lessons, pays }, 'push notifications sent')
			} catch (err) {
				logger.warn({ err, accountId }, 'push scheduler pass failed')
			}
		}
	}

	function runOnce(at?: Date): Promise<void> {
		current ??= pass(at ?? new Date()).finally(() => {
			current = undefined
		})
		return current
	}

	return {
		name: 'push-scheduler',
		start() {
			if (closed || timer) return
			timer = setInterval(() => void runOnce(), intervalMs)
			timer.unref()
			logger.info('push scheduler started')
		},
		runOnce,
		async close() {
			closed = true
			if (timer) clearInterval(timer)
			timer = undefined
			await current
		},
	}
}
