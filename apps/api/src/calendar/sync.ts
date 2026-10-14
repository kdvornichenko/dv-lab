import type { Logger } from 'pino'

import { addDays, zonedInstant, zonedParts } from '@dv-lab/core'
import type { Database } from '@dv-lab/db'

import { applyInbound, type InboundResult } from '../schedule/inbound-apply.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import { SyncTokenGone, type SyncPageQuery } from './gateway-sync.ts'
import { CalendarFault, GoogleWriteFault } from './gateway.ts'
import type { Credentials } from './google-access.ts'
import { syncFacts, type EventFact } from './projection.ts'
import { exclusionFacts } from './recurring.ts'
import { masterFact, type SyncRead, type SyncSource } from './sync-provider.ts'
import {
	applyPass,
	applyReads,
	claim,
	ensureSyncRows,
	inboundWork,
	markInboundApplied,
	masterCandidates,
	recordFailure,
	releaseClaim,
	startFull,
	syncWindow,
	type InboundCursor,
	type PassResult,
	type SyncClaim,
	type SyncIssue,
} from './sync-store.ts'
import type { CalendarWatch } from './watch.ts'

const TICK_MS = 30000
const PASS_BUDGET_MS = 110000
const POLL_MINUTES = { channel: 30, none: 2 }
const NIGHTLY_TIME = '03:00'
const READ_LIMIT = 50
const PAGE_LIMIT = 1000
const INBOUND_PAGE = 200
const NO_INBOUND = {
	applied: 0,
	unchanged: 0,
	skipped_marked: 0,
	skipped_past: 0,
	skipped_pending: 0,
	skipped_locked: 0,
	failed: 0,
}

type InboundCounts = Record<InboundResult | 'failed', number>
type Pages = { facts: EventFact[]; skipped: number; truncated: number; nextSyncToken: string }
type Outcome = { kind: 'full' | 'incremental'; claim: SyncClaim; result: PassResult; masters: number }

export function nextNightly(now: Date, zone: string): Date {
	const date = zonedParts(now, zone).date
	const today = zonedInstant(date, NIGHTLY_TIME, zone)
	return today > now ? today : zonedInstant(addDays(date, 1), NIGHTLY_TIME, zone)
}

function accessIssue(error: unknown): SyncIssue {
	if (error instanceof CalendarFault && (error.code === 'reconnect_required' || error.code === 'permission_required'))
		return error.code
	return 'provider_unavailable'
}

function callIssue(error: unknown): SyncIssue {
	if (error instanceof GoogleWriteFault)
		return error.httpStatus === 403 && !error.rateLimited ? 'permission_required' : 'provider_unavailable'
	if (error instanceof CalendarFault && error.code === 'invalid_provider_data') return 'invalid_provider_data'
	return 'provider_unavailable'
}

