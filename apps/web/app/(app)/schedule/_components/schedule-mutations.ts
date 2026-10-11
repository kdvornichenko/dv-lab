import { apiRequest } from '@/lib/api-client'

import type {
	ErrorCode,
	LessonMarkKind,
	LessonRepeats,
	ScheduleCreateResponse,
	ScheduleLessonResponse,
	ScheduleMarkResponse,
	ScheduleOccurrenceRef,
	ScheduleOccurrenceResponse,
	ScheduleSeriesResponse,
	ScheduleWeekday,
} from '@dv-lab/contracts'

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

export type LessonChange = ScheduleOccurrenceResponse | ScheduleLessonResponse

export type MutationResult<T> =
	| { kind: 'ok'; data: T; status: number }
	| { kind: 'stale' }
	| { kind: 'zone_changed' }
	| { kind: 'gap' }
	| { kind: 'failed'; code: ErrorCode | null }

type NewTarget = { kind: 'new' }

function pathOf(target: ScheduleOccurrenceRef | RuleTarget | NewTarget, action: string): string {
	if (target.kind === 'new') return '/schedule/lessons'
	if (target.kind === 'single') return `/schedule/lessons/${encodeURIComponent(target.lessonId)}/${action}`
	if (target.kind === 'series') {
		return `/schedule/series/${encodeURIComponent(target.seriesId)}/occurrences/${encodeURIComponent(target.originalOn)}/${action}`
	}
	return `/schedule/series/${encodeURIComponent(target.seriesId)}/${action}`
}

export function changedStart(data: LessonChange): string {
	return 'occurrence' in data ? data.occurrence.startsAt : data.lesson.startsAt
}

export function mutate(
	target: ScheduleOccurrenceRef,
	action: 'cancel' | 'restore',
	body?: LessonBody
): Promise<MutationResult<LessonChange>>
export function mutate(
	target: ScheduleOccurrenceRef,
	action: 'move',
	body: MoveLessonBody
): Promise<MutationResult<LessonChange>>
export function mutate(
	target: NewTarget,
	action: 'create',
	body: CreateLessonBody
): Promise<MutationResult<ScheduleCreateResponse>>
export function mutate(
	target: RuleTarget,
	action: 'move',
	body: MoveSeriesBody
): Promise<MutationResult<ScheduleSeriesResponse>>
export function mutate(
	target: RuleTarget,
	action: 'end',
	body: EndSeriesBody
): Promise<MutationResult<ScheduleSeriesResponse>>
export async function mutate(
	target: ScheduleOccurrenceRef | RuleTarget | NewTarget,
	action: string,
	body?: LessonBody | MoveLessonBody | MoveSeriesBody | EndSeriesBody | CreateLessonBody
): Promise<MutationResult<LessonChange | ScheduleSeriesResponse | ScheduleCreateResponse>> {
	return post<LessonChange | ScheduleSeriesResponse | ScheduleCreateResponse>(pathOf(target, action), body ?? {})
}

async function post<T>(path: string, body: object): Promise<MutationResult<T>> {
	const result = await apiRequest<T>('POST', path, body)
	if (result.ok) return { kind: 'ok', data: result.data, status: result.status }
	if (result.error?.code === 'default_time_zone_changed') return { kind: 'zone_changed' }
	if (result.error?.code === 'nonexistent_local_time') return { kind: 'gap' }
	if (result.error?.code === 'lesson_changed' || result.status === 404) return { kind: 'stale' }
	return { kind: 'failed', code: result.error?.code ?? null }
}

export function markLesson(
	block: { ref: ScheduleOccurrenceRef; startsAt: string },
	kind: LessonMarkKind
): Promise<MutationResult<ScheduleMarkResponse>> {
	return post<ScheduleMarkResponse>(pathOf(block.ref, 'mark'), { kind, expectedStartsAt: block.startsAt })
}
