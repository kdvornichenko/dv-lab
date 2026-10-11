import { and, eq, notInArray, sql } from 'drizzle-orm'
import { createHash } from 'node:crypto'

import {
	calendarCommandSnapshot,
	validatedCalendarCommand,
	type CalendarCommandReceipt,
	type CalendarCommandSnapshot,
	type ErrorCode,
	type ValidatedCalendarCommand,
} from '@dv-lab/contracts'
import {
	googleCommands,
	googleCommandPlan,
	googleCommandStages,
	googleEventMappings,
	googleStageRequest,
	type Database,
	type DbExecutor,
} from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'

export type CommandRow = typeof googleCommands.$inferSelect
export type StageRow = typeof googleCommandStages.$inferSelect

export async function preparedCommand(executor: DbExecutor, command: CommandRow) {
	const [stage] = await executor
		.select()
		.from(googleCommandStages)
		.where(and(eq(googleCommandStages.commandId, command.id), eq(googleCommandStages.stage, 0)))
	const plan = googleCommandPlan.parse(command.plan)
	const request = googleStageRequest.parse(stage?.request)
	if (
		!stage ||
		!['create', 'move', 'cancel', 'restore'].includes(command.operation) ||
		(request.method !== 'insert' && request.method !== 'patch')
	)
		throw new CommandFault('precondition_failed')
	if (
		command.operation !== 'create' &&
		command.operation !== 'move' &&
		command.operation !== 'cancel' &&
		command.operation !== 'restore'
	)
		throw new CommandFault('precondition_failed')
	const prepared: PreparedCalendarCommand = { ...command, plan, request, operation: command.operation }
	return { prepared, stage }
}

export async function failUnsentCommand(db: Database, commandId: string) {
	await db.transaction(async (tx) => {
		const [command] = await tx.select().from(googleCommands).where(eq(googleCommands.id, commandId)).for('update')
		if (!command || command.state !== 'pending' || command.dispatchedAt) return
		await tx
			.update(googleCommands)
			.set({
				state: 'failed',
				effect: 'none',
				issue: 'not_applied',
				nextAction: 'retry_new_command',
				updatedAt: sql`now()`,
			})
			.where(eq(googleCommands.id, commandId))
		await tx
			.update(googleCommandStages)
			.set({ state: 'failed', effect: 'none', updatedAt: sql`now()` })
			.where(and(eq(googleCommandStages.commandId, commandId), eq(googleCommandStages.state, 'pending')))
		await retireReservations(tx, commandId)
	})
}

export async function retireReservations(tx: DbExecutor, commandId: string) {
	await tx
		.update(googleEventMappings)
		.set({ state: 'retired', retiredAt: sql`now()` })
		.where(and(eq(googleEventMappings.commandId, commandId), eq(googleEventMappings.state, 'reserved')))
}

export class CommandFault extends Error {
	readonly code: ErrorCode
	readonly status: 400 | 404 | 409 | 503
	constructor(code: ErrorCode, status: 400 | 404 | 409 | 503 = 409) {
		super(code)
		this.code = code
		this.status = status
	}
}

export function digest(value: string): string {
	return createHash('sha256').update(value).digest('hex')
}

export function commandHash(input: ValidatedCalendarCommand): string {
	return digest(JSON.stringify(validatedCalendarCommand.parse(input)))
}

export function receipt(command: Pick<CommandRow, 'id'>): CalendarCommandReceipt {
	return { commandId: command.id, statusUrl: `/api/google/commands/${command.id}` }
}

export function commandSnapshot(command: CommandRow): CalendarCommandSnapshot {
	return calendarCommandSnapshot.parse({
		commandId: command.id,
		requestId: command.requestId,
		generation: command.generation,
		expectedVersion: command.expectedVersion,
		operation: command.operation,
		state: command.state,
		effect: command.effect,
		issue: command.issue,
		confirmedRevision: command.confirmedRevision?.toString() ?? null,
		affectedRefs: command.plan.affectedRefs,
		nextAction: command.nextAction,
	})
}

export async function findRequest(executor: DbExecutor, accountId: string, requestId: string) {
	const [command] = await executor
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), eq(googleCommands.requestId, requestId)))
	return command
}

export async function readCommand(executor: DbExecutor, accountId: string, commandId: string) {
	const [command] = await executor
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), eq(googleCommands.id, commandId)))
	if (!command) throw new CommandFault('not_found', 404)
	return command
}

export async function unresolvedCommands(executor: DbExecutor, accountId: string) {
	return executor
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.accountId, accountId), notInArray(googleCommands.state, ['applied', 'failed'])))
		.orderBy(googleCommands.createdAt)
}

export function matchingReceipt(command: CommandRow, input: ValidatedCalendarCommand) {
	if (command.inputHash !== commandHash(input)) throw new CommandFault('precondition_failed')
	return receipt(command)
}

export async function persistCommand(tx: DbExecutor, prepared: PreparedCalendarCommand) {
	const { request, ...command } = prepared
	await tx.insert(googleCommands).values(command)
	await tx.insert(googleCommandStages).values({
		accountId: command.accountId,
		connectionId: command.connectionId,
		commandId: command.id,
		stage: 0,
		generation: command.generation,
		kind: 'write',
		request,
	})
	if (command.plan.input.operation !== 'create') return
	for (const reservation of command.plan.reservations) {
		await tx.insert(googleEventMappings).values({
			accountId: command.accountId,
			connectionId: command.connectionId,
			calendarId: command.calendarId,
			commandId: command.id,
			studentId: command.plan.input.studentId,
			...reservation,
		})
	}
}
