'use client'

import { useEffect, useRef, useState } from 'react'

import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import type { CommandIntent, CommandResult } from '@/components/app/calendar-command-store'
import { apiRequest } from '@/lib/api-client'
import { calendarEventFor, canEditCalendarEvent, type CalendarLesson } from '@/lib/lesson-actions'

import {
	timeZoneIdentity,
	type CalendarCommandSnapshot,
	type CalendarSeriesContext,
	type ErrorCode,
	type GoogleScheduleWindow,
	type LessonMarkKind,
	type LessonRepeats,
	type ScheduleMarkResponse,
	type ScheduleOccurrenceRef,
	type ScheduleWeekday,
} from '@dv-lab/contracts'
import { mondayOf, scheduleDate } from '@dv-lab/core'

export const STALE_TITLE = 'This lesson was changed elsewhere'
export const STALE_LESSON = 'The schedule has been refreshed.'
export const STALE_DATES = 'The schedule has been refreshed. Check the dates and try again.'
export const STALE_DATE = 'The schedule has been refreshed. Check the date and try again.'

export type RuleTarget = { kind: 'rule'; seriesId: string }
export type LessonBody = { expectedStartsAt?: string }
export type MoveLessonBody = LessonBody & { date: string; startTime: string; expectedDefaultTimeZone: string }
export type MoveSeriesBody = {
	from: string
	weekday: ScheduleWeekday
	startTime: string
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
type Target = ScheduleOccurrenceRef | RuleTarget | { kind: 'new' }
type Body = LessonBody | MoveLessonBody | MoveSeriesBody | EndSeriesBody | CreateLessonBody
type Action = 'create' | 'move' | 'cancel' | 'restore' | 'end'
export type CalendarSelection = {
	mainTimeZone: string
	date: string
	event?: CalendarLesson
	series?: CalendarSeriesContext
}
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

function versionFor(window: GoogleScheduleWindow, target: Target, selection: CalendarSelection): string | null {
	if (window.read.state !== 'fresh') return null
	if (target.kind === 'new') return window.read.revision
	if (target.kind === 'rule') {
		const current = window.series.find((context) => context.series.id === target.seriesId)
		return current && selection.series && JSON.stringify(current.series) === JSON.stringify(selection.series.series)
			? current.version
			: null
	}
	const current = calendarEventFor(window, target)
	const previous = selection.event
	if (!current || !previous || !canEditCalendarEvent(current, window)) return null
	if (
		current.when.startsAt !== previous.when.startsAt ||
		current.when.endsAt !== previous.when.endsAt ||
		current.status !== previous.status
	)
		return null
	return current.binding.version
}

function operation(target: Target, action: Action): CalendarCommandSnapshot['operation'] {
	if (target.kind === 'rule') return action === 'end' ? 'end_series' : 'move_series'
	return action === 'end' ? 'end_series' : action
}

function selectedDate(target: Target, selection: CalendarSelection, body: Body) {
	if (target.kind === 'new' && 'date' in body) return body.date
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

	async function mutate(target: Target, action: Action, body: Body = {}): Promise<CalendarMutationResult> {
		if (selection === null || sending.current) return { kind: 'failed', code: 'command_pending' }
		if (entry?.command?.state === 'failed' && entry.command.nextAction !== 'retry_new_command')
			return { kind: 'failed', code: 'not_applied' }
		sending.current = true
		setPending(true)
		try {
			await controller.store.refresh()
			const date = selectedDate(target, selection, body)
			const window = await controller.readWindow(date)
			if (!alive.current) return { kind: 'detached' }
			if (window === null) return rejected('provider_unavailable')
			if (timeZoneIdentity(window.requestedRange.timeZone) !== timeZoneIdentity(selection.mainTimeZone))
				return rejected('default_time_zone_changed')
			if (scheduleDate(new Date(window.requestedRange.start), window.requestedRange.timeZone) !== mondayOf(date))
				return rejected('precondition_failed')
			if (window.write.state !== 'ready') return rejected(window.write.reason)
			const expectedVersion = versionFor(window, target, selection)
			if (expectedVersion === null) return rejected('precondition_failed')
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
