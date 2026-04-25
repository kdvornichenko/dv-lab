import { Hono } from 'hono'

import {
	createStudentSchema,
	listStudentsQuerySchema,
	updateStudentSchema,
	type ListStudentsResponse,
	type StudentMutationResponse,
} from '@teacher-crm/api-types'
import { can } from '@teacher-crm/rbac'

import { validateJson, validateQuery } from '../http/validation'
import { actorFromContext, requirePermission } from '../middleware/auth'
import { studentService } from '../services/student-service'

export const studentRoutes = new Hono()
	.get('/', requirePermission('students', 'read'), validateQuery(listStudentsQuerySchema), async (context) => {
		const response: ListStudentsResponse = {
			ok: true,
			students: await studentService.listStudents(actorFromContext(context), context.req.valid('query')),
		}
		return context.json(response, 200)
	})
	.post('/', requirePermission('students', 'write'), validateJson(createStudentSchema), async (context) => {
		const response: StudentMutationResponse = {
			ok: true,
			student: await studentService.createStudent(actorFromContext(context), context.req.valid('json')),
		}
		return context.json(response, 201)
	})
	.patch('/:studentId', requirePermission('students', 'write'), validateJson(updateStudentSchema), async (context) => {
		const input = context.req.valid('json')
		const user = context.get('user')

		if (input.status === 'archived' && !can(new Set(user?.permissions ?? []), 'students', 'archive')) {
			return context.json({ ok: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, 403)
		}

		const student = await studentService.updateStudent(actorFromContext(context), context.req.param('studentId'), input)
		if (!student) return context.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Student not found' } }, 404)
		const response: StudentMutationResponse = { ok: true, student }
		return context.json(response, 200)
	})
