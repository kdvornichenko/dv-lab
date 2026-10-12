import type { z } from 'zod'

import type { CalendarCommandReceipt, CalendarCommandSnapshot, ValidatedCalendarCommand } from '@dv-lab/contracts'
import { googleConflictRequest } from '@dv-lab/contracts'
import { googleConnections, type Database } from '@dv-lab/db'

import { checkCalendarConflicts } from '../schedule/calendar-conflicts.ts'
import { prepareScheduleCommand } from '../schedule/command-plan.ts'
import { CalendarFault, type GoogleGateway } from './gateway.ts'
import { currentConnection, type CalendarAccess, type Credentials } from './google-access.ts'
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
import type { CalendarReadContext } from './read-state.ts'
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
		let outcome: CalendarCommandReceipt
		try {
			const access = await deps.credentials.accessToken(context.accountId, budget)
			outcome = await admit(access, context, input)
		} catch (error) {
			if (Date.now() >= deadline || budget.aborted) throw new CommandFault('not_applied')
			if (error instanceof CommandFault || error instanceof CalendarFault) throw error
			throw new CalendarFault('provider_unavailable')
		}
		await deps.wake(outcome.commandId).catch(() => undefined)
		return outcome
	}
	async function admit(access: CalendarAccess, context: CalendarReadContext, input: ValidatedCalendarCommand) {
		const repeated = await findRequest(access.db, context.accountId, input.input.requestId)
		if (repeated) return matchingReceipt(repeated, input)
		if ((await unresolvedCommands(access.db, context.accountId)).length) throw new CommandFault('command_pending')
		if (input.operation !== 'create') return admitChange(access, context, input)
		if (!access.connection.calendarId) throw new CalendarFault('connection_required')
		return persistAdmission(access, context, input)
	}
	async function admitChange(
		access: CalendarAccess,
		context: CalendarReadContext,
		input: Exclude<ValidatedCalendarCommand, { operation: 'create' }>
	) {
		const observed =
			input.operation === 'move_series' || input.operation === 'end_series'
				? await observeSeries(access, input, context.now, deps.gateway)
				: input.ref.kind === 'series'
					? await observeInstance(access, input, deps.gateway)
					: await observeSingle(access, input, deps.gateway)
		return persistAdmission(access, context, input, observed)
	}
	async function persistAdmission(
		access: CalendarAccess,
		context: CalendarReadContext,
		input: ValidatedCalendarCommand,
		observed?: Parameters<typeof prepareScheduleCommand>[3]
	): Promise<CalendarCommandReceipt> {
		return access.db.transaction(async (tx) => {
			access.signal.throwIfAborted()
			const [connection] = await tx
				.select()
				.from(googleConnections)
				.where(currentConnection(context.accountId))
				.for('update')
			const repeated = await findRequest(tx, context.accountId, input.input.requestId)
			if (repeated) return matchingReceipt(repeated, input)
			if (
				!connection ||
				connection.id !== access.connection.id ||
				connection.state !== 'connected' ||
				connection.generation !== access.connection.generation ||
				connection.calendarId !== access.connection.calendarId
			)
				throw new CommandFault('precondition_failed')
			if ((await unresolvedCommands(tx, context.accountId)).length) throw new CommandFault('command_pending')
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
		checkCalendarConflicts: (context: CalendarReadContext, input: z.infer<typeof googleConflictRequest>) =>
			checkCalendarConflicts(deps, context, input),
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
