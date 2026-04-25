import { Hono } from 'hono'

import { createStudentSchema, updateStudentSchema } from '@teacher-crm/api-types'

import { validateJson } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { memoryStore } from '../services/memory-store'

export const studentRoutes = new Hono()
	.get('/', requirePermission('students', 'read'), (context) =>
		context.json({ ok: true, students: memoryStore.listStudents(actorFromContext(context)) }, 200)
	)
	.post('/', requirePermission('students', 'write'), validateJson(createStudentSchema), (context) => {
		return context.json(
			{ ok: true, student: memoryStore.createStudent(actorFromContext(context), context.req.valid('json')) },
			201
		)
	})
	.patch('/:studentId', requirePermission('students', 'write'), validateJson(updateStudentSchema), (context) => {
		const student = memoryStore.updateStudent(
			actorFromContext(context),
			context.req.param('studentId'),
			context.req.valid('json')
		)
		if (!student) return context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Student not found' } }, 404)
		return context.json({ ok: true, student }, 200)
	})
	.post('/:studentId/archive', requirePermission('students', 'archive'), (context) => {
		const student = memoryStore.archiveStudent(actorFromContext(context), context.req.param('studentId'))
		if (!student) return context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Student not found' } }, 404)
		return context.json({ ok: true, student }, 200)
	})
