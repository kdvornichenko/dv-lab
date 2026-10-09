import { sql } from 'drizzle-orm'
import { createHash, randomBytes } from 'node:crypto'

import { SESSION_TTL_SECONDS } from '@dv-lab/contracts'
import { type Database, sessions } from '@dv-lab/db'

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export type DbExecutor = Database | Transaction

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
