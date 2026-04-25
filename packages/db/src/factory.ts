import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import type { ConnectionOptions } from 'tls'

import { postgresConnectionOptions } from './connection-url'
import * as schema from './schema'

export type DB = NodePgDatabase<typeof schema>

export type DbPoolOptions = {
	max?: number
	idleTimeoutMillis?: number
	connectionTimeoutMillis?: number
	ssl?: boolean | ConnectionOptions
}

export function createDb(connectionString: string, poolOptions?: DbPoolOptions): { db: DB; pgPool: Pool } {
	const connectionOptions = postgresConnectionOptions(connectionString)
	const ssl = poolOptions?.ssl ?? connectionOptions.ssl
	const pgPool = new Pool({
		connectionString: connectionOptions.connectionString,
		max: poolOptions?.max ?? 10,
		idleTimeoutMillis: poolOptions?.idleTimeoutMillis ?? 30_000,
		connectionTimeoutMillis: poolOptions?.connectionTimeoutMillis ?? 10_000,
		ssl,
	})

	pgPool.on('error', (error) => {
		console.error('[teacher-crm-db] idle client error', error)
	})

	return {
		db: drizzle(pgPool, { schema }),
		pgPool,
	}
}
