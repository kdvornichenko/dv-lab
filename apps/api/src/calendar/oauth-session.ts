import { and, eq, sql } from 'drizzle-orm'

import { accounts, sessions, type DbExecutor } from '@dv-lab/db'

import { hashSessionToken } from '../auth/sessions.ts'
import { CalendarFault } from './gateway.ts'

export type ConsentActor = { accountId: string; sessionToken: string }

export async function requireConsentSession(db: DbExecutor, actor: ConsentActor) {
	const tokenHash = hashSessionToken(actor.sessionToken)
	const [session] = await db
		.select({ epoch: sessions.authEpoch })
		.from(sessions)
		.innerJoin(accounts, eq(accounts.id, sessions.accountId))
		.where(
			and(
				eq(sessions.tokenHash, tokenHash),
				eq(accounts.id, actor.accountId),
				eq(accounts.authEpoch, sessions.authEpoch),
				eq(accounts.status, 'active'),
				eq(accounts.role, 'teacher'),
				sql`${sessions.expiresAt} > now()`
			)
		)
		.for('share')
		.limit(1)
	if (!session) throw new CalendarFault('invalid_state')
	return { tokenHash, epoch: session.epoch }
}
