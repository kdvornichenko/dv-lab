'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useCalendarController, useCalendarRefresh } from '@/components/app/calendar-command-provider'
import { readCalendarWeek } from '@/components/app/calendar-command-transport'
import { useGoogleSync } from '@/components/app/use-google-sync'
import { API_CACHE_INVALIDATED, DEVICE_CACHE_PREFIX, sessionEpoch } from '@/lib/api-client'
import { deviceGet, deviceSet } from '@/lib/device-store'
import { staleCalendarWindow } from '@/lib/lesson-actions'

import { googleScheduleWindow, timeZoneIdentity, type GoogleScheduleWindow } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, addDays, lessonDay, mondayOf, scheduleDate, scheduleWeekRange } from '@dv-lab/core'

type WeekQuery = { mainTimeZone: string; monday: string; current: boolean }
type WeekState = { kind: 'loading' | 'error' | 'ready'; query: WeekQuery | null; data: GoogleScheduleWindow | null }
type WeekResult = { query: WeekQuery; data: GoogleScheduleWindow }
type Cached = { data: GoogleScheduleWindow; at: number }
type Prefetch = { monday: string; promise: Promise<GoogleScheduleWindow | null>; abort: AbortController }

const FRESH_MS = 5 * 60_000
const PREFETCH_DELAY_MS = 150
const NEIGHBOURS = [7, -7, 14, -14, 21, -21, 28, -28] as const
const WINDOWS_KEPT = 13

function weekKey(timeZone: string, monday: string): string {
	return `${timeZoneIdentity(timeZone) ?? timeZone}|${monday}`
}

function windowKey(data: GoogleScheduleWindow): string {
	const { start, timeZone } = data.requestedRange
	return weekKey(timeZone, scheduleDate(new Date(start), timeZone))
}

