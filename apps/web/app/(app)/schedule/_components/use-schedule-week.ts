'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '@/lib/api-client'

import {
	googleScheduleWindow,
	timeZoneIdentity,
	type GoogleScheduleWindow,
	type SettingsResponse,
} from '@dv-lab/contracts'
import { addDays, mondayOf, scheduleDate, scheduleToday, startOfZonedDay } from '@dv-lab/core'

type WeekQuery = { mainTimeZone: string; monday: string; current: boolean }
type WeekState = { kind: 'loading' | 'error' | 'ready'; query: WeekQuery | null; data: GoogleScheduleWindow | null }
type WeekResult = { query: WeekQuery; data: GoogleScheduleWindow }

async function bootstrap(): Promise<WeekQuery | null> {
	const result = await apiRequest<SettingsResponse>('GET', '/settings')
	if (!result.ok) return null
	const mainTimeZone = timeZoneIdentity(result.data.settings.defaultTimeZone)
	if (mainTimeZone === null) return null
	return { mainTimeZone, monday: mondayOf(scheduleToday(new Date(), mainTimeZone)), current: true }
}

function matchesQuery(data: GoogleScheduleWindow, query: WeekQuery): boolean {
	const range = data.requestedRange
	return (
		timeZoneIdentity(range.timeZone) === timeZoneIdentity(query.mainTimeZone) &&
		Date.parse(range.start) === startOfZonedDay(query.monday, range.timeZone).getTime() &&
		Date.parse(range.end) === startOfZonedDay(addDays(query.monday, 7), range.timeZone).getTime()
	)
}

function covered(data: GoogleScheduleWindow): GoogleScheduleWindow {
	if (data.read.state === 'unavailable') return data
	const range = data.snapshotRange
	if (
		range !== null &&
		timeZoneIdentity(range.timeZone) === timeZoneIdentity(data.requestedRange.timeZone) &&
		Date.parse(range.start) === Date.parse(data.requestedRange.start) &&
		Date.parse(range.end) === Date.parse(data.requestedRange.end)
	)
		return data
	return {
		...data,
		snapshotRange: null,
		events: [],
		series: [],
		read: { state: 'unavailable', reason: 'invalid_provider_data' },
		write: { state: 'blocked', reason: 'invalid_provider_data' },
	}
}

async function readWeek(requested: WeekQuery, obsolete: () => boolean): Promise<WeekResult | null> {
	let query = requested
	for (let attempt = 0; attempt < 2; attempt++) {
		const result = await apiRequest<unknown>('GET', `/schedule/week?start=${query.monday}`)
		if (obsolete() || !result.ok) return null
		const parsed = googleScheduleWindow.safeParse(result.data)
		if (!parsed.success) return null
		const data = parsed.data
		const mainTimeZone = data.requestedRange.timeZone
		if (scheduleDate(new Date(data.requestedRange.start), mainTimeZone) !== query.monday) return null
		const monday = query.current ? mondayOf(scheduleToday(new Date(), mainTimeZone)) : query.monday
		if (matchesQuery(data, query) && monday === query.monday) return { query, data: covered(data) }
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

function stale(data: GoogleScheduleWindow | null): GoogleScheduleWindow | null {
	if (data === null) return null
	return {
		...data,
		read:
			data.read.state === 'unavailable'
				? data.read
				: { ...data.read, state: 'last_known', reason: 'provider_unavailable' },
		write: { state: 'blocked', reason: 'provider_unavailable' },
	}
}

export function useScheduleWeek() {
	const [state, setState] = useState<WeekState>({ kind: 'loading', query: null, data: null })
	const query = useRef<WeekQuery | null>(null)
	const requests = useRef(0)
	const latest = useRef<GoogleScheduleWindow | null>(null)

	const load = useCallback(async (requested: WeekQuery | null) => {
		const id = ++requests.current
		query.current = requested
		const target = requested ?? (await bootstrap())
		if (id !== requests.current) return
		query.current = target
		const result = target === null ? null : await readWeek(target, () => id !== requests.current)
		if (id !== requests.current) return
		if (result === null || older(result.data, latest.current)) {
			setState((previous) => ({ ...previous, kind: 'error', query: target }))
			return
		}
		query.current = result.query
		latest.current = result.data
		setState({ kind: 'ready', ...result })
	}, [])

	useEffect(() => {
		const counter = requests
		void load(null)
		return () => {
			counter.current++
		}
	}, [load])

	const start = useCallback(
		(requested: WeekQuery | null) => {
			setState((previous) => ({
				kind: 'loading',
				query: requested,
				data:
					requested !== null && previous.data !== null && matchesQuery(previous.data, requested)
						? stale(previous.data)
						: null,
			}))
			return load(requested)
		},
		[load]
	)

	const reload = useCallback(() => start(query.current), [start])

	function navigate(monday: string, current: boolean) {
		if (query.current !== null) void start({ ...query.current, monday, current })
	}

	return { state, reload, navigate }
}
