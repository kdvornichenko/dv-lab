'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiRequest } from '@/lib/api-client'
import { hasStaleActions } from '@/lib/lesson-actions'

import type { ScheduleWeekResponse, TodayResponse } from '@dv-lab/contracts'
import { scheduleToday } from '@dv-lab/core'

import { readOverlapBlocks } from '../schedule/_components/lesson-dialogs'

type TodayState = {
	kind: 'loading' | 'error' | 'ready'
	data: TodayResponse | null
	receivedAt: number
}

export function useToday(minuteNow: Date) {
	const [state, setState] = useState<TodayState>({ kind: 'loading', data: null, receivedAt: 0 })
	const requests = useRef(0)
	const latest = useRef<TodayResponse | null>(null)
	const weeks = useRef(new Map<string, ScheduleWeekResponse>())

	const reload = useCallback(async () => {
		const id = ++requests.current
		weeks.current = new Map<string, ScheduleWeekResponse>()
		const result = await apiRequest<TodayResponse>('GET', '/today')
		if (id !== requests.current) return
		const receivedAt = Date.now()
		if (result.ok) latest.current = result.data
		setState((previous) =>
			result.ok ? { kind: 'ready', data: result.data, receivedAt } : { ...previous, kind: 'error' }
		)
	}, [])

	useEffect(() => {
		const counter = requests
		void reload()
		const focus = () => void reload()
		const visible = () => {
			if (document.visibilityState === 'visible') void reload()
		}
		window.addEventListener('focus', focus)
		document.addEventListener('visibilitychange', visible)
		return () => {
			counter.current++
			window.removeEventListener('focus', focus)
			document.removeEventListener('visibilitychange', visible)
		}
	}, [reload])

	const now = useMemo(
		() =>
			state.data === null
				? minuteNow
				: new Date(new Date(state.data.asOf).getTime() + Math.max(0, minuteNow.getTime() - state.receivedAt)),
		[state, minuteNow]
	)
	const refreshDay =
		state.kind === 'ready' &&
		state.data !== null &&
		(scheduleToday(now, state.data.defaultTimeZone) !== state.data.date || hasStaleActions(state.data.lessons, now))
	useEffect(() => {
		if (refreshDay) void reload()
	}, [now, refreshDay, reload])

	function blocksOn(date: string) {
		const data = latest.current
		return data === null ? Promise.resolve([]) : readOverlapBlocks(date, weeks.current, data.defaultTimeZone)
	}

	return { state, now, reload, blocksOn, getData: () => latest.current }
}
