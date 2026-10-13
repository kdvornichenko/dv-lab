'use client'

import { useEffect, useRef, useState } from 'react'

import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import type { CommandIntent, CommandResult } from '@/components/app/calendar-command-store'
import { apiRequest } from '@/lib/api-client'
import type { CalendarLesson } from '@/lib/lesson-actions'

import {
	timeZoneIdentity,
	type CalendarCommandSnapshot,
	type CalendarEditScope,
	type CalendarSeriesContext,
	type ErrorCode,
	type GoogleScheduleWindow,
	type LessonMarkKind,
	type LessonRepeats,
	type ScheduleMarkResponse,
	type ScheduleOccurrenceRef,
	type ScheduleWeekday,
	type UpdateCalendarEventRequest,
} from '@dv-lab/contracts'
import { mondayOf, scheduleDate } from '@dv-lab/core'

import { calendarVersionFor, type CalendarTarget } from './calendar-overlaps'

export const STALE_TITLE = 'This lesson was changed elsewhere'
export const STALE_LESSON = 'The schedule has been refreshed.'
export const STALE_DATE = 'The schedule has been refreshed. Check the date and try again.'

export type LessonBody = { expectedStartsAt?: string }
export type MoveLessonBody = LessonBody & {
	date: string
	startTime: string
	durationMinutes?: number
	expectedDefaultTimeZone: string
}
export type MoveSeriesBody = {
	from: string
	weekday: ScheduleWeekday
	startTime: string
	durationMinutes?: number
	expectedDefaultTimeZone: string
}
export type EndSeriesBody = { lastOn: string; expectedDefaultTimeZone: string }
export type CreateLessonBody = {
	studentId: string
	date: string
	startTime: string
	durationMinutes: number
	repeats: LessonRepeats
	expectedDefaultTimeZone: string
}
export type CreateEventBody = {
	title: string
	date: string
	startTime: string
	durationMinutes: number
	repeats: LessonRepeats
	colorId: string | null
	description: string | null
	location: string | null
	expectedDefaultTimeZone: string
}
export type UpdateEventBody = { scope: CalendarEditScope; changes: UpdateCalendarEventRequest['changes'] }
export type DeleteEventBody = { scope: CalendarEditScope }
export type AssignEventBody = { studentId: string }
export type EventTarget = { kind: 'event_new' } | { kind: 'event'; eventKey: string; version: string }
type Target = CalendarTarget | EventTarget
type Body =
	| LessonBody
	| MoveLessonBody
	| MoveSeriesBody
	| EndSeriesBody
	| CreateLessonBody
	| CreateEventBody
	| UpdateEventBody
	| DeleteEventBody
	| AssignEventBody
type Action =
	'create' | 'move' | 'cancel' | 'restore' | 'end' | 'event_create' | 'event_update' | 'event_delete' | 'assign'
export type CalendarSelection = {
	mainTimeZone: string
	date: string
	event?: CalendarLesson
	series?: CalendarSeriesContext
}

export type CheckedWindow = { window: GoogleScheduleWindow; isCurrent: () => boolean }
export type MutationResult<T> =
	| { kind: 'ok'; data: T; status: number }
	| { kind: 'stale' }
	| { kind: 'zone_changed' }
	| { kind: 'gap' }
	| { kind: 'failed'; code: ErrorCode | null }
export type CalendarMutationResult =
	| { kind: 'ok'; command: CalendarCommandSnapshot; window: GoogleScheduleWindow }
	| Exclude<MutationResult<never>, { kind: 'ok' }>
	| { kind: 'detached' }

function pathOf(target: Target, action: string): string {
	if (target.kind === 'event_new') return '/google/events'
	if (target.kind === 'event') {
		const suffix = action === 'event_delete' ? '/delete' : action === 'assign' ? '/assign' : ''
		return `/google/events/${encodeURIComponent(target.eventKey)}${suffix}`
	}
	if (target.kind === 'new') return '/schedule/lessons'
	if (target.kind === 'single') return `/schedule/lessons/${encodeURIComponent(target.lessonId)}/${action}`
	if (target.kind === 'series')
		return `/schedule/series/${encodeURIComponent(target.seriesId)}/occurrences/${encodeURIComponent(target.originalOn)}/${action}`
	return `/schedule/series/${encodeURIComponent(target.seriesId)}/${action}`
}

function rejected(code: ErrorCode | null): Exclude<CalendarMutationResult, { kind: 'ok' | 'detached' }> {
	if (code === 'default_time_zone_changed') return { kind: 'zone_changed' }
	if (code === 'nonexistent_local_time') return { kind: 'gap' }
	if (code === 'lesson_changed' || code === 'precondition_failed' || code === 'external_change' || code === 'not_found')
		return { kind: 'stale' }
	return { kind: 'failed', code }
}

function checkedConnection(window: GoogleScheduleWindow, connection: GoogleScheduleWindow['connection'] | null) {
	return (
		connection !== null &&
		connection.state === 'connected' &&
		connection.pendingCommandCount === 0 &&
		window.connection.generation === connection.generation &&
		window.connection.calendar?.id === connection.calendar?.id
	)
}

function eventVersionFor(window: GoogleScheduleWindow, target: EventTarget): string | null {
	if (window.read.state !== 'fresh') return null
	if (target.kind === 'event_new') return window.read.revision
	const current = window.events.find((event) => event.eventKey === target.eventKey)
	if (!current || current.version !== target.version || current.status === 'cancelled') return null
	return current.version
}

