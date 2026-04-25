import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

export type DB = NodePgDatabase<typeof schema>

export type DbPoolOptions = {
	max?: number
	idleTimeoutMillis?: number
	connectionTimeoutMillis?: number
}

export function createDb(connectionString: string, poolOptions?: DbPoolOptions): { db: DB; pgPool: Pool } {
	const pgPool = new Pool({
		connectionString,
		max: poolOptions?.max ?? 10,
		idleTimeoutMillis: poolOptions?.idleTimeoutMillis ?? 30_000,
		connectionTimeoutMillis: poolOptions?.connectionTimeoutMillis ?? 10_000,
	})

	pgPool.on('error', (error) => {
		console.error('[teacher-crm-db] idle client error', error)
	})

	return {
		db: drizzle(pgPool, { schema }),
		pgPool,
	}
}
