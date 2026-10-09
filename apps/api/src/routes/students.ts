import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	type DeactivateStudentResponse,
	type StudentListResponse,
	type StudentResponse,
	saveStudentRequest,
} from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { deactivateStudent, listStudents } from '../auth/accounts.ts'
import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import { createCard, getCard } from '../cards/cards.ts'
import { errorBody } from '../request-context.ts'

type StudentRouteDeps = { db: Database }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

function cardId(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('id'))
	return id.success ? id.data : null
}

export function studentRoutes({ db }: StudentRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => c.json({ students: await listStudents(db) } satisfies StudentListResponse, 200))

	routes.post('/', async (c) => {
		const input = await readJson(c, saveStudentRequest)
		if (!input) return invalidRequest(c)
		const student = await createCard(db, input)
		return c.json({ student } satisfies StudentResponse, 201)
	})

	routes.get('/:id', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const student = await getCard(db, id)
		if (!student) return notFound(c)
		return c.json({ student } satisfies StudentResponse, 200)
	})

	routes.post('/:id/deactivate', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const outcome = await deactivateStudent(db, id)
		if (outcome.kind === 'not_found') return notFound(c)
		return c.json({ student: outcome.student } satisfies DeactivateStudentResponse, 200)
	})

	return routes
}
