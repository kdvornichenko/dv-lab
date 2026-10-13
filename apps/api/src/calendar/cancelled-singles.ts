import { and, desc, eq } from 'drizzle-orm'

import { googleCommands, googleCommandStages, type DbExecutor, type GoogleLocalRef } from '@dv-lab/db'

import { cancellationAcknowledgement } from './command-result.ts'
import type { MappingRow } from './read-state.ts'

export async function appliedCancellation(
	executor: DbExecutor,
	owner: Pick<MappingRow, 'accountId' | 'connectionId'>,
	matches: (ref: GoogleLocalRef) => boolean,
	eventId: string
): Promise<string | undefined> {
	const commands = await executor
		.select()
		.from(googleCommands)
		.where(
			and(
				eq(googleCommands.accountId, owner.accountId),
				eq(googleCommands.connectionId, owner.connectionId),
				eq(googleCommands.state, 'applied')
			)
		)
		.orderBy(desc(googleCommands.appliedAt))
	const latest = commands.find((command) => {
		const input = command.plan.input
		return (
			(input.operation === 'move' || input.operation === 'cancel' || input.operation === 'restore') &&
			matches(input.ref)
		)
	})
	if (latest?.plan.input.operation !== 'cancel') return undefined
	const [stage] = await executor
		.select()
		.from(googleCommandStages)
		.where(
			and(
				eq(googleCommandStages.commandId, latest.id),
				eq(googleCommandStages.kind, 'write'),
				eq(googleCommandStages.state, 'acknowledged')
			)
		)
	return cancellationAcknowledgement(stage?.acknowledgement, eventId)?.unownedWritableFingerprint
}

export function cancelledSingleBaseline(
	executor: DbExecutor,
	mapping: Pick<MappingRow, 'accountId' | 'connectionId'>,
	lessonId: string,
	eventId: string
) {
	return appliedCancellation(executor, mapping, (ref) => ref.kind === 'single' && ref.lessonId === lessonId, eventId)
}
