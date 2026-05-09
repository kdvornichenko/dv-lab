import type { CreateLessonInput, DeleteLessonQuery, Lesson, UpdateLessonInput } from '@teacher-crm/api-types'

import { calendarService } from './calendar-service'
import { lessonService } from './lesson-service'
import type { StoreScope } from './store-scope'

type LessonService = typeof lessonService
type CalendarService = typeof calendarService

type LessonWorkflowDeps = {
	lessons: LessonService
	calendar: CalendarService
}

const RECURRENCE_MATERIALIZATION_LIMIT = 520

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

function sameInstant(a: string, b: string) {
	return new Date(a).getTime() === new Date(b).getTime()
}

function isPastStart(startsAt: string, now = new Date()) {
	return new Date(startsAt).getTime() < now.getTime()
}

function autoStatusForStart(status: Lesson['status'], startsAt: string, now = new Date()): Lesson['status'] {
	return status === 'planned' && isPastStart(startsAt, now) ? 'completed' : status
}

function firstWeeklyOccurrenceOnOrAfter(startsAt: string, cutoff: Date) {
	const occurrence = new Date(startsAt)
	for (let index = 0; occurrence.getTime() < cutoff.getTime() && index < RECURRENCE_MATERIALIZATION_LIMIT; index += 1) {
		occurrence.setDate(occurrence.getDate() + 7)
	}
	return occurrence.toISOString()
}

function weeklyOccurrencesBefore(startsAt: string, cutoffStartsAt: string) {
	const cutoff = new Date(cutoffStartsAt)
	const occurrence = new Date(startsAt)
	const occurrences: string[] = []
	for (let index = 0; occurrence.getTime() < cutoff.getTime() && index < RECURRENCE_MATERIALIZATION_LIMIT; index += 1) {
		occurrences.push(occurrence.toISOString())
		occurrence.setDate(occurrence.getDate() + 7)
	}
	return occurrences
}

function recurrenceUntilBefore(startsAt: string) {
	return new Date(new Date(startsAt).getTime() - 1000).toISOString()
}

