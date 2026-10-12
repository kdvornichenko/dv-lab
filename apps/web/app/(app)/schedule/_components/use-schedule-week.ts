'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useCalendarController, useCalendarRefresh } from '@/components/app/calendar-command-provider'
import { apiRequest } from '@/lib/api-client'
import { staleCalendarWindow } from '@/lib/lesson-actions'

import { timeZoneIdentity, type GoogleScheduleWindow, type SettingsResponse } from '@dv-lab/contracts'
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
		const monday = query.current ? mondayOf(scheduleToday(new Date(), mainTimeZone)) : query.monday
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

export function useScheduleWeek() {
	const controller = useCalendarController()
	const [state, setState] = useState<WeekState>({ kind: 'loading', query: null, data: null })
	const query = useRef<WeekQuery | null>(null)
	const requests = useRef(0)
	const latest = useRef<GoogleScheduleWindow | null>(null)

	const load = useCallback(
		async (requested: WeekQuery | null): Promise<GoogleScheduleWindow | null> => {
			const id = ++requests.current
			query.current = requested
			const target = requested ?? (await bootstrap())
			if (id !== requests.current) return null
			query.current = target
			const result =
				target === null ? null : await readWeek(target, () => id !== requests.current, controller.readWindow)
			if (id !== requests.current) return null
			if (result === null || older(result.data, latest.current)) {
				setState((previous) => ({ ...previous, kind: 'error', query: target }))
				return null
			}
			query.current = result.query
			latest.current = result.data
			setState({ kind: 'ready', ...result })
			return result.data
		},
		[controller]
	)

	useEffect(
		() =>
			controller.subscribeWindow((data) => {
				const requested = query.current
				if (requested === null || !matchesQuery(data, requested) || older(data, latest.current)) return
				latest.current = data
				setState({ kind: 'ready', query: requested, data })
			}),
		[controller]
	)

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
						? staleCalendarWindow(previous.data)
						: null,
			}))
			return load(requested)
		},
		[load]
	)

	const reload = useCallback(() => start(query.current), [start])
	const refresh = useCallback(async () => {
		await reload()
	}, [reload])
	useCalendarRefresh(refresh, 'window')

	function navigate(monday: string, current: boolean) {
		if (query.current !== null) void start({ ...query.current, monday, current })
	}

	return { state, reload, navigate }
}
