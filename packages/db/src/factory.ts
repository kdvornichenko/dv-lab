import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { ConnectionOptions } from 'tls'

import * as schema from './schema'

export type DB = NodePgDatabase<typeof schema>

export type DbPoolOptions = {
	max?: number
	idleTimeoutMillis?: number
	connectionTimeoutMillis?: number
	ssl?: boolean | ConnectionOptions
}

function sslForConnectionString(connectionString: string): boolean | ConnectionOptions | undefined {
	const parsed = new URL(connectionString)
	const sslMode = parsed.searchParams.get('sslmode')

	if (!sslMode) return undefined
	if (sslMode === 'disable') return false
	if (sslMode === 'verify-full') return true

	return { rejectUnauthorized: false }
}

export function createDb(connectionString: string, poolOptions?: DbPoolOptions): { db: DB; pgPool: Pool } {
	const pgPool = new Pool({
		connectionString,
		max: poolOptions?.max ?? 10,
		idleTimeoutMillis: poolOptions?.idleTimeoutMillis ?? 30_000,
		connectionTimeoutMillis: poolOptions?.connectionTimeoutMillis ?? 10_000,
		ssl: poolOptions?.ssl ?? sslForConnectionString(connectionString),
	})

	pgPool.on('error', (error) => {
		console.error('[teacher-crm-db] idle client error', error)
	})

	return {
		db: drizzle(pgPool, { schema }),
		pgPool,
	}
}
