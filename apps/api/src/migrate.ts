import { Client } from 'pg'

import { resolveDatabaseUrl, runMigrations } from '@dv-lab/db'

import { prepareCalendarQueue } from './calendar/queue-schema.ts'
import { createLogger } from './request-context.ts'

const logger = createLogger('info')

const migrateLockKey = 7240512

let lock: Client | undefined

try {
	const migratorUrl = resolveDatabaseUrl('migrator', process.env)
	lock = new Client({ connectionString: migratorUrl })
	await lock.connect()
	await lock.query('SELECT pg_advisory_lock($1)', [migrateLockKey])
	const migrations = await runMigrations(migratorUrl)
	await prepareCalendarQueue(migratorUrl)
	logger.info({ migrations }, 'migrations applied')
} catch (err) {
	logger.error({ err }, 'migrations failed')
	process.exitCode = 1
} finally {
	await lock?.end().catch(() => undefined)
}