function validateWindow(
	window: GoogleScheduleWindow | null,
	selection: CalendarSelection,
	target: Target,
	date: string,
	checked: CheckedWindow | null | undefined,
	connection: GoogleScheduleWindow['connection'] | null
): { ok: true; window: GoogleScheduleWindow; expectedVersion: string } | { ok: false; code: ErrorCode } {
	if (!window) return { ok: false, code: 'provider_unavailable' }
	if (checked && !checked.isCurrent()) return { ok: false, code: 'precondition_failed' }
	if (checked !== undefined && !checkedConnection(window, connection)) return { ok: false, code: 'precondition_failed' }
	if (timeZoneIdentity(window.requestedRange.timeZone) !== timeZoneIdentity(selection.mainTimeZone))
		return { ok: false, code: 'default_time_zone_changed' }
	if (scheduleDate(new Date(window.requestedRange.start), window.requestedRange.timeZone) !== mondayOf(date))
		return { ok: false, code: 'precondition_failed' }
	if (window.write.state !== 'ready') return { ok: false, code: window.write.reason }
	const expectedVersion =
		target.kind === 'event' || target.kind === 'event_new'
			? eventVersionFor(window, target)
			: calendarVersionFor(window, target, {
					series: selection.series,
					previous: target.kind === 'new' || target.kind === 'rule' ? undefined : (selection.event ?? null),
				})
	return expectedVersion === null ? { ok: false, code: 'precondition_failed' } : { ok: true, window, expectedVersion }
}

function operation(target: Target, action: Action): CalendarCommandSnapshot['operation'] {
	if (target.kind === 'rule') return action === 'end' ? 'end_series' : 'move_series'
	return action === 'end' ? 'end_series' : action
}

function selectedDate(target: Target, selection: CalendarSelection, body: Body) {
	if ((target.kind === 'new' || target.kind === 'event_new') && 'date' in body) return body.date
	return selection.date
}

function mapCompletion(result: CommandResult): CalendarMutationResult {
	if (result.kind === 'applied') return { kind: 'ok', command: result.command, window: result.window }
	if (result.kind === 'detached') return result
	return rejected(result.code)
}

export function useScheduleMutation(selection: CalendarSelection | null) {
	const controller = useCalendarCommands()
	const [requestId, setRequestId] = useState<string | null>(null)
	const [pending, setPending] = useState(false)
	const alive = useRef(true)
	const sending = useRef(false)
	const current = useRef<string | null>(null)
	const entry = controller.view.entries.find((entry) => entry.requestId === requestId) ?? null

	useEffect(() => {
		alive.current = true
		return () => {
			alive.current = false
			current.current = null
		}
	}, [])

	async function mutate(
		target: Target,
		action: Action,
		body: Body = {},
		checkedWindow?: CheckedWindow | null
	): Promise<CalendarMutationResult> {
		if (selection === null || sending.current) return { kind: 'failed', code: 'command_pending' }
		if (entry?.command?.state === 'failed' && entry.command.nextAction !== 'retry_new_command')
			return { kind: 'failed', code: 'not_applied' }
		sending.current = true
		setPending(true)
		try {
			await controller.store.refresh()
			const date = selectedDate(target, selection, body)
			const found = checkedWindow === undefined ? await controller.readWindow(date) : (checkedWindow?.window ?? null)
			if (!alive.current) return { kind: 'detached' }
			const connection = controller.store.getSnapshot().connection
			const validated = validateWindow(found, selection, target, date, checkedWindow, connection)
			if (!validated.ok) return rejected(validated.code)
			const { window, expectedVersion } = validated
			const id = crypto.randomUUID()
			current.current = id
			setRequestId(id)
			const intent: CommandIntent = {
				path: pathOf(target, action),
				body,
				operation: operation(target, action),
				expectedVersion,
				generation: window.connection.generation,
				date: 'date' in body ? body.date : date,
			}
			const result = await controller.store.submit(id, intent)
			if (!alive.current || current.current !== id) return { kind: 'detached' }
			return mapCompletion(result)
		} finally {
			sending.current = false
			if (alive.current) setPending(false)
		}
	}

	function detach() {
		current.current = null
	}

	return { mutate, pending, entry, blocked: controller.blocked, detach }
}

export async function ignoreEvent(eventKey: string, version: string): Promise<MutationResult<null>> {
	const result = await apiRequest<unknown>('POST', `/google/events/${encodeURIComponent(eventKey)}/ignore`, {
		requestId: crypto.randomUUID(),
		expectedVersion: version,
	})
	if (result.ok) return { kind: 'ok', data: null, status: result.status }
	return rejected(result.error?.code ?? null)
}

async function postMark(path: string, body: object): Promise<MutationResult<ScheduleMarkResponse>> {
	const result = await apiRequest<ScheduleMarkResponse>('POST', path, body)
	if (result.ok) return { kind: 'ok', data: result.data, status: result.status }
	if (result.status === 404) return { kind: 'stale' }
	return rejected(result.error?.code ?? null)
}

export function markLesson(
	block: { ref: ScheduleOccurrenceRef; startsAt: string },
	kind: LessonMarkKind
): Promise<MutationResult<ScheduleMarkResponse>> {
	return postMark(pathOf(block.ref, 'mark'), { kind, expectedStartsAt: block.startsAt })
}
