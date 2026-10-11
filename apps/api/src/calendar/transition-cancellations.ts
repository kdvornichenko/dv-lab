import { and, desc, eq } from 'drizzle-orm'

import { googleCommands, googleCommandStages, type GoogleCutPlan } from '@dv-lab/db'

import { cancellationAcknowledgement } from './command-result.ts'
import type { CommandAccess } from './dispatch.ts'
import type { GoogleGateway } from './gateway.ts'
import { CommandFault } from './journal.ts'

export async function cancelledTailHistory(
	access: CommandAccess,
	seriesId: string,
	originalOn: string,
	eventId: string,
	gateway: GoogleGateway
): Promise<GoogleCutPlan['cancelledTail'][number]> {
	const commands = await access.db
		.select()
		.from(googleCommands)
		.where(
			and(
				eq(googleCommands.accountId, access.connection.accountId),
				eq(googleCommands.connectionId, access.connection.id),
				eq(googleCommands.calendarId, access.connection.calendarId!),
				eq(googleCommands.state, 'applied')
			)
		)
		.orderBy(desc(googleCommands.appliedAt))
	const command = commands.find(
		(row) =>
			'seriesId' in row.plan.input &&
			row.plan.input.seriesId === seriesId &&
			'originalOn' in row.plan.input &&
			row.plan.input.originalOn === originalOn
	)
	if (!command || command.operation !== 'cancel') throw new CommandFault('external_change')
	const stages = await access.db
		.select()
		.from(googleCommandStages)
		.where(and(eq(googleCommandStages.commandId, command.id), eq(googleCommandStages.state, 'acknowledged')))
		.orderBy(desc(googleCommandStages.stage))
	for (const stage of stages) {
		const ack = cancellationAcknowledgement(stage.acknowledgement, eventId)
		if (!ack) continue
		const current = await gateway.cancelledInstance(access.accessToken, command.calendarId, eventId, access.signal)
		const baselineEvent = ack.kind === 'cancellation' ? ack.baselineEvent : ack.event
		if (!baselineEvent) throw new CommandFault('external_change')
		const original = baselineEvent.originalStartTime
		if (
			current.id !== eventId ||
			current.recurringEventId !== baselineEvent.recurringEventId ||
			!original ||
			!('dateTime' in original) ||
			Date.parse(current.originalStartTime.dateTime) !== Date.parse(original.dateTime)
		)
			throw new CommandFault('external_change')
		return {
			originalOn,
			stageId: stage.id,
			current,
			baselineEvent,
			unownedWritableFingerprint: ack.unownedWritableFingerprint,
			unownedWritable: ack.unownedWritable ?? null,
		}
	}
	throw new CommandFault('external_change')
}
