import { Hono } from 'hono'

import {
	createLessonSchema,
	listLessonsQuerySchema,
	markAttendanceSchema,
	updateLessonSchema,
	type AttendanceMutationResponse,
	type LessonMutationResponse,
	type LessonsResponse,
} from '@teacher-crm/api-types'

import { validateJson, validateQuery } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { lessonService } from '../services/lesson-service'
import { memoryStore } from '../services/memory-store'

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
		const lesson = await lessonService.createLesson(actor, context.req.valid('json'))
		memoryStore.ensureCalendarSyncRecord(actor, lesson.id)
		const response: LessonMutationResponse = { ok: true, lesson }
		return context.json(response, 201)
	})
	.patch('/:lessonId', requirePermission('lessons', 'write'), validateJson(updateLessonSchema), async (context) => {
		const actor = actorFromContext(context)
		const lesson = await lessonService.updateLesson(actor, context.req.param('lessonId'), context.req.valid('json'))
		if (!lesson) return context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Lesson not found' } }, 404)
		memoryStore.ensureCalendarSyncRecord(actor, lesson.id, 'not_synced')
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
