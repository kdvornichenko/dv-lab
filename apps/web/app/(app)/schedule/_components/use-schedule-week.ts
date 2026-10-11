'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiRequest } from '@/lib/api-client'

import { timeZoneIdentity, type ScheduleWeekResponse, type SettingsResponse } from '@dv-lab/contracts'
import { mondayOf, scheduleToday } from '@dv-lab/core'

import { lessonWeekKey, readLessonWeek, readOverlapBlocks } from './lesson-dialogs'

type WeekQuery = { mainTimeZone: string; monday: string; current: boolean }
type WeekResult = { query: WeekQuery; data: ScheduleWeekResponse }
type WeekState =
	| { kind: 'loading' | 'error'; query: WeekQuery | null; data: ScheduleWeekResponse | null; receivedAt: number }
	| ({ kind: 'ready'; receivedAt: number } & WeekResult)

async function bootstrap(): Promise<WeekQuery | null> {
	const result = await apiRequest<SettingsResponse>('GET', '/settings')
	if (!result.ok) return null
	const mainTimeZone = timeZoneIdentity(result.data.settings.defaultTimeZone)
	if (mainTimeZone === null) return null
	return { mainTimeZone, monday: mondayOf(scheduleToday(new Date(), mainTimeZone)), current: true }
}

async function readAuthoritativeWeek(
	requested: WeekQuery,
	obsolete: () => boolean,
	onContextChange: (query: WeekQuery) => void
): Promise<WeekResult | null> {
	let query = requested
	for (let attempt = 0; attempt < 2; attempt++) {
		const result = await readLessonWeek(query.monday)
		if (obsolete() || !result.ok) return null
		const data = result.data
		const mainTimeZone = timeZoneIdentity(data.defaultTimeZone)
		if (mainTimeZone === null || data.start !== query.monday) return null
		const monday = query.current ? mondayOf(scheduleToday(new Date(data.asOf), mainTimeZone)) : query.monday
		if (mainTimeZone === query.mainTimeZone && monday === query.monday) return { query, data }
		query = { ...query, mainTimeZone, monday }
		onContextChange(query)
	}
	return null
}

export function useScheduleWeek(minuteNow: Date) {
	const [state, setState] = useState<WeekState>({ kind: 'loading', query: null, data: null, receivedAt: 0 })
	const query = useRef<WeekQuery | null>(null)
	const requests = useRef(0)
	const weeks = useRef(new Map<string, ScheduleWeekResponse>())

	const load = useCallback(async (requested: WeekQuery | null) => {
		const id = ++requests.current
		query.current = requested
		const target = requested ?? (await bootstrap())
		if (id !== requests.current) return
		const result =
			target === null
				? null
				: await readAuthoritativeWeek(
						target,
						() => id !== requests.current,
						(next) => {
							weeks.current = new Map<string, ScheduleWeekResponse>()
							query.current = next
							setState((previous) => ({ ...previous, kind: 'loading', query: next }))
						}
					)
		if (id !== requests.current) return
		if (result === null) {
			setState((previous) => ({ ...previous, kind: 'error' }))
			return
		}
		if (query.current?.mainTimeZone !== result.query.mainTimeZone)
			weeks.current = new Map<string, ScheduleWeekResponse>()
		query.current = result.query
		weeks.current.set(lessonWeekKey(result.query.mainTimeZone, result.query.monday), result.data)
		setState({ kind: 'ready', ...result, receivedAt: Date.now() })
	}, [])

	useEffect(() => {
		const counter = requests
		void load(null)
		return () => {
			counter.current++
		}
	}, [load])

	const reload = useCallback(async () => {
		weeks.current = new Map<string, ScheduleWeekResponse>()
		await load(query.current)
	}, [load])

	function navigate(monday: string, current: boolean) {
		if (query.current === null) return
		const next = { ...query.current, monday, current }
		setState((previous) => ({ ...previous, kind: 'loading', query: next }))
		void load(next)
	}

	function blocksOn(date: string) {
		if (query.current === null) return Promise.resolve([])
		return readOverlapBlocks(date, weeks.current, query.current.mainTimeZone)
	}

	const now = useMemo(
		() =>
			state.data !== null
				? new Date(new Date(state.data.asOf).getTime() + Math.max(0, minuteNow.getTime() - state.receivedAt))
				: minuteNow,
		[state, minuteNow]
	)
	return { state, now, reload, navigate, blocksOn }
}
