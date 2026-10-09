import type { Logger } from 'pino'

import type { Database } from '@dv-lab/db'

import { pruneExpiredSessions } from './sessions.ts'
import { pruneSignInThrottles } from './throttle.ts'

export type Housekeeping = {
	name: string
	start: () => void
	runOnce: () => Promise<void>
	close: () => Promise<void>
}

type HousekeepingOptions = { db: Database; logger: Logger; intervalMs?: number }

export function createHousekeeping({ db, logger, intervalMs = 900_000 }: HousekeepingOptions): Housekeeping {
	let timer: ReturnType<typeof setInterval> | undefined
	let current: Promise<void> | undefined
	let closed = false

	async function prune(): Promise<void> {
		try {
			await pruneSignInThrottles(db)
			await pruneExpiredSessions(db)
		} catch (err) {
			logger.warn({ err }, 'housekeeping failed')
		}
	}

	function runOnce(): Promise<void> {
		current ??= prune().finally(() => {
			current = undefined
		})
		return current
	}

	return {
		name: 'housekeeping',
		start() {
			if (closed || timer) return
			timer = setInterval(() => void runOnce(), intervalMs)
			timer.unref()
		},
		runOnce,
		async close() {
			closed = true
			if (timer) clearInterval(timer)
			timer = undefined
			await current
		},
	}
}