export function createCalendarSync(deps: {
	db: Database
	source: SyncSource
	watch: Pick<CalendarWatch, 'maintain'>
	credentials: Pick<Credentials, 'accessToken' | 'evict'>
	logger: Pick<Logger, 'info' | 'warn' | 'debug'>
	isStopping: () => boolean
	now?: () => Date
	hooks?: { afterPassCommit?: (connectionId: string) => void | Promise<void> }
}) {
	const running = new Map<string, Promise<void>>()
	const again = new Set<string>()
	const stopped = new AbortController()
	const now = deps.now ?? (() => new Date())
	let timer: ReturnType<typeof setInterval> | undefined
	let sweep: Promise<void> | undefined
	const active = () => !stopped.signal.aborted && !deps.isStopping()

	async function collect(read: SyncRead, query: SyncPageQuery): Promise<Pages> {
		const facts: EventFact[] = []
		const seen = new Set<string>()
		let skipped = 0
		let truncated = 0
		let pageToken: string | undefined
		for (;;) {
			read.signal.throwIfAborted()
			const page = await deps.source.page(read, query, pageToken)
			facts.push(...page.facts)
			skipped += page.skipped
			truncated += page.truncated
			if (!page.nextPageToken) {
				if (!page.nextSyncToken) throw new CalendarFault('invalid_provider_data')
				return { facts, skipped, truncated, nextSyncToken: page.nextSyncToken }
			}
			if (seen.has(page.nextPageToken) || seen.size >= PAGE_LIMIT) throw new CalendarFault('invalid_provider_data')
			seen.add(page.nextPageToken)
			pageToken = page.nextPageToken
		}
	}

	async function masters(current: SyncClaim, read: SyncRead, facts: readonly EventFact[], notBefore: Date) {
		const families = await masterCandidates(deps.db, current.connectionId, facts, READ_LIMIT)
		const found: EventFact[] = []
		for (const family of families) {
			try {
				const result = await deps.source.master(read, family)
				const fact = result.kind === 'event' ? masterFact(result, read.calendarTimeZone) : null
				if (fact && result.kind === 'event')
					found.push(
						fact,
						...exclusionFacts(fact, result.recurrence, fact.start?.timeZone ?? read.calendarTimeZone, notBefore)
					)
			} catch {
				read.signal.throwIfAborted()
			}
		}
		return found
	}

	async function optional<T>(read: () => Promise<T>): Promise<T | undefined> {
		try {
			return await read()
		} catch {
			return undefined
		}
	}

	async function fullPass(current: SyncClaim, read: SyncRead, tokenGone: boolean): Promise<Outcome | null> {
		const started = await startFull(deps.db, current, { tokenGone })
		if (!started) return null
		const at = now()
		const { defaultTimeZone } = await readTeacherSettings(deps.db, current.accountId)
		const window = syncWindow(at, defaultTimeZone)
		const pages = await collect(read, { timeMin: window.start, timeMax: window.end })
		const palette = await optional(() => deps.source.palette(read.token, read.signal))
		const calendarColor = await optional(() => deps.source.calendarColor(read.token, read.calendarId, read.signal))
		const extra = await masters(started, read, pages.facts, window.start)
		const result = await applyPass(deps.db, started, {
			kind: 'full',
			facts: [...pages.facts, ...extra],
			nextSyncToken: pages.nextSyncToken,
			skipped: pages.skipped,
			truncated: pages.truncated,
			pollMinutes: POLL_MINUTES,
			window,
			nextFullAt: nextNightly(at, defaultTimeZone),
			...(palette?.length ? { palette } : {}),
			...(calendarColor ? { calendarColor } : {}),
		})
		return { kind: 'full', claim: started, result, masters: extra.length }
	}

	async function incrementalPass(current: SyncClaim, read: SyncRead, syncToken: string): Promise<Outcome> {
		const pages = await collect(read, { syncToken })
		const extra = await masters(current, read, pages.facts, current.windowStart)
		const result = await applyPass(deps.db, current, {
			kind: 'incremental',
			facts: [...pages.facts, ...extra],
			nextSyncToken: pages.nextSyncToken,
			skipped: pages.skipped,
			truncated: pages.truncated,
			pollMinutes: POLL_MINUTES,
		})
		return { kind: 'incremental', claim: current, result, masters: extra.length }
	}

	async function pass(current: SyncClaim, read: SyncRead): Promise<Outcome | null> {
		const syncToken = current.syncToken
		if (!syncToken || current.nextFullAt <= now()) return fullPass(current, read, false)
		try {
			return await incrementalPass(current, read, syncToken)
		} catch (error) {
			if (!(error instanceof SyncTokenGone)) throw error
			return fullPass(current, read, true)
		}
	}

	async function readUnseen(current: SyncClaim, read: SyncRead, eventIds: readonly string[]) {
		const facts: EventFact[] = []
		for (const eventId of eventIds.slice(0, READ_LIMIT)) {
			try {
				const result = await deps.source.master(read, eventId)
				const readAt = now()
				if (result.kind === 'missing')
					facts.push({ eventId, status: 'cancelled', etag: `missing:${readAt.toISOString()}`, factAt: readAt })
				else if (result.kind === 'event' && result.fact.status === 'cancelled')
					facts.push({ ...result.fact, factAt: readAt })
				else if (result.kind === 'event') facts.push(result.fact)
			} catch {
				read.signal.throwIfAborted()
			}
		}
		if (!facts.length) return 0
		await applyReads(deps.db, current, facts)
		return facts.length
	}

	async function inbound(current: SyncClaim): Promise<InboundCounts> {
		const counts: InboundCounts = { ...NO_INBOUND }
		let after: InboundCursor | null = null
		do {
			const page = await inboundWork(deps.db, current.connectionId, after, INBOUND_PAGE)
			for (const row of page.rows) {
				if (!active()) return counts
				try {
					const result = await deps.db.transaction(async (tx) => {
						const outcome = await applyInbound(tx, {
							accountId: current.accountId,
							connectionId: current.connectionId,
							eventId: row.eventId,
							now: now(),
						})
						if (outcome.stamp) await markInboundApplied(tx, current.connectionId, [outcome.stamp])
						return outcome.result
					})
					counts[result] += 1
				} catch {
					counts.failed += 1
				}
			}
			after = page.next
		} while (after)
		return counts
	}

	async function afterPass(current: SyncClaim) {
		try {
			await deps.hooks?.afterPassCommit?.(current.connectionId)
			const counts = await inbound(current)
			const notable = counts.applied + counts.skipped_pending + counts.skipped_locked + counts.failed
			if (notable) deps.logger.info(counts, 'Calendar inbound apply')
			else deps.logger.debug(counts, 'Calendar inbound apply')
		} catch {
			deps.logger.warn({ failed: 1 }, 'Calendar inbound apply failed')
		}
	}

	async function run(current: SyncClaim) {
		const startedAt = Date.now()
		const signal = AbortSignal.any([stopped.signal, AbortSignal.timeout(PASS_BUDGET_MS)])
		let token: string
		try {
			const access = await deps.credentials.accessToken(current.accountId, signal)
			if (access.connection.id !== current.connectionId || access.connection.generation !== current.generation) {
				await releaseClaim(deps.db, current)
				return
			}
			token = access.accessToken
		} catch (error) {
			if (stopped.signal.aborted) await releaseClaim(deps.db, current)
			else await recordFailure(deps.db, current, accessIssue(error))
			deps.logger.warn({ failed: 1 }, 'Calendar sync token unavailable')
			return
		}
		const read: SyncRead = {
			token,
			calendarId: current.calendarId,
			calendarTimeZone: current.calendarTimeZone,
			signal,
		}
		let committed = false
		try {
			const outcome = await pass(current, read)
			committed = Boolean(outcome?.result.applied)
			if (!outcome || !outcome.result.applied) {
				await releaseClaim(deps.db, outcome?.claim ?? current)
				deps.logger.info({ discarded: 1 }, 'Calendar sync pass discarded')
			} else {
				const unseen = await readUnseen(outcome.claim, read, outcome.result.unseenBound)
				const counts = {
					pass: outcome.kind,
					upserted: outcome.result.upserted,
					removed: outcome.result.removed,
					skipped: outcome.result.skipped,
					truncated: outcome.result.truncated,
					masters: outcome.masters,
					unseen,
					durationMs: Date.now() - startedAt,
				}
				if (outcome.kind === 'full' || counts.upserted || counts.removed || counts.skipped || unseen)
					deps.logger.info(counts, 'Calendar sync pass')
				else deps.logger.debug(counts, 'Calendar sync pass')
			}
		} catch (error) {
			if (error instanceof GoogleWriteFault && error.httpStatus === 401) deps.credentials.evict(current.accountId)
			if (stopped.signal.aborted) await releaseClaim(deps.db, current)
			else await recordFailure(deps.db, current, callIssue(error))
			deps.logger.warn({ failed: 1, durationMs: Date.now() - startedAt }, 'Calendar sync pass failed')
		}
		if (committed && active()) await afterPass(current)
		try {
			const row = await syncFacts(deps.db, current.connectionId)
			if (row && active()) await deps.watch.maintain(row, token)
		} catch {
			deps.logger.warn({ failed: 1 }, 'Calendar channel maintenance failed')
		}
	}

	function launch(connectionId: string, claimed: SyncClaim | null): Promise<void> {
		const existing = running.get(connectionId)
		if (existing) {
			again.add(connectionId)
			if (claimed) void releaseClaim(deps.db, claimed).catch(() => undefined)
			return existing
		}
		const task = (async () => {
			let next = claimed
			do {
				again.delete(connectionId)
				if (!next) [next = null] = await claim(deps.db, connectionId)
				if (!next) return
				await run(next)
				next = null
			} while (again.has(connectionId) && active())
		})()
			.catch(() => deps.logger.warn({ failed: 1 }, 'Calendar sync run failed'))
			.finally(() => {
				if (running.get(connectionId) === task) running.delete(connectionId)
			})
		running.set(connectionId, task)
		return task
	}

	function tick() {
		if (!active() || sweep) return sweep
		sweep = (async () => {
			await ensureSyncRows(deps.db, now())
			for (const current of await claim(deps.db, null)) {
				if (!active()) {
					await releaseClaim(deps.db, current)
					continue
				}
				void launch(current.connectionId, current)
			}
		})()
			.catch(() => deps.logger.warn({ failed: 1 }, 'Calendar sync tick failed'))
			.finally(() => {
				sweep = undefined
			})
		return sweep
	}

	return {
		name: 'calendar-sync',
		start() {
			timer = setInterval(tick, TICK_MS)
			timer.unref()
			void tick()
		},
		wake(connectionId: string): Promise<void> {
			if (!active()) return Promise.resolve()
			return launch(connectionId, null)
		},
		async close() {
			stopped.abort()
			if (timer) clearInterval(timer)
			await sweep
			await Promise.allSettled([...running.values()])
			again.clear()
		},
	}
}
