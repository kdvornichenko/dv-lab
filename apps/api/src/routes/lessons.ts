import { Hono } from 'hono'

import {
	createLessonSchema,
	deleteLessonQuerySchema,
	listLessonsQuerySchema,
	markAttendanceSchema,
	updateLessonSchema,
	type AttendanceMutationResponse,
	type LessonMutationResponse,
	type LessonsResponse,
} from '@teacher-crm/api-types'

import { notFoundResponse } from '../http/errors'
import { validateJson, validateQuery } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { lessonService } from '../services/lesson-service'
import { lessonWorkflowService } from '../services/lesson-workflow-service'

export const lessonRoutes = new Hono()
	.get('/', requirePermission('lessons', 'read'), validateQuery(listLessonsQuerySchema), async (context) => {
		const actor = actorFromContext(context)
		const response: LessonsResponse = {
			ok: true,
			lessons: await lessonService.listLessons(actor, context.req.valid('query')),
			attendance: await lessonService.listAttendance(actor),
			occurrenceExceptions: await lessonService.listOccurrenceExceptions(actor),
		}
		return context.json(response, 200)
	})
	.post('/', requirePermission('lessons', 'write'), validateJson(createLessonSchema), async (context) => {
		const actor = actorFromContext(context)
		const input = context.req.valid('json')
		const lesson = await lessonWorkflowService.createLesson(actor, input)
		const response: LessonMutationResponse = { ok: true, lesson }
		return context.json(response, 201)
	})
	.patch('/:lessonId', requirePermission('lessons', 'write'), validateJson(updateLessonSchema), async (context) => {
		const actor = actorFromContext(context)
		const lessonId = context.req.param('lessonId')
		const input = context.req.valid('json')
		const lesson = await lessonWorkflowService.updateLesson(actor, lessonId, input)
		if (!lesson) return notFoundResponse(context, 'Lesson not found')
		const response: LessonMutationResponse = { ok: true, lesson }
		return context.json(response, 200)
	})
	.delete(
		'/:lessonId',
		requirePermission('lessons', 'write'),
		validateQuery(deleteLessonQuerySchema),
		async (context) => {
			const actor = actorFromContext(context)
			const lessonId = context.req.param('lessonId')
			const lesson = await lessonWorkflowService.deleteLesson(actor, lessonId, context.req.valid('query'))
			if (!lesson) return notFoundResponse(context, 'Lesson not found')

			const response: LessonMutationResponse = { ok: true, lesson }
			return context.json(response, 200)
		}
	)
	.post('/attendance', requirePermission('attendance', 'mark'), validateJson(markAttendanceSchema), async (context) => {
		const response: AttendanceMutationResponse = {
			ok: true,
			attendance: await lessonService.markAttendance(actorFromContext(context), context.req.valid('json')),
		}
		return context.json(response, 200)
	})
