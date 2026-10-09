import { resolveDatabaseUrl } from '../src/connection.ts'
import { runMigrations } from '../src/migrate.ts'

export default async function setup() {
	await runMigrations(resolveDatabaseUrl('migrator', { ...process.env, NODE_ENV: 'test' }))
}
