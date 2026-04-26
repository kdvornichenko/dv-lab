import { Hono } from 'hono'

import {
	createLessonSchema,
	listLessonsQuerySchema,
	markAttendanceSchema,
	updateLessonSchema,
	type AttendanceMutationResponse,
	type CreateLessonInput,
	type LessonMutationResponse,
	type LessonsResponse,
	type UpdateLessonInput,
} from '@teacher-crm/api-types'

import { validateJson, validateQuery } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { calendarService } from '../services/calendar-service'
import { lessonService } from '../services/lesson-service'

function addWeeks(isoDate: string, weeks: number) {
	const date = new Date(isoDate)
	date.setDate(date.getDate() + weeks * 7)
	return date.toISOString()
}

function repeatedLessonInput(input: CreateLessonInput, index: number): CreateLessonInput {
	return {
		...input,
		startsAt: addWeeks(input.startsAt, index),
		repeatWeekly: false,
		repeatCount: 1,
	}
}

async function syncLessonAutomatically(
	actor: ReturnType<typeof actorFromContext>,
	lessonId: string,
	options: { repeatWeekly?: boolean; singleOccurrence?: boolean; occurrenceStartsAt?: string } = {}
) {
	const connection = await calendarService.getCalendarConnection(actor)
	const hasGrant =
		connection.tokenAvailable && connection.requiredScopes.every((scope) => connection.grantedScopes.includes(scope))
	if (connection.status !== 'connected' || !hasGrant) {
		await calendarService.ensureCalendarSyncRecord(actor, lessonId)
		return
	}
	await calendarService.syncLessonToCalendar(actor, lessonId, options)
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

export const lessonRoutes = new Hono()
	.get('/', requirePermission('lessons', 'read'), validateQuery(listLessonsQuerySchema), async (context) => {
		const actor = actorFromContext(context)
		const response: LessonsResponse = {
			ok: true,
			lessons: await lessonService.listLessons(actor, context.req.valid('query')),
			attendance: await lessonService.listAttendance(actor),
		}
		return context.json(response, 200)
	})
	.post('/', requirePermission('lessons', 'write'), validateJson(createLessonSchema), async (context) => {
		const actor = actorFromContext(context)
		const input = context.req.valid('json')
		const lesson = await lessonService.createLesson(actor, repeatedLessonInput(input, 0))
		await syncLessonAutomatically(actor, lesson.id, { repeatWeekly: input.repeatWeekly })
		const response: LessonMutationResponse = { ok: true, lesson }
		return context.json(response, 201)
	})
	.patch('/:lessonId', requirePermission('lessons', 'write'), validateJson(updateLessonSchema), async (context) => {
		const actor = actorFromContext(context)
		const lessonId = context.req.param('lessonId')
		const input = context.req.valid('json')
		const allLessons = await lessonService.listLessons(actor, { status: 'all', studentId: '', dateFrom: '', dateTo: '' })
		const originalLesson = allLessons.find((lesson) => lesson.id === lessonId)
		const lesson = await lessonService.updateLesson(actor, lessonId, { ...input, applyToFuture: false })
		if (!lesson) return context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Lesson not found' } }, 404)
		await syncLessonAutomatically(actor, lesson.id, {
			repeatWeekly: input.repeatWeekly ?? lesson.repeatWeekly,
			singleOccurrence: Boolean(lesson.repeatWeekly && !input.applyToFuture),
			occurrenceStartsAt: originalLesson?.startsAt,
		})

		if (input.applyToFuture && originalLesson) {
			const originalStart = new Date(originalLesson.startsAt)
			const candidates = allLessons.filter(
				(candidate) =>
					candidate.id !== originalLesson.id &&
					new Date(candidate.startsAt).getTime() >= originalStart.getTime() &&
					sameSeriesSlot(originalLesson, candidate)
			)
			for (const candidate of candidates) {
				const updated = await lessonService.updateLesson(
					actor,
					candidate.id,
					futureSeriesPatch(input, originalLesson.startsAt, candidate.startsAt)
				)
				if (updated) await syncLessonAutomatically(actor, updated.id)
			}
		}

		const response: LessonMutationResponse = { ok: true, lesson }
		return context.json(response, 200)
	})
	.delete('/:lessonId', requirePermission('lessons', 'write'), async (context) => {
		const actor = actorFromContext(context)
		const lessonId = context.req.param('lessonId')
		const lesson = await lessonService.deleteLesson(actor, lessonId)
		if (!lesson) return context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Lesson not found' } }, 404)

		const response: LessonMutationResponse = { ok: true, lesson }
		return context.json(response, 200)
	})
	.post('/attendance', requirePermission('attendance', 'mark'), validateJson(markAttendanceSchema), async (context) => {
		const response: AttendanceMutationResponse = {
			ok: true,
			attendance: await lessonService.markAttendance(actorFromContext(context), context.req.valid('json')),
		}
		return context.json(response, 200)
	})
