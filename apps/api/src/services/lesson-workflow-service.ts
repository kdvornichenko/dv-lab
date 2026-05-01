import type { CreateLessonInput, Lesson, UpdateLessonInput } from '@teacher-crm/api-types'

import { calendarService } from './calendar-service'
import { lessonService } from './lesson-service'
import type { StoreScope } from './store-scope'

type LessonService = typeof lessonService
type CalendarService = typeof calendarService

type LessonWorkflowDeps = {
	lessons: LessonService
	calendar: CalendarService
}

function addWeeks(isoDate: string, weeks: number) {
	const date = new Date(isoDate)
	date.setDate(date.getDate() + weeks * 7)
	return date.toISOString()
}

function repeatedLessonInput(input: CreateLessonInput, index: number): CreateLessonInput {
	return {
		...input,
		startsAt: addWeeks(input.startsAt, index),
		repeatWeekly: index === 0 ? input.repeatWeekly : false,
		repeatCount: 1,
	}
}

function sameSeriesSlot(
	reference: { startsAt: string; studentIds: string[] },
	candidate: { startsAt: string; studentIds: string[] }
) {
	const referenceStart = new Date(reference.startsAt)
	const candidateStart = new Date(candidate.startsAt)
	return (
		candidate.studentIds[0] === reference.studentIds[0] &&
		candidateStart.getDay() === referenceStart.getDay() &&
		candidateStart.getHours() === referenceStart.getHours() &&
		candidateStart.getMinutes() === referenceStart.getMinutes()
	)
}

function futureSeriesPatch(
	input: UpdateLessonInput,
	originalStartsAt: string,
	candidateStartsAt: string
): UpdateLessonInput {
	if (!input.startsAt) return input
	const shift = new Date(input.startsAt).getTime() - new Date(originalStartsAt).getTime()
	return {
		...input,
		startsAt: new Date(new Date(candidateStartsAt).getTime() + shift).toISOString(),
		applyToFuture: false,
	}
}

export function createLessonWorkflowService(
	deps: LessonWorkflowDeps = { lessons: lessonService, calendar: calendarService }
) {
	async function syncLessonAutomatically(
		actor: StoreScope,
		lessonId: string,
		options: { repeatWeekly?: boolean; singleOccurrence?: boolean; occurrenceStartsAt?: string } = {}
	) {
		const connection = await deps.calendar.getCalendarConnection(actor)
		const hasGrant =
			connection.tokenAvailable && connection.requiredScopes.every((scope) => connection.grantedScopes.includes(scope))
		if (connection.status !== 'connected' || !hasGrant) {
			await deps.calendar.ensureCalendarSyncRecord(actor, lessonId)
			return
		}
		await deps.calendar.syncLessonToCalendar(actor, lessonId, options)
	}

	return {
		async createLesson(actor: StoreScope, input: CreateLessonInput) {
			const lesson = await deps.lessons.createLesson(actor, repeatedLessonInput(input, 0))
			await syncLessonAutomatically(actor, lesson.id, { repeatWeekly: input.repeatWeekly })
			return lesson
		},

		async updateLesson(actor: StoreScope, lessonId: string, input: UpdateLessonInput) {
			const allLessons: Lesson[] = await deps.lessons.listLessons(actor, {
				status: 'all',
				studentId: '',
				dateFrom: '',
				dateTo: '',
			})
			const originalLesson = allLessons.find((lesson) => lesson.id === lessonId)
			const lesson = await deps.lessons.updateLesson(actor, lessonId, { ...input, applyToFuture: false })
			if (!lesson) return null

			await syncLessonAutomatically(actor, lesson.id, {
				repeatWeekly: input.repeatWeekly ?? lesson.repeatWeekly,
				singleOccurrence: Boolean(originalLesson?.repeatWeekly && !input.applyToFuture),
				occurrenceStartsAt: originalLesson?.startsAt,
			})

			if (input.applyToFuture && originalLesson) {
				const originalStart = new Date(originalLesson.startsAt)
				const candidates = allLessons.filter(
					(candidate) =>
						candidate.id !== originalLesson.id &&
						new Date(candidate.startsAt).getTime() >= originalStart.getTime() &&
						sameSeriesSlot(
							{ startsAt: originalLesson.startsAt, studentIds: originalLesson.studentIds },
							{ startsAt: candidate.startsAt, studentIds: candidate.studentIds }
						)
				)
				for (const candidate of candidates) {
					const updated = await deps.lessons.updateLesson(
						actor,
						candidate.id,
						futureSeriesPatch(input, originalLesson.startsAt, candidate.startsAt)
					)
					if (updated) await syncLessonAutomatically(actor, updated.id)
				}
			}

			return lesson
		},

		async deleteLesson(actor: StoreScope, lessonId: string) {
			await deps.calendar.deleteLessonFromCalendar(actor, lessonId)
			return deps.lessons.deleteLesson(actor, lessonId)
		},
	}
}

export const lessonWorkflowService = createLessonWorkflowService()
