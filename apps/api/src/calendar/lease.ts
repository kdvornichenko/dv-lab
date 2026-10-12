import { drizzle } from 'drizzle-orm/node-postgres'
import { setTimeout as delay } from 'node:timers/promises'
import type { Pool } from 'pg'

import type { Database } from '@dv-lab/db'

import { CalendarFault } from './gateway.ts'

export type ConnectionLeaseContext = { db: Database; signal: AbortSignal }

const LOCK_WAIT_MS = 5000
const LOCK_RETRY_MS = 100

export function createConnectionLease(pool: Pool) {
	let stopping = false
	const controllers = new Set<AbortController>()
	const pending = new Set<Promise<void>>()

	async function acquire<T>(accountId: string, operation: (context: ConnectionLeaseContext) => Promise<T>): Promise<T> {
		if (stopping) throw new CalendarFault('provider_unavailable')
		const client = await pool.connect()
		const controller = new AbortController()
		const failed = () => controller.abort()
		client.on('error', failed)
		controllers.add(controller)
		let locked = false
		let broken = false
		try {
			const deadline = Date.now() + LOCK_WAIT_MS
			for (;;) {
				if (stopping) throw new CalendarFault('provider_unavailable')
				const result = await client.query<{ locked: boolean }>(
					'select pg_try_advisory_lock(hashtextextended($1, 24)) as locked',
					[accountId]
				)
				locked = result.rows[0]?.locked === true
				if (locked || Date.now() >= deadline) break
				await delay(LOCK_RETRY_MS, undefined, { signal: controller.signal })
			}
			if (!locked) throw new CalendarFault('command_pending')
			return await operation({ db: drizzle({ client }), signal: controller.signal })
		} finally {
			if (locked) {
				try {
					await client.query<{ pg_advisory_unlock: boolean }>('select pg_advisory_unlock(hashtextextended($1, 24))', [
						accountId,
					])
				} catch {
					broken = true
				}
			}
			controllers.delete(controller)
			client.removeListener('error', failed)
			client.release(broken || controller.signal.aborted)
		}
	}

	return {
		run<T>(accountId: string, operation: (context: ConnectionLeaseContext) => Promise<T>): Promise<T> {
			const task = acquire(accountId, operation)
			const settled = task.then(
				() => {},
				() => {}
			)
			pending.add(settled)
			void settled.then(() => pending.delete(settled))
			return task
		},
		name: 'calendar-lease',
		async close() {
			stopping = true
			for (const controller of controllers) controller.abort()
			await Promise.allSettled(pending)
		},
	}
}

export type ConnectionLease = ReturnType<typeof createConnectionLease>
