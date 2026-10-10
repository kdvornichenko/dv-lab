import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { z } from 'zod'

export type DbRole = 'app' | 'migrator'

const variables = { app: 'DATABASE_URL', migrator: 'MIGRATOR_DATABASE_URL' } as const

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ })

export function resolveDatabaseUrl(role: DbRole, env: NodeJS.ProcessEnv): string {
	const name = variables[role]
	const parsed = postgresUrl.safeParse(env[name])
	if (!parsed.success) throw new Error(`${name} is missing or is not a postgres URL`)
	const database = new URL(parsed.data).pathname.slice(1)
	if (env.NODE_ENV === 'test' && !database.endsWith('_test')) {
		throw new Error(`${name} must point to a database whose name ends with _test`)
	}
	return parsed.data
}

export function createDb(url: string) {
	const pool = new Pool({ connectionString: url, max: 10, connectionTimeoutMillis: 3000 })
	const db = drizzle({ client: pool })
	return { pool, db }
}

export type Database = ReturnType<typeof createDb>['db']

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export type DbExecutor = Database | Transaction
