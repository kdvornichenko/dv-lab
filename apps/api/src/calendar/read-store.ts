import { and, eq, sql } from 'drizzle-orm'

import { googleConnections, googleSyncState, type DbExecutor } from '@dv-lab/db'

export async function advanceCommandRevision(
	tx: DbExecutor,
	accountId: string,
	connectionId: string,
	generation: number
) {
	const [connection] = await tx
		.select({ id: googleConnections.id })
		.from(googleConnections)
		.where(
			and(
				eq(googleConnections.id, connectionId),
				eq(googleConnections.accountId, accountId),
				eq(googleConnections.generation, generation),
				eq(googleConnections.state, 'connected')
			)
		)
		.for('update')
	if (!connection) throw new Error('Calendar projection generation changed')
	const [sync] = await tx
		.update(googleSyncState)
		.set({ requestedSeq: sql`${googleSyncState.requestedSeq} + 1`, updatedAt: sql`now()` })
		.where(and(eq(googleSyncState.connectionId, connectionId), eq(googleSyncState.accountId, accountId)))
		.returning({ revision: googleSyncState.revision })
	return sync?.revision ?? 0n
}
