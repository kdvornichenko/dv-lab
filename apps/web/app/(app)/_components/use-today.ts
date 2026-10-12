'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useCalendarController, useCalendarRefresh } from '@/components/app/calendar-command-provider'
import { apiRequest } from '@/lib/api-client'
import { staleCalendarWindow } from '@/lib/lesson-actions'

import type { GoogleScheduleWindow, TodayResponse } from '@dv-lab/contracts'
import { lessonDay } from '@dv-lab/core'

type TodayState = {
	kind: 'loading' | 'error' | 'ready'
	data: TodayResponse | null
	receivedAt: number
}

export function useToday(minuteNow: Date) {
	const [state, setState] = useState<TodayState>({ kind: 'loading', data: null, receivedAt: 0 })
	const requests = useRef(0)
	const latest = useRef<TodayResponse | null>(null)
	const controller = useCalendarController()
	const [calendar, setCalendar] = useState<GoogleScheduleWindow | null>(null)

	const reload = useCallback(async () => {
		const id = ++requests.current
		const result = await apiRequest<TodayResponse>('GET', '/today')
		if (id !== requests.current) return
		const receivedAt = Date.now()
		if (result.ok) {
			latest.current = result.data
			const window = await controller.readWindow(result.data.date)
			if (id !== requests.current) return
			setCalendar((previous) => window ?? staleCalendarWindow(previous))
		}
		setState((previous) =>
			result.ok ? { kind: 'ready', data: result.data, receivedAt } : { ...previous, kind: 'error' }
		)
	}, [controller])
	useCalendarRefresh(reload)

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
	const data = state.data
	const refreshDay =
		state.kind === 'ready' &&
		data !== null &&
		(lessonDay(now, data.defaultTimeZone) !== data.date ||
			data.lessons.some((block) => block.startsAt > data.asOf && new Date(block.startsAt) <= now))
	useEffect(() => {
		if (refreshDay) void reload()
	}, [now, refreshDay, reload])

	return { state, now, reload, calendar, getData: () => latest.current }
}
