import type { ConnectionOptions } from 'tls'

export type PostgresConnectionOptions = {
	connectionString: string
	ssl?: boolean | ConnectionOptions
}

export function postgresSslForConnectionString(connectionString: string): boolean | ConnectionOptions | undefined {
	const parsed = new URL(connectionString)
	const sslMode = parsed.searchParams.get('sslmode')

	if (!sslMode) return undefined
	if (sslMode === 'disable') return false
	if (sslMode === 'verify-full') return true

	return { rejectUnauthorized: false }
}

export function connectionStringWithoutHandledSslMode(connectionString: string): string {
	const parsed = new URL(connectionString)
	const sslMode = parsed.searchParams.get('sslmode')

	if (!sslMode || sslMode === 'verify-full') return connectionString

	parsed.searchParams.delete('sslmode')
	return parsed.toString()
}

export function postgresConnectionOptions(connectionString: string): PostgresConnectionOptions {
	const ssl = postgresSslForConnectionString(connectionString)
	const normalizedConnectionString = connectionStringWithoutHandledSslMode(connectionString)

	return ssl === undefined
		? { connectionString: normalizedConnectionString }
		: { connectionString: normalizedConnectionString, ssl }
}
