import { and, eq, inArray, or } from 'drizzle-orm'

import { googleEventMappings, googleReadEvents, type DbExecutor } from '@dv-lab/db'

import type { CommandRow } from './journal.ts'

export async function publishTransition(tx: DbExecutor, command: CommandRow) {
	const ids = command.plan.affectedRefs.map((ref) => (ref.kind === 'single' ? ref.lessonId : ref.seriesId))
	if (!ids.length) return
	const mappings = await tx
		.select({ eventId: googleEventMappings.eventId })
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, command.accountId),
				eq(googleEventMappings.connectionId, command.connectionId),
				inArray(googleEventMappings.localEntityId, ids)
			)
		)
	if (!mappings.length) return
	await tx
		.update(googleReadEvents)
		.set({ bindingKind: 'transition', commandId: command.id })
		.where(
			and(
				eq(googleReadEvents.accountId, command.accountId),
				eq(googleReadEvents.connectionId, command.connectionId),
				inArray(
					googleReadEvents.eventId,
					mappings.map((item) => item.eventId)
				)
			)
		)
}
