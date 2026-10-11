import { eq } from 'drizzle-orm'

import type { CalendarCommandReceipt, CalendarCommandSnapshot, ValidatedCalendarCommand } from '@dv-lab/contracts'
import { googleReadEvents, type Database } from '@dv-lab/db'

import { commandWindow, prepareScheduleCommand } from '../schedule/command-plan.ts'
import type { Credentials } from './credentials.ts'
import { CalendarFault, type GoogleGateway } from './gateway.ts'
import { observeInstance } from './instance-observation.ts'
import {
	CommandFault,
	commandSnapshot,
	findRequest,
	matchingReceipt,
	persistCommand,
	readCommand,
	receipt,
	unresolvedCommands,
} from './journal.ts'
import type { ProviderEvent } from './provider-events.ts'
import { traverseEvents } from './read-pages.ts'
import type { CalendarReadContext } from './reads.ts'
import { observeSeries, seriesBinding } from './series-observation.ts'
import { observeSingle } from './single-observation.ts'

export function createCalendarCommands(deps: {
	db: Database
	credentials: Credentials
	gateway: GoogleGateway
	wake: (commandId: string) => Promise<void>
	resume: (accountId: string, commandId: string) => Promise<void>
}) {
	async function submitCalendarCommand(
		context: CalendarReadContext,
		input: ValidatedCalendarCommand
	): Promise<CalendarCommandReceipt> {
		const existing = await findRequest(deps.db, context.accountId, input.input.requestId)
		if (existing) return matchingReceipt(existing, input)
		if (input.operation === 'move_series' || input.operation === 'end_series')
			await seriesBinding(deps.db, context.accountId, input.seriesId)
		const deadline = context.now.getTime() + 30000
		if (Date.now() >= deadline) throw new CommandFault('not_applied')
		const budget = AbortSignal.timeout(Math.max(0, deadline - Date.now()))
		const outcome = await deps.credentials
			.withAccessToken(
				context.accountId,
				async (access) => {
					try {
						const repeated = await findRequest(access.db, context.accountId, input.input.requestId)
						if (repeated) return matchingReceipt(repeated, input)
						if ((await unresolvedCommands(access.db, context.accountId)).length)
							throw new CommandFault('command_pending')
						if (input.operation !== 'create') return await admitChange(access, context, input)
						const window = await commandWindow(access.db, context.accountId, input.input.expectedVersion)
						if (
							window.snapshotRevision !== access.connection.snapshotRevision ||
							window.generation !== access.connection.generation
						)
							throw new CommandFault('precondition_failed')
						if (!access.connection.calendarId) throw new CalendarFault('connection_required')
						const primary = await deps.gateway.primary(access.accessToken, access.signal)
						if (primary.id !== access.connection.calendarId) throw new CommandFault('external_change')
						const previous = await access.db
							.select()
							.from(googleReadEvents)
							.where(eq(googleReadEvents.windowId, window.id))
						const current: ProviderEvent[] = []
						await traverseEvents(
							{ ...access, gateway: deps.gateway, calendarId: primary.id },
							{
								timeMin: window.windowStart.toISOString(),
								timeMax: window.windowEnd.toISOString(),
							},
							(events) => {
								current.push(...events)
								return false
							}
						)
						const before = new Map(previous.map((event) => [event.eventId, event.etag]))
						if (before.size !== current.length || current.some((event) => before.get(event.eventId) !== event.etag))
							throw new CommandFault('external_change')
						access.signal.throwIfAborted()
						return await access.db.transaction(async (tx) => {
							const prepared = await prepareScheduleCommand(tx, input, context)
							if (prepared.generation !== access.connection.generation) throw new CommandFault('precondition_failed')
							access.signal.throwIfAborted()
							if (Date.now() >= prepared.dispatchDeadline.getTime()) throw new CommandFault('not_applied')
							await persistCommand(tx, prepared)
							access.signal.throwIfAborted()
							return receipt(prepared)
						})
					} catch (error) {
						if (Date.now() >= deadline || budget.aborted) return new CommandFault('not_applied')
						if (error instanceof CommandFault) return error
						throw error
					}
				},
				budget
			)
			.catch((error: unknown) => {
				if (Date.now() >= deadline || budget.aborted) throw new CommandFault('not_applied')
				throw error
			})
		if (outcome instanceof CommandFault) throw outcome
		await deps.wake(outcome.commandId).catch(() => undefined)
		return outcome
	}
	async function admitChange(
		access: Parameters<Parameters<Credentials['withAccessToken']>[1]>[0],
		context: CalendarReadContext,
		input: Exclude<ValidatedCalendarCommand, { operation: 'create' }>
	) {
		const observed =
			input.operation === 'move_series' || input.operation === 'end_series'
				? await observeSeries(access, input, context.now, deps.gateway)
				: input.ref.kind === 'series'
					? await observeInstance(access, input, deps.gateway)
					: await observeSingle(access, input, deps.gateway)
		return access.db.transaction(async (tx) => {
			access.signal.throwIfAborted()
			const prepared = await prepareScheduleCommand(tx, input, context, observed)
			if (prepared.generation !== access.connection.generation) throw new CommandFault('precondition_failed')
			access.signal.throwIfAborted()
			if (Date.now() >= prepared.dispatchDeadline.getTime()) throw new CommandFault('not_applied')
			await persistCommand(tx, prepared)
			access.signal.throwIfAborted()
			return receipt(prepared)
		})
	}
	return {
		submitCalendarCommand,
		async readCalendarCommand(context: CalendarReadContext, commandId: string): Promise<CalendarCommandSnapshot> {
			return commandSnapshot(await readCommand(deps.db, context.accountId, commandId))
		},
		async resumeCalendarCommand(context: CalendarReadContext, commandId: string): Promise<CalendarCommandReceipt> {
			const command = await readCommand(deps.db, context.accountId, commandId)
			if (!['partial_recovery', 'recovery_required'].includes(command.state))
				throw new CommandFault('precondition_failed')
			await deps.resume(context.accountId, commandId)
			return receipt(command)
		},
	}
}

export type CalendarCommands = ReturnType<typeof createCalendarCommands>
