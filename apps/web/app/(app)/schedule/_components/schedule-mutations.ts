import { apiRequest } from '@/lib/api-client'

import type {
	ErrorCode,
	LessonMarkKind,
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

export type LessonAction = 'move' | 'cancel' | 'restore'

export type LessonBody = { date?: string; startTime?: string; expectedStartsAt?: string }

export type MoveSeriesBody = { from: string; weekday: ScheduleWeekday; startTime: string }

export type EndSeriesBody = { lastOn: string }

export type LessonChange = ScheduleOccurrenceResponse | ScheduleLessonResponse

export type MutationResult<T> = { kind: 'ok'; data: T } | { kind: 'stale' } | { kind: 'failed'; code: ErrorCode | null }

function pathOf(target: ScheduleOccurrenceRef | RuleTarget, action: string): string {
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
	action: LessonAction,
	body?: LessonBody
): Promise<MutationResult<LessonChange>>
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
	target: ScheduleOccurrenceRef | RuleTarget,
	action: string,
	body?: LessonBody | MoveSeriesBody | EndSeriesBody
): Promise<MutationResult<LessonChange | ScheduleSeriesResponse>> {
	return post<LessonChange | ScheduleSeriesResponse>(pathOf(target, action), body ?? {})
}

async function post<T>(path: string, body: object): Promise<MutationResult<T>> {
	const result = await apiRequest<T>('POST', path, body)
	if (result.ok) return { kind: 'ok', data: result.data }
	if (result.status === 409 || result.status === 404) return { kind: 'stale' }
	return { kind: 'failed', code: result.error?.code ?? null }
}

export function markLesson(
	block: { ref: ScheduleOccurrenceRef; startsAt: string },
	kind: LessonMarkKind
): Promise<MutationResult<ScheduleMarkResponse>> {
	return post<ScheduleMarkResponse>(pathOf(block.ref, 'mark'), { kind, expectedStartsAt: block.startsAt })
}
