import { Client } from 'pg'
import { PgBoss, type ConstructorOptions } from 'pg-boss'

export const calendarCommandQueue = 'calendar-command'

export const calendarQueueOptions = {
	schema: 'google_calendar_queue',
	migrate: false,
	createSchema: false,
	reindex: false,
	supervise: true,
	schedule: false,
	persistQueueStats: false,
} satisfies ConstructorOptions

export async function prepareCalendarQueue(migratorUrl: string): Promise<void> {
	const client = new Client({ connectionString: migratorUrl, connectionTimeoutMillis: 3000 })
	const boss = new PgBoss({ ...calendarQueueOptions, connectionString: migratorUrl, migrate: true })
	let failed = false
	boss.on('error', () => {
		failed = true
	})
	try {
		await client.connect()
		const role = await client.query<{ allowed: boolean }>("SELECT current_user = 'dvlab_migrator' AS allowed")
		if (!role.rows[0]?.allowed) throw new Error('Calendar queue bootstrap requires the migration role')
		await client.query<never>(`
			CREATE SCHEMA IF NOT EXISTS google_calendar_queue AUTHORIZATION dvlab_migrator;
			REVOKE ALL ON SCHEMA google_calendar_queue FROM PUBLIC;
			REVOKE CREATE ON SCHEMA google_calendar_queue FROM dvlab_app;
			GRANT USAGE ON SCHEMA google_calendar_queue TO dvlab_app;
			ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA google_calendar_queue
				GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dvlab_app;
			ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA google_calendar_queue
				GRANT USAGE, SELECT ON SEQUENCES TO dvlab_app;
			ALTER DEFAULT PRIVILEGES FOR ROLE dvlab_migrator IN SCHEMA google_calendar_queue
				GRANT EXECUTE ON FUNCTIONS TO dvlab_app;
		`)
		await boss.start()
		await boss.createQueue(calendarCommandQueue, { policy: 'singleton' })
		const queue = await boss.getQueue(calendarCommandQueue)
		if (queue?.policy !== 'singleton') throw new Error('Calendar queue must use the singleton policy')
		await client.query<never>(`
			GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA google_calendar_queue TO dvlab_app;
			GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA google_calendar_queue TO dvlab_app;
			REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA google_calendar_queue FROM PUBLIC;
			GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA google_calendar_queue TO dvlab_app;
		`)
	} finally {
		try {
			await boss.stop()
		} finally {
			await client.end()
		}
	}
	if (failed) throw new Error('Calendar queue bootstrap failed')
}
