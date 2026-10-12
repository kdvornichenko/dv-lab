import type { APIRequestContext } from '@playwright/test'

import { randomBytes } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { isStudentLogin } from '../../packages/contracts/src/identity.ts'
import { api } from './api.ts'
import {
	fixtureOwnership,
	NAMES,
	prepareState,
	PRIVATE_DIR,
	quote,
	registerFixture,
	reserveFixture,
	sql,
} from './data.ts'
import { integer, record, text, uuid } from './input.ts'
import { BASE, FIXTURE_DATABASE, readPrivateJson } from './target.ts'

const FILE = resolve(PRIVATE_DIR, 'navigation-account.json')
type Fixture = { name: (typeof NAMES)[number]; login: string; password: string; studentId: string | null }

function savedFixture(): Fixture {
	const row = record(readPrivateJson(FILE))
	const name = NAMES.find((candidate) => candidate === row.name)
	if (!name) throw new Error('Navigation fixture is outside its namespace')
	const login = text(row.login)
	if (!isStudentLogin(login)) throw new Error('Navigation fixture login is invalid')
	return {
		name,
		login,
		password: text(row.password),
		studentId: row.studentId === null ? null : uuid(row.studentId),
	}
}

function save(fixture: Fixture, fresh = false): void {
	writeFileSync(FILE, JSON.stringify(fixture), { mode: 0o600, flag: fresh ? 'wx' : 'w' })
}

function reserve(): Fixture {
	const name = NAMES.find((candidate) => {
		if (fixtureOwnership().some((entry) => entry.name === candidate)) return false
		return integer(sql(`select count(*)::int as n from students where display_name = ${quote(candidate)}`)[0]?.n) === 0
	})
	if (!name) throw new Error('Navigation has no free synthetic fixture slot')
	const fixture = {
		name,
		login: `nav.${randomBytes(10).toString('hex')}`,
		password: randomBytes(24).toString('base64url'),
		studentId: null,
	}
	save(fixture, true)
	reserveFixture(name)
	return fixture
}

async function createCard(request: APIRequestContext, fixture: Fixture): Promise<string> {
	const response = record(
		await api(request, 'POST', '/students', {
			displayName: fixture.name,
			rateMinor: null,
			currency: null,
			defaultLessonMinutes: 60,
			parent: null,
			level: null,
			goals: null,
			timeZone: null,
		})
	)
	const id = uuid(record(response.student).id)
	registerFixture(fixture.name, id, 'retained')
	save({ ...fixture, studentId: id })
	return id
}

export async function navigationStudent(request: APIRequestContext): Promise<{ login: string; password: string }> {
	if (BASE !== 'http://localhost:3000' || FIXTURE_DATABASE !== 'dev')
		throw new Error('Navigation account fixture requires the authorized existing local dev target')
	prepareState()
	const existing = existsSync(FILE)
	const fixture = existing ? savedFixture() : reserve()
	if (existing && fixture.studentId === null) throw new Error('Pending navigation fixture requires ownership recovery')
	const id = fixture.studentId ?? (await createCard(request, fixture))
	if (
		!fixtureOwnership().some(
			(entry) => entry.id === id && entry.name === fixture.name && entry.lifecycle === 'retained'
		)
	)
		throw new Error('Navigation fixture is not retained in the ownership ledger')
	const card = record(record(await api(request, 'GET', `/students/${id}`)).student)
	if (card.account === null) {
		await api(request, 'POST', `/students/${id}/account`, { login: fixture.login, password: fixture.password }, 201)
	} else {
		const account = record(card.account)
		if (text(account.login) !== fixture.login || text(account.status) !== 'active')
			throw new Error('Navigation account does not match its private fixture record')
	}
	return { login: fixture.login, password: fixture.password }
}
