import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	SECTION_KINDS,
	type StudentResponse,
	type StudentSectionResponse,
	type StudentSectionsResponse,
	type StudentsResponse,
	openingBalanceRequest,
	saveSectionRequest,
	saveStudentRequest,
} from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import {
	archiveCard,
	createCard,
	getCard,
	listCards,
	restoreCard,
	setOpeningBalance,
	updateCard,
} from '../cards/cards.ts'
import { listSections, saveSection } from '../cards/sections.ts'
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

	routes.get('/', async (c) => c.json((await listCards(db)) satisfies StudentsResponse, 200))

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

	routes.patch('/:id', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, saveStudentRequest)
		if (!input) return invalidRequest(c)
		const student = await updateCard(db, id, input)
		if (!student) return notFound(c)
		return c.json({ student } satisfies StudentResponse, 200)
	})

	routes.post('/:id/archive', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const student = await archiveCard(db, id)
		if (!student) return notFound(c)
		return c.json({ student } satisfies StudentResponse, 200)
	})

	routes.post('/:id/restore', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const student = await restoreCard(db, id)
		if (!student) return notFound(c)
		return c.json({ student } satisfies StudentResponse, 200)
	})

	routes.put('/:id/opening-balance', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, openingBalanceRequest)
		if (!input) return invalidRequest(c)
		const student = await setOpeningBalance(db, id, input)
		if (!student) return notFound(c)
		return c.json({ student } satisfies StudentResponse, 200)
	})

	routes.get('/:id/sections', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const sections = await listSections(db, id)
		if (!sections) return notFound(c)
		return c.json({ sections } satisfies StudentSectionsResponse, 200)
	})

	routes.put('/:id/sections/:kind', async (c) => {
		const id = cardId(c)
		const kind = z.enum(SECTION_KINDS).safeParse(c.req.param('kind'))
		if (id === null || !kind.success) return notFound(c)
		const input = await readJson(c, saveSectionRequest)
		if (!input) return invalidRequest(c)
		const section = await saveSection(db, id, kind.data, input.body)
		if (!section) return notFound(c)
		return c.json({ section } satisfies StudentSectionResponse, 200)
	})

	return routes
}
