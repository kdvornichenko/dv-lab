import { and, eq, sql } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'

import {
	type AccountSummary,
	SESSION_RENEW_BELOW_SECONDS,
	SESSION_TOKEN_PATTERN,
	SESSION_TTL_SECONDS,
} from '@dv-lab/contracts'
import { type DbExecutor, accounts, sessions } from '@dv-lab/db'

import { accountSummaryColumns, toAccountSummary } from './account-rows.ts'

export type SessionView = { account: AccountSummary; renewDue: boolean }

function isSessionToken(token: string | null | undefined): token is string {
	return typeof token === 'string' && SESSION_TOKEN_PATTERN.test(token)
}

export function hashSessionToken(token: string): string {
	return createHash('sha256').update(token).digest('hex')
}

export async function issueSession(
	executor: DbExecutor,
	{ accountId, authEpoch }: { accountId: string; authEpoch: number }
): Promise<string> {
	const token = randomBytes(32).toString('base64url')
	await executor.insert(sessions).values({
		tokenHash: hashSessionToken(token),
		accountId,
		authEpoch,
		expiresAt: sql`now() + make_interval(secs => ${SESSION_TTL_SECONDS})`,
	})
	return token
}

export async function readSession(db: DbExecutor, token: string | null | undefined): Promise<SessionView | null> {
	if (!isSessionToken(token)) return null
	const [row] = await db
		.select({
			...accountSummaryColumns,
			renewDue: sql<boolean>`${sessions.expiresAt} < now() + make_interval(secs => ${SESSION_RENEW_BELOW_SECONDS})`,
		})
		.from(sessions)
		.innerJoin(accounts, eq(accounts.id, sessions.accountId))
		.where(
			and(
				eq(sessions.tokenHash, hashSessionToken(token)),
				sql`${sessions.expiresAt} > now()`,
				eq(accounts.status, 'active'),
				eq(accounts.authEpoch, sessions.authEpoch)
			)
		)
		.limit(1)
	if (!row) return null
	return { account: toAccountSummary(row), renewDue: row.renewDue }
}

export async function renewSession(db: DbExecutor, token: string | null | undefined): Promise<boolean> {
	if (!isSessionToken(token)) return false
	const renewed = await db
		.update(sessions)
		.set({ expiresAt: sql`now() + make_interval(secs => ${SESSION_TTL_SECONDS})` })
		.where(and(eq(sessions.tokenHash, hashSessionToken(token)), sql`${sessions.expiresAt} > now()`))
		.returning({ tokenHash: sessions.tokenHash })
	return renewed.length > 0
}

export async function deleteSession(db: DbExecutor, token: string | null | undefined): Promise<void> {
	if (!isSessionToken(token)) return
	await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)))
}

export async function revokeAccountSessions(executor: DbExecutor, accountId: string): Promise<number> {
	const [account] = await executor
		.update(accounts)
		.set({ authEpoch: sql`${accounts.authEpoch} + 1`, updatedAt: sql`now()` })
		.where(eq(accounts.id, accountId))
		.returning({ authEpoch: accounts.authEpoch })
	if (!account) throw new Error('account not found')
	await executor.delete(sessions).where(eq(sessions.accountId, accountId))
	return account.authEpoch
}

export async function pruneExpiredSessions(db: DbExecutor): Promise<void> {
	await db.delete(sessions).where(sql`${sessions.expiresAt} <= now()`)
}
