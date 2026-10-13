'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import { sameCalendarRef } from '@/lib/lesson-actions'
import { formatDate, formatTime } from '@/lib/schedule-format'
import { isCalendarDay, parseLessonRef } from '@/lib/schedule-links'

import type { CalendarEventView } from '@dv-lab/contracts'
import { addDays, mondayOf } from '@dv-lab/core'

import { isShown, prefersReducedMotion, scrollToMiddle, startMark, type MarkPart } from './arrival-mark'
import { eventTitle } from './calendar-event-details'

export type ArrivalParams = { week: string | null; lesson: string | null; day: string | null }

const SETTLE_MS = 200

export function arrivalMonday(params: ArrivalParams | null): string | null {
	if (params === null) return null
	const date = [params.week, params.day].find((value) => isCalendarDay(value))
	return date === undefined ? null : mondayOf(date)
}

function shownAll(selector: string): HTMLElement[] {
	return Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isShown)
}

function lessonParts(key: string): HTMLElement[] {
	return shownAll('[data-event-key]').filter((el) => el.dataset.eventKey === key)
}

function dayParts(date: string): MarkPart[] {
	const parts: MarkPart[] = []
	const circle = shownAll(
		`[data-date="${date}"] [data-slot="week-grid-date"], [data-slot="agenda-date"][data-date="${date}"]`
	)[0]
	if (circle) parts.push({ el: circle, kind: 'ring', fill: false, raise: false })
	const column = shownAll(`[data-slot="week-grid-column"][data-date="${date}"]`)[0]
	if (column) parts.push({ el: column, kind: 'wash', fill: false, raise: false })
	return parts
}

function dropMarkParams() {
	const url = new URL(window.location.href)
	if (!url.searchParams.has('lesson') && !url.searchParams.has('day')) return
	url.searchParams.delete('lesson')
	url.searchParams.delete('day')
	return `${url.pathname}${url.search}${url.hash}`
}

export function useScheduleArrival({
	week: weekParam,
	lesson: lessonParam,
	day: dayParam,
	failed,
	ready,
	monday,
	events,
	mainTimeZone,
	currentYear,
}: ArrivalParams & {
	failed: boolean
	ready: boolean
	monday: string
	events: readonly CalendarEventView[]
	mainTimeZone: string
	currentYear: number
}) {
	const router = useRouter()
	const [gone, setGone] = useState<{ date: string; monday: string } | null>(null)
	const [announcement, setAnnouncement] = useState('')
	const applied = useRef<string | null>(null)
	const end = useRef<(() => void) | null>(null)
	const latest = useRef({ events, monday })
	useEffect(() => {
		latest.current = { events, monday }
	})
	const key = lessonParam !== null || dayParam !== null ? `${weekParam}|${lessonParam}|${dayParam}` : null

	const dropParams = useCallback(() => {
		const next = dropMarkParams()
		if (next !== undefined) router.replace(next, { scroll: false })
	}, [router])

	useEffect(() => {
		if (key === null || applied.current === key) return
		if (failed) {
			applied.current = key
			dropParams()
			return
		}
		if (!ready) return
		const timer = window.setTimeout(() => {
			applied.current = key
			end.current?.()
			end.current = null
			setGone(null)
			setAnnouncement('')
			const shownWeek = latest.current.monday
			const week = isCalendarDay(weekParam) ? weekParam : null
			const day = isCalendarDay(dayParam) ? dayParam : null
			const dates = new Set(Array.from({ length: 7 }, (_, index) => addDays(shownWeek, index)))
			let parts: MarkPart[] = []
			let target: HTMLElement | null = null
			let said = ''
			const ref = parseLessonRef(lessonParam)
			if (ref !== null) {
				const event = latest.current.events.find(
					(entry) => entry.binding.kind === 'lesson' && sameCalendarRef(entry.binding.ref, ref)
				)
				if (event === undefined) {
					const missingOn = week ?? day
					if (missingOn !== null && dates.has(missingOn)) {
						parts = dayParts(missingOn)
						target = parts[0]?.el ?? null
						setGone({ date: missingOn, monday: shownWeek })
					}
				} else {
					const blocks = lessonParts(event.eventKey)
					parts = blocks.map((el) => ({ el, kind: 'ring' as const, fill: true, raise: true }))
					target = blocks[0] ?? null
					if (event.when.kind === 'timed') {
						const at = new Date(event.when.startsAt)
						const date = week ?? shownWeek
						said = `Showing ${eventTitle(event)}, ${formatDate(date, currentYear)}, ${formatTime(at, mainTimeZone)}`
					}
				}
			} else if (day !== null && dates.has(day)) {
				parts = dayParts(day)
				target = parts[0]?.el ?? null
				said = `Showing ${formatDate(day, currentYear)}`
			}
			dropParams()
			if (parts.length === 0) return
			const reduce = prefersReducedMotion()
			void (target === null ? Promise.resolve() : scrollToMiddle(target, reduce)).then(() => {
				end.current = startMark(parts, reduce, () => {
					end.current = null
				})
				if (said !== '') setAnnouncement(said)
			})
		}, SETTLE_MS)
		return () => window.clearTimeout(timer)
	}, [key, weekParam, lessonParam, dayParam, failed, ready, dropParams, currentYear, mainTimeZone])

	useEffect(
		() => () => {
			end.current?.()
		},
		[]
	)

	return {
		announcement,
		gone: gone !== null && gone.monday === monday ? gone.date : null,
		dismissGone: () => setGone(null),
	}
}
