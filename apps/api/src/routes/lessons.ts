import { Hono } from 'hono'

import { createLessonSchema, markAttendanceSchema, updateLessonSchema } from '@teacher-crm/api-types'

import { validateJson } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { memoryStore } from '../services/memory-store'

export const lessonRoutes = new Hono()
	.get('/', requirePermission('lessons', 'read'), (context) =>
		context.json(
			{
				ok: true,
				lessons: memoryStore.listLessons(actorFromContext(context)),
				attendance: memoryStore.listAttendance(actorFromContext(context)),
			},
			200
		)
	)
	.post('/', requirePermission('lessons', 'write'), validateJson(createLessonSchema), (context) => {
		const actor = actorFromContext(context)
		const lesson = memoryStore.createLesson(actor, context.req.valid('json'))
		memoryStore.ensureCalendarSyncRecord(actor, lesson.id)
		return context.json({ ok: true, lesson }, 201)
	})
	.patch('/:lessonId', requirePermission('lessons', 'write'), validateJson(updateLessonSchema), (context) => {
		const lesson = memoryStore.updateLesson(
			actorFromContext(context),
			context.req.param('lessonId'),
			context.req.valid('json')
		)
		if (!lesson) return context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Lesson not found' } }, 404)
		return context.json({ ok: true, lesson }, 200)
	})
	.post('/attendance', requirePermission('attendance', 'mark'), validateJson(markAttendanceSchema), (context) => {
		return context.json(
			{ ok: true, attendance: memoryStore.markAttendance(actorFromContext(context), context.req.valid('json')) },
			200
		)
	})