function lessonInputFromLesson(
	lesson: Lesson,
	patch: UpdateLessonInput,
	startsAt: string,
	repeatWeekly: boolean,
	now = new Date()
): CreateLessonInput {
	const status = patch.status ?? lesson.status
	return {
		title: patch.title ?? lesson.title,
		startsAt,
		durationMinutes: patch.durationMinutes ?? lesson.durationMinutes,
		repeatWeekly,
		repeatCount: 1,
		topic: patch.topic ?? lesson.topic,
		notes: patch.notes ?? lesson.notes,
		status: autoStatusForStart(status, startsAt, now),
		studentIds: patch.studentIds ?? lesson.studentIds,
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
		options: {
			repeatWeekly?: boolean
			recurrenceUntil?: string
			singleOccurrence?: boolean
			occurrenceStartsAt?: string
			lessonOverride?: Lesson
		} = {}
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

	async function materializeRecurringOccurrencesBefore(actor: StoreScope, lesson: Lesson, cutoffStartsAt: string) {
		const exceptions = await deps.lessons.listOccurrenceExceptions(actor)
		const skippedStarts = new Set(
			exceptions
				.filter((exception) => exception.lessonId === lesson.id)
				.map((exception) => exception.occurrenceStartsAt)
		)
		const materialized: Lesson[] = []

		for (const startsAt of weeklyOccurrencesBefore(lesson.startsAt, cutoffStartsAt)) {
			if (skippedStarts.has(startsAt)) continue
			const occurrenceLesson = await deps.lessons.createLesson(actor, {
				title: lesson.title,
				startsAt,
				durationMinutes: lesson.durationMinutes,
				repeatWeekly: false,
				repeatCount: 1,
				topic: lesson.topic,
				notes: lesson.notes,
				status: autoStatusForStart(lesson.status, startsAt),
				studentIds: lesson.studentIds,
			})
			materialized.push(occurrenceLesson)
			await syncLessonAutomatically(actor, occurrenceLesson.id, { repeatWeekly: false })
		}

		return materialized
	}

	async function splitRecurringLessonAt(
		actor: StoreScope,
		originalLesson: Lesson,
		input: UpdateLessonInput,
		occurrenceStartsAt: string
	) {
		await materializeRecurringOccurrencesBefore(actor, originalLesson, occurrenceStartsAt)
		await syncLessonAutomatically(actor, originalLesson.id, {
			repeatWeekly: true,
			recurrenceUntil: recurrenceUntilBefore(occurrenceStartsAt),
		})

		const nextSeries = await deps.lessons.createLesson(
			actor,
			lessonInputFromLesson(
				originalLesson,
				input,
				input.startsAt ?? occurrenceStartsAt,
				input.repeatWeekly ?? originalLesson.repeatWeekly
			)
		)
		await syncLessonAutomatically(actor, nextSeries.id, { repeatWeekly: nextSeries.repeatWeekly })
		await deps.lessons.deleteLesson(actor, originalLesson.id)
		return nextSeries
	}

	return {
		async createLesson(actor: StoreScope, input: CreateLessonInput) {
			if (input.repeatWeekly && input.status === 'planned' && isPastStart(input.startsAt)) {
				const futureStartsAt = firstWeeklyOccurrenceOnOrAfter(input.startsAt, new Date())
				for (const startsAt of weeklyOccurrencesBefore(input.startsAt, futureStartsAt)) {
					const occurrenceLesson = await deps.lessons.createLesson(actor, {
						...input,
						startsAt,
						status: 'completed',
						repeatWeekly: false,
						repeatCount: 1,
					})
					await syncLessonAutomatically(actor, occurrenceLesson.id, { repeatWeekly: false })
				}
				const lesson = await deps.lessons.createLesson(actor, {
					...input,
					startsAt: futureStartsAt,
					status: 'planned',
					repeatWeekly: true,
					repeatCount: 1,
				})
				await syncLessonAutomatically(actor, lesson.id, { repeatWeekly: true })
				return lesson
			}

			const lesson = await deps.lessons.createLesson(
				actor,
				repeatedLessonInput({ ...input, status: autoStatusForStart(input.status, input.startsAt) }, 0)
			)
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
			if (
				originalLesson?.repeatWeekly &&
				input.applyToFuture === true &&
				input.occurrenceStartsAt &&
				!sameInstant(input.occurrenceStartsAt, originalLesson.startsAt)
			) {
				return splitRecurringLessonAt(actor, originalLesson, input, input.occurrenceStartsAt)
			}

			if (originalLesson?.repeatWeekly && input.occurrenceStartsAt && input.applyToFuture !== true) {
				const replacement = await deps.lessons.createLesson(actor, {
					title: input.title ?? originalLesson.title,
					startsAt: input.startsAt ?? input.occurrenceStartsAt,
					durationMinutes: input.durationMinutes ?? originalLesson.durationMinutes,
					repeatWeekly: false,
					repeatCount: 1,
					topic: input.topic ?? originalLesson.topic,
					notes: input.notes ?? originalLesson.notes,
					status: input.status ?? originalLesson.status,
					studentIds: input.studentIds ?? originalLesson.studentIds,
				})
				await deps.lessons.upsertOccurrenceException(actor, {
					lessonId: originalLesson.id,
					occurrenceStartsAt: input.occurrenceStartsAt,
					replacementLessonId: replacement.id,
					reason: 'moved',
				})
				await syncLessonAutomatically(actor, originalLesson.id, { repeatWeekly: originalLesson.repeatWeekly })
				await syncLessonAutomatically(actor, originalLesson.id, {
					singleOccurrence: true,
					occurrenceStartsAt: input.occurrenceStartsAt,
					lessonOverride: replacement,
				})
				return replacement
			}

			const currentPatch =
				originalLesson && !originalLesson.repeatWeekly && input.applyToFuture
					? { ...input, repeatWeekly: false, repeatCount: 1, applyToFuture: false }
					: { ...input, applyToFuture: false }
			const lesson = await deps.lessons.updateLesson(actor, lessonId, currentPatch)
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

		async deleteLesson(actor: StoreScope, lessonId: string, options: DeleteLessonQuery = { scope: 'series' }) {
			const allLessons: Lesson[] = await deps.lessons.listLessons(actor, {
				status: 'all',
				studentId: '',
				dateFrom: '',
				dateTo: '',
			})
			const originalLesson = allLessons.find((lesson) => lesson.id === lessonId)

			if (options.applyToFuture && options.occurrenceStartsAt && originalLesson?.repeatWeekly) {
				await materializeRecurringOccurrencesBefore(actor, originalLesson, options.occurrenceStartsAt)
				await syncLessonAutomatically(actor, originalLesson.id, {
					repeatWeekly: true,
					recurrenceUntil: recurrenceUntilBefore(options.occurrenceStartsAt),
				})
				await deps.lessons.deleteLesson(actor, lessonId)
				return originalLesson
			}

			if (options.scope === 'current' && options.occurrenceStartsAt) {
				if (originalLesson?.repeatWeekly) {
					await deps.lessons.upsertOccurrenceException(actor, {
						lessonId,
						occurrenceStartsAt: options.occurrenceStartsAt,
						reason: 'deleted',
					})
					await deps.calendar.deleteLessonFromCalendar(actor, lessonId, {
						singleOccurrence: true,
						occurrenceStartsAt: options.occurrenceStartsAt,
					})
					return originalLesson
				}
			}

			await deps.calendar.deleteLessonFromCalendar(actor, lessonId)
			const deleted = await deps.lessons.deleteLesson(actor, lessonId)

			if (options.applyToFuture && originalLesson) {
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
					await deps.calendar.deleteLessonFromCalendar(actor, candidate.id)
					await deps.lessons.deleteLesson(actor, candidate.id)
				}
			}

			return deleted
		},
	}
}

export const lessonWorkflowService = createLessonWorkflowService()
