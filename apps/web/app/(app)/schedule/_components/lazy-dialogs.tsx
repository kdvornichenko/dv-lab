'use client'

import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react'

function preloadable<P extends object>(load: () => Promise<ComponentType<P>>) {
	let ready: ComponentType<P> | null = null
	let loading: Promise<ComponentType<P>> | null = null
	function loadOnce() {
		loading ??= load().then(
			(component) => {
				ready = component
				return component
			},
			(error: unknown) => {
				loading = null
				throw error
			}
		)
		return loading
	}
	const Lazy = lazy(() => loadOnce().then((component) => ({ default: component })))
	function Preloaded(props: P) {
		const [Shown] = useState(() => ready)
		if (Shown !== null) return <Shown {...props} />
		return (
			<Suspense fallback={null}>
				<Lazy {...props} />
			</Suspense>
		)
	}
	return [Preloaded, loadOnce] as const
}

const [NewLessonDialog, loadNewLesson] = preloadable(() =>
	import('./new-lesson-dialog').then((module) => module.NewLessonDialog)
)
const [CalendarLessonDialog, loadCalendarLesson] = preloadable(() =>
	import('./calendar-lesson-dialog').then((module) => module.CalendarLessonDialog)
)
const [CalendarEventDialog, loadCalendarEvent] = preloadable(() =>
	import('./calendar-event-details').then((module) => module.CalendarEventDialog)
)
const [LessonCountWindow, loadLessonCount] = preloadable(() =>
	import('./lesson-count-window').then((module) => module.LessonCountWindow)
)

export { CalendarEventDialog, CalendarLessonDialog, LessonCountWindow, NewLessonDialog }

let preloading: Promise<unknown> | null = null

function preloadScheduleDialogs() {
	preloading ??= Promise.all([loadNewLesson(), loadCalendarLesson(), loadCalendarEvent(), loadLessonCount()]).catch(
		() => {
			preloading = null
		}
	)
	return preloading
}

const IDLE_TIMEOUT_MS = 2000

export function useScheduleDialogsPreload(shown: boolean) {
	useEffect(() => {
		if (!shown || preloading !== null) return
		if (typeof window.requestIdleCallback === 'function') {
			const id = window.requestIdleCallback(() => void preloadScheduleDialogs(), { timeout: IDLE_TIMEOUT_MS })
			return () => window.cancelIdleCallback(id)
		}
		const id = window.setTimeout(() => void preloadScheduleDialogs(), 0)
		return () => window.clearTimeout(id)
	}, [shown])
}
