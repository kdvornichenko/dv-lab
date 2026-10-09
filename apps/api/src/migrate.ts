import { resolveDatabaseUrl, runMigrations } from '@dv-lab/db'

import { createLogger } from './request-context.ts'

const logger = createLogger('info')

try {
	const migrations = await runMigrations(resolveDatabaseUrl('migrator', process.env))
	logger.info({ migrations }, 'migrations applied')
} catch (err) {
	logger.error({ err }, 'migrations failed')
	process.exitCode = 1
}