function pause(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

const ZONE_KEY = `${DEVICE_CACHE_PREFIX}schedule-zone`
const DEVICE_WEEKS = 3

function deviceKey(accountId: string): string {
	return `${DEVICE_CACHE_PREFIX}schedule-weeks:${accountId}`
}

function knownZone(): string {
	try {
		return timeZoneIdentity(localStorage.getItem(ZONE_KEY) ?? SCHEDULE_TIME_ZONE) ?? SCHEDULE_TIME_ZONE
	} catch {
		return SCHEDULE_TIME_ZONE
	}
}

async function deviceWindows(accountId: string): Promise<GoogleScheduleWindow[]> {
	const stored = await deviceGet(deviceKey(accountId))
	if (!Array.isArray(stored)) return []
	return stored.flatMap((item) => {
		const parsed = googleScheduleWindow.safeParse(item)
		return parsed.success ? [parsed.data] : []
	})
}

async function keepOnDevice(accountId: string, data: GoogleScheduleWindow) {
	try {
		localStorage.setItem(ZONE_KEY, data.requestedRange.timeZone)
	} catch {}
	const key = windowKey(data)
	const kept = [data, ...(await deviceWindows(accountId)).filter((item) => windowKey(item) !== key)]
	await deviceSet(deviceKey(accountId), kept.slice(0, DEVICE_WEEKS))
}

function nearToday(data: GoogleScheduleWindow): boolean {
	const zone = data.requestedRange.timeZone
	const shown = scheduleDate(new Date(data.requestedRange.start), zone)
	const current = mondayOf(lessonDay(new Date(), zone))
	return Math.abs(Date.parse(shown) - Date.parse(current)) <= 7 * 86400000
}

function bootstrap(initialMonday: string | null): WeekQuery {
	const mainTimeZone = knownZone()
	const currentMonday = mondayOf(lessonDay(new Date(), mainTimeZone))
	const monday = initialMonday ?? currentMonday
	return { mainTimeZone, monday, current: monday === currentMonday }
}

function matchesQuery(data: GoogleScheduleWindow, query: WeekQuery): boolean {
	const range = data.requestedRange
	const week = scheduleWeekRange(query.monday, range.timeZone)
	return (
		timeZoneIdentity(range.timeZone) === timeZoneIdentity(query.mainTimeZone) &&
		Date.parse(range.start) === week.start.getTime() &&
		Date.parse(range.end) === week.end.getTime()
	)
}

async function readWeek(
	requested: WeekQuery,
	obsolete: () => boolean,
	readWindow: (date: string) => Promise<GoogleScheduleWindow | null>
): Promise<WeekResult | null> {
	let query = requested
	for (let attempt = 0; attempt < 2; attempt++) {
		const data = await readWindow(query.monday)
		if (obsolete() || data === null) return null
		const mainTimeZone = data.requestedRange.timeZone
		if (scheduleDate(new Date(data.requestedRange.start), mainTimeZone) !== query.monday) return null
		const monday = query.current ? mondayOf(lessonDay(new Date(), mainTimeZone)) : query.monday
		if (matchesQuery(data, query) && monday === query.monday) return { query, data }
		query = { ...query, mainTimeZone, monday }
	}
	return null
}

function older(next: GoogleScheduleWindow, previous: GoogleScheduleWindow | null): boolean {
	if (previous === null) return false
	if (next.connection.generation !== previous.connection.generation)
		return next.connection.generation < previous.connection.generation
	if (
		next.requestedRange.start !== previous.requestedRange.start ||
		next.requestedRange.end !== previous.requestedRange.end ||
		timeZoneIdentity(next.requestedRange.timeZone) !== timeZoneIdentity(previous.requestedRange.timeZone)
	)
		return false
	return (
		next.read.state !== 'unavailable' &&
		previous.read.state !== 'unavailable' &&
		BigInt(next.read.revision) < BigInt(previous.read.revision)
	)
}

export function useScheduleWeek(initialMonday: string | null = null) {
	const initial = useRef(initialMonday)
	const controller = useCalendarController()
	const [state, setState] = useState<WeekState>(() => ({
		kind: 'loading',
		query: bootstrap(initialMonday),
		data: null,
	}))
	const query = useRef<WeekQuery | null>(null)
	const requests = useRef(0)
	const latest = useRef<GoogleScheduleWindow | null>(null)
	const cache = useRef(new Map<string, Cached>())
	const windows = useRef(new Map<string, GoogleScheduleWindow>())
	const [, setTick] = useState(0)
	const epoch = useRef(0)
	const prefetch = useRef<Prefetch | null>(null)
	const loading = useRef(false)
	const handledRevision = useRef<string | null>(null)
	const sync = useGoogleSync()

	const store = useCallback((data: GoogleScheduleWindow) => {
		const key = windowKey(data)
		windows.current.delete(key)
		windows.current.set(key, data)
		for (const old of windows.current.keys()) {
			if (windows.current.size <= WINDOWS_KEPT) break
			windows.current.delete(old)
		}
		setTick((tick) => tick + 1)
	}, [])

	const peek = useCallback(
		(monday: string, timeZone: string) => windows.current.get(weekKey(timeZone, monday)) ?? null,
		[]
	)

	useEffect(() => {
		let live = true
		void deviceWindows(controller.accountId).then((saved) => {
			if (!live || saved.length === 0) return
			for (const data of [...saved].reverse()) if (!windows.current.has(windowKey(data))) store(data)
			setState((previous) => {
				const shown = previous.query
				if (previous.kind !== 'loading' || previous.data !== null || shown === null) return previous
				const found = saved.find((data) => matchesQuery(data, shown))
				return found === undefined ? previous : { ...previous, data: staleCalendarWindow(found) }
			})
		})
		return () => {
			live = false
		}
	}, [controller.accountId, store])

	const remember = useCallback(
		(data: GoogleScheduleWindow, since: number) => {
			store(data)
			if (since !== epoch.current || data.read.state !== 'fresh') return
			for (const [key, entry] of cache.current)
				if (entry.data.connection.generation !== data.connection.generation) cache.current.delete(key)
			cache.current.set(windowKey(data), { data, at: Date.now() })
			if (nearToday(data)) void keepOnDevice(controller.accountId, data)
		},
		[store, controller.accountId]
	)

	const stopPrefetch = useCallback((keep?: string) => {
		const running = prefetch.current
		if (running === null || running.monday === keep) return
		running.abort.abort()
		prefetch.current = null
	}, [])

	const forget = useCallback(() => {
		epoch.current++
		cache.current.clear()
		stopPrefetch()
	}, [stopPrefetch])

	const readWindow = useCallback(
		(monday: string) => {
			const running = prefetch.current
			if (running === null || running.monday !== monday) return controller.readWindow(monday)
			prefetch.current = null
			return running.promise
		},
		[controller]
	)

	const quietRead = useCallback(async (monday: string, signal: AbortSignal) => {
		const session = sessionEpoch()
		const data = await readCalendarWeek(monday, signal)
		if (data === null || signal.aborted || sessionEpoch() !== session) return null
		return data
	}, [])

	const warm = useCallback(
		async (around: WeekQuery, id: number) => {
			for (const offset of NEIGHBOURS) {
				await pause(PREFETCH_DELAY_MS)
				if (id !== requests.current || prefetch.current !== null) return
				const monday = addDays(around.monday, offset)
				const key = weekKey(around.mainTimeZone, monday)
				const hit = cache.current.get(key)
				if (hit !== undefined && Date.now() - hit.at < FRESH_MS) continue
				const since = epoch.current
				const abort = new AbortController()
				const running = { monday, promise: quietRead(monday, abort.signal), abort }
				prefetch.current = running
				const data = await running.promise
				if (prefetch.current === running) prefetch.current = null
				if (data !== null && windowKey(data) === key && !older(data, latest.current)) remember(data, since)
			}
		},
		[quietRead, remember]
	)

	const load = useCallback(
		async (requested: WeekQuery | null): Promise<GoogleScheduleWindow | null> => {
			const id = ++requests.current
			const since = epoch.current
			loading.current = true
			query.current = requested
			const target = requested ?? bootstrap(initial.current)
			if (id !== requests.current) return null
			query.current = target
			const result = target === null ? null : await readWeek(target, () => id !== requests.current, readWindow)
			if (id !== requests.current) return null
			loading.current = false
			if (result === null || older(result.data, latest.current)) {
				setState((previous) => ({
					...previous,
					kind: 'error',
					query: target,
					data: staleCalendarWindow(previous.data),
				}))
				return null
			}
			query.current = result.query
			latest.current = result.data
			remember(result.data, since)
			setState({ kind: 'ready', ...result })
			void warm(result.query, id)
			return result.data
		},
		[readWindow, remember, warm]
	)

	useEffect(
		() =>
			controller.subscribeWindow((data) => {
				if (older(data, latest.current)) return
				remember(data, epoch.current)
				const requested = query.current
				if (requested === null || !matchesQuery(data, requested)) return
				latest.current = data
				setState({ kind: 'ready', query: requested, data })
			}),
		[controller, remember]
	)

	useEffect(() => {
		const counter = requests
		void load(null)
		return () => {
			counter.current++
			stopPrefetch()
		}
	}, [load, stopPrefetch])

	const start = useCallback(
		(requested: WeekQuery | null) => {
			stopPrefetch(requested?.monday)
			const hit = requested === null ? undefined : cache.current.get(weekKey(requested.mainTimeZone, requested.monday))
			const cached = hit !== undefined && !older(hit.data, latest.current) ? hit : null
			const young = cached !== null && Date.now() - cached.at < FRESH_MS
			setState((previous) => {
				if (cached !== null)
					return {
						kind: young ? 'ready' : 'loading',
						query: requested,
						data: young ? cached.data : staleCalendarWindow(cached.data),
					}
				return {
					kind: 'loading',
					query: requested,
					data:
						requested !== null && previous.data !== null && matchesQuery(previous.data, requested)
							? staleCalendarWindow(previous.data)
							: null,
				}
			})
			return load(requested)
		},
		[load, stopPrefetch]
	)

	const reload = useCallback(() => {
		forget()
		return start(query.current)
	}, [forget, start])
	const refresh = useCallback(async () => {
		await reload()
	}, [reload])
	useCalendarRefresh(refresh, 'window')

	useEffect(() => {
		const shown = state.data
		if (sync === null || state.kind !== 'ready' || shown === null || shown.read.state === 'unavailable') return
		if (shown.read.revision === sync.revision || handledRevision.current === sync.revision || loading.current) return
		if (document.querySelector('[role="dialog"]') !== null) {
			forget()
			return
		}
		handledRevision.current = sync.revision
		forget()
		void load(query.current).then((data) => {
			if (data === null) handledRevision.current = null
		})
	}, [sync, state, forget, load])

	useEffect(() => {
		const returned = () => {
			if (document.visibilityState !== 'visible' || loading.current) return
			const shown = query.current
			const hit = shown === null ? undefined : cache.current.get(weekKey(shown.mainTimeZone, shown.monday))
			if (hit !== undefined && Date.now() - hit.at < FRESH_MS) return
			if (shown === null || document.querySelector('[role="dialog"]') !== null) forget()
			else void reload()
		}
		window.addEventListener(API_CACHE_INVALIDATED, forget)
		window.addEventListener('focus', returned)
		document.addEventListener('visibilitychange', returned)
		return () => {
			window.removeEventListener(API_CACHE_INVALIDATED, forget)
			window.removeEventListener('focus', returned)
			document.removeEventListener('visibilitychange', returned)
		}
	}, [forget, reload])

	function navigate(monday: string, current: boolean) {
		if (query.current !== null) void start({ ...query.current, monday, current })
	}

	return { state, reload, navigate, peek }
}
