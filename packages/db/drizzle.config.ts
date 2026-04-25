import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

import { postgresConnectionOptions } from './src/connection-url'

config({ path: '../../.env.local' })

function dbCredentials() {
	const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? ''
	if (!url) return { url }

	const options = postgresConnectionOptions(url)
	return options.ssl === undefined
		? { url: options.connectionString }
		: { url: options.connectionString, ssl: options.ssl }
}

export default defineConfig({
	schema: './src/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: dbCredentials(),
})
