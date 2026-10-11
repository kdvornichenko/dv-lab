import { resolveDatabaseUrl, runMigrations } from '@dv-lab/db'

import { prepareCalendarQueue } from './calendar/queue-schema.ts'
import { createLogger } from './request-context.ts'

const logger = createLogger('info')

try {
	const migratorUrl = resolveDatabaseUrl('migrator', process.env)
	const migrations = await runMigrations(migratorUrl)
	await prepareCalendarQueue(migratorUrl)
	logger.info({ migrations }, 'migrations applied')
} catch (err) {
	logger.error({ err }, 'migrations failed')
	process.exitCode = 1
}
