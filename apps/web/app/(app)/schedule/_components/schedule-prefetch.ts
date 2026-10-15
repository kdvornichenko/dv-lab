'use client'

import { useEffect, useRef } from 'react'

import { apiRequest } from '@/lib/api-client'
import { calendarLesson } from '@/lib/lesson-actions'

import {
	calendarEventDetails,
	googleEventPalette,
	type CalendarEventDetails,
	type CalendarEventView,
	type GoogleEventPalette,
	type LessonComment,
	type LessonCommentsResponse,
	type ScheduleOccurrenceRef,
} from '@dv-lab/contracts'
import { lessonDay } from '@dv-lab/core'

const KEPT = 400
const stored = new Map<string, unknown>()
const running = new Map<string, Promise<unknown>>()

export function peekCache<T>(key: string): T | undefined {
	return stored.get(key) as T | undefined
}

export function keepCache(key: string, value: unknown) {
	stored.delete(key)
	stored.set(key, value)
	for (const old of stored.keys()) {
		if (stored.size <= KEPT) break
		stored.delete(old)
	}
}

export function dropCache(key: string) {
	stored.delete(key)
}

function loadCache<T>(key: string, read: () => Promise<T | null>): Promise<T | null> {
	const known = running.get(key)
	if (known !== undefined) return known as Promise<T | null>
	const promise = read()
		.then((value) => {
			if (value !== null) keepCache(key, value)
			return value
		})
		.finally(() => running.delete(key))
	running.set(key, promise)
	return promise
}

export const PALETTE_KEY = 'palette'

export function detailsKey(eventKey: string, version: string): string {
	return `details:${eventKey}|${version}`
}

export function commentsPath(ref: ScheduleOccurrenceRef): string {
	return ref.kind === 'single'
		? `/schedule/lessons/${ref.lessonId}/comments`
		: `/schedule/series/${ref.seriesId}/occurrences/${ref.originalOn}/comments`
}

export function commentsKey(path: string): string {
	return `comments:${path}`
}

export async function readPalette(signal?: AbortSignal): Promise<GoogleEventPalette | null> {
	const result = await apiRequest<unknown>('GET', '/google/colors', undefined, { signal })
	const parsed = result.ok ? googleEventPalette.safeParse(result.data) : null
	return parsed?.success ? parsed.data : null
}

export async function readDetails(
	eventKey: string,
	signal?: AbortSignal
): Promise<{ kind: 'ready'; data: CalendarEventDetails } | { kind: 'removed' } | { kind: 'error' }> {
	const result = await apiRequest<unknown>('GET', `/google/events/${encodeURIComponent(eventKey)}`, undefined, {
		signal,
	})
	if (!result.ok) return result.status === 404 ? { kind: 'removed' } : { kind: 'error' }
	const parsed = calendarEventDetails.safeParse(result.data)
	return parsed.success ? { kind: 'ready', data: parsed.data } : { kind: 'error' }
}

export async function readComments(path: string): Promise<LessonComment[] | null> {
	const result = await apiRequest<LessonCommentsResponse>('GET', path)
	if (!result.ok) return null
	keepCache(commentsKey(path), result.data.comments)
	return result.data.comments
}

type Task = { key: string; read: () => Promise<unknown> }

function rank(event: CalendarEventView, now: Date, today: string, zone: string): number {
	if (event.when.kind === 'all_day') return event.when.startsOn <= today && today < event.when.endsBefore ? 0 : 2
	if (lessonDay(new Date(event.when.startsAt), zone) === today) return 0
	return calendarLesson(event) && Date.parse(event.when.endsAt) > now.getTime() ? 1 : 2
}

function distance(event: CalendarEventView, now: Date): number {
	const start = event.when.kind === 'timed' ? Date.parse(event.when.startsAt) : Date.parse(event.when.startsOn)
	return Math.abs(start - now.getTime())
}

export function prefetchOrder(events: readonly CalendarEventView[], now: Date, zone: string): CalendarEventView[] {
	const today = lessonDay(now, zone)
	return [...events].sort(
		(left, right) =>
			rank(left, now, today, zone) - rank(right, now, today, zone) || distance(left, now) - distance(right, now)
	)
}

function taskFor(event: CalendarEventView, now: Date): Task | null {
	if (event.eventKey.startsWith('optimistic:')) return null
	if (calendarLesson(event)) {
		if (Date.parse(event.when.startsAt) > now.getTime()) return null
		const path = commentsPath(event.binding.ref)
		return { key: commentsKey(path), read: () => readComments(path) }
	}
	return {
		key: detailsKey(event.eventKey, event.version),
		read: async () => {
			const result = await readDetails(event.eventKey)
			return result.kind === 'ready' ? result.data : null
		},
	}
}

export function useSchedulePrefetch(
	events: readonly CalendarEventView[],
	now: Date,
	zone: string | null,
	active: boolean
) {
	const latest = useRef({ events, now })
	useEffect(() => {
		latest.current = { events, now }
	})
	const fingerprint = events.map((event) => `${event.eventKey}|${event.version}`).join(',')
	useEffect(() => {
		if (!active || zone === null) return
		let live = true
		const run = async () => {
			if (peekCache(PALETTE_KEY) === undefined) await loadCache(PALETTE_KEY, () => readPalette())
			const { events: shown, now: at } = latest.current
			for (const event of prefetchOrder(shown, at, zone)) {
				if (!live) return
				const task = taskFor(event, at)
				if (task === null || peekCache(task.key) !== undefined) continue
				await loadCache(task.key, task.read)
			}
		}
		void run()
		return () => {
			live = false
		}
	}, [fingerprint, zone, active])
}
