import type { Context } from 'hono'
import { Hono } from 'hono'
import { z } from 'zod'

import {
	type AccountCandidatesResponse,
	type CreateStudentAccountResponse,
	SECTION_KINDS,
	type StudentAccountResponse,
	type StudentResponse,
	type StudentSectionResponse,
	type StudentSectionsResponse,
	type StudentTermResponse,
	type StudentTermsResponse,
	type StudentsResponse,
	addTermRequest,
	createStudentAccountRequest,
	deactivateStudentAccountRequest,
	linkStudentAccountRequest,
	openingBalanceRequest,
	saveSectionRequest,
	saveStudentRequest,
	updateTermNoteRequest,
} from '@dv-lab/contracts'
import type { Database } from '@dv-lab/db'

import { type AppEnv, noStore, readJson, requireRole, requireSession } from '../auth/middleware.ts'
import {
	cardAccountCandidates,
	createCardAccount,
	deactivateCardAccount,
	linkCardAccount,
} from '../cards/card-account.ts'
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
import { addTerm, deleteTerm, listTerms, updateTermNote } from '../cards/terms.ts'
import { errorBody } from '../request-context.ts'
import { readSnapshot } from '../schedule/rows.ts'
import { latestPaymentDate } from './payments.ts'

type StudentRouteDeps = { db: Database }

const invalidRequest = (c: Context<AppEnv>) => c.json(errorBody('invalid_request', 'Invalid request'), 400)

const notFound = (c: Context<AppEnv>) => c.json(errorBody('not_found', 'Not Found'), 404)

const cardHasAccount = (c: Context<AppEnv>) =>
	c.json(errorBody('card_has_account', 'This card already has an account'), 409)

function cardId(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('id'))
	return id.success ? id.data : null
}

function termIdParam(c: Context<AppEnv>): string | null {
	const id = z.uuid().safeParse(c.req.param('termId'))
	return id.success ? id.data : null
}

export function studentRoutes({ db }: StudentRouteDeps) {
	const routes = new Hono<AppEnv>()
	routes.use('*', noStore, requireSession(db), requireRole('teacher'))

	routes.get('/', async (c) => c.json((await readSnapshot(db, listCards)) satisfies StudentsResponse, 200))

	routes.post('/', async (c) => {
		const input = await readJson(c, saveStudentRequest)
		if (!input) return invalidRequest(c)
		const student = await createCard(db, input)
		return c.json({ student } satisfies StudentResponse, 201)
	})

	routes.get('/:id', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const student = await readSnapshot(db, (executor) => getCard(executor, id))
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
		if (input.on > latestPaymentDate(new Date())) return invalidRequest(c)
		const student = await setOpeningBalance(db, id, input)
		if (!student) return notFound(c)
		return c.json({ student } satisfies StudentResponse, 200)
	})

	routes.post('/:id/account', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, createStudentAccountRequest)
		if (!input) return invalidRequest(c)
		const result = await createCardAccount(db, id, { login: input.login, password: input.password })
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'login_taken') return c.json(errorBody('login_taken', 'This login is already taken'), 409)
		if (result.kind === 'card_has_account') return cardHasAccount(c)
		return c.json(
			{ account: result.account, generatedPassword: result.generatedPassword } satisfies CreateStudentAccountResponse,
			201
		)
	})

	routes.get('/:id/account/candidates', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const accounts = await cardAccountCandidates(db, id)
		if (!accounts) return notFound(c)
		return c.json({ accounts } satisfies AccountCandidatesResponse, 200)
	})

	routes.post('/:id/account/link', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, linkStudentAccountRequest)
		if (!input) return invalidRequest(c)
		const result = await linkCardAccount(db, id, input.accountId)
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'card_has_account') return cardHasAccount(c)
		if (result.kind === 'account_already_linked') {
			return c.json(errorBody('account_already_linked', 'This account is already linked to a card'), 409)
		}
		return c.json({ account: result.account } satisfies StudentAccountResponse, 200)
	})

	routes.post('/:id/account/deactivate', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, deactivateStudentAccountRequest)
		if (!input) return invalidRequest(c)
		const result = await deactivateCardAccount(db, id, input.accountId)
		if (result.kind === 'not_found') return notFound(c)
		return c.json({ account: result.account } satisfies StudentAccountResponse, 200)
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

	routes.get('/:id/terms', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const terms = await listTerms(db, id)
		if (!terms) return notFound(c)
		return c.json({ terms } satisfies StudentTermsResponse, 200)
	})

	routes.post('/:id/terms', async (c) => {
		const id = cardId(c)
		if (id === null) return notFound(c)
		const input = await readJson(c, addTermRequest)
		if (!input) return invalidRequest(c)
		const result = await addTerm(db, id, input)
		if (result.kind === 'not_found') return notFound(c)
		if (result.kind === 'term_exists') {
			return c.json(errorBody('term_exists', 'This term is already on the card'), 409)
		}
		return c.json({ term: result.term } satisfies StudentTermResponse, 201)
	})

	routes.patch('/:id/terms/:termId', async (c) => {
		const id = cardId(c)
		const termId = termIdParam(c)
		if (id === null || termId === null) return notFound(c)
		const input = await readJson(c, updateTermNoteRequest)
		if (!input) return invalidRequest(c)
		const term = await updateTermNote(db, id, termId, input.note)
		if (!term) return notFound(c)
		return c.json({ term } satisfies StudentTermResponse, 200)
	})

	routes.delete('/:id/terms/:termId', async (c) => {
		const id = cardId(c)
		const termId = termIdParam(c)
		if (id === null || termId === null) return notFound(c)
		if (!(await deleteTerm(db, id, termId))) return notFound(c)
		return c.body(null, 204)
	})

	return routes
}
