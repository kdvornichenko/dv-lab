import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import { Pool } from 'pg'

export const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url))

export async function runMigrations(url: string): Promise<number> {
	const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 3000 })
	try {
		const client = await pool.connect()
		try {
			await client.query("select pg_advisory_lock(hashtext('dvlab_migrations'))")
			try {
				await migrate(drizzle({ client }), { migrationsFolder })
				const result = await client.query<{ count: number }>(
					'select count(*)::int as count from drizzle.__drizzle_migrations'
				)
				return result.rows[0].count
			} finally {
				await client.query("select pg_advisory_unlock(hashtext('dvlab_migrations'))")
			}
		} finally {
			client.release()
		}
	} finally {
		await pool.end()
	}
}
