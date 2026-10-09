import { Hono } from 'hono'
import { z } from 'zod'

import {
	type CreateStudentResponse,
	type DeactivateStudentResponse,
	type StudentListResponse,
	createStudentRequest,
} from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { createStudent, deactivateStudent, listStudents } from '../auth/accounts.ts'
import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { errorBody } from '../request-context.ts'

type StudentRouteDeps = { db: Database }

export function studentRoutes({ db }: StudentRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.post('/', async (c) => {
		const input = await readJson(c, createStudentRequest)
		if (!input) return c.json(errorBody('invalid_request', 'Invalid request'), 400)
		const outcome = await createStudent(db, input)
		if (outcome.kind === 'login_taken') {
			return c.json(errorBody('login_taken', 'This login is already taken'), 409)
		}
		const { student, generatedPassword } = outcome
		return c.json({ student, generatedPassword } satisfies CreateStudentResponse, 201)
	})

	routes.get('/', async (c) => c.json({ students: await listStudents(db) } satisfies StudentListResponse, 200))

	routes.post('/:id/deactivate', async (c) => {
		const id = z.uuid().safeParse(c.req.param('id'))
		if (!id.success) return c.json(errorBody('not_found', 'Not Found'), 404)
		const outcome = await deactivateStudent(db, id.data)
		if (outcome.kind === 'not_found') return c.json(errorBody('not_found', 'Not Found'), 404)
		return c.json({ student: outcome.student } satisfies DeactivateStudentResponse, 200)
	})

	return routes
}
