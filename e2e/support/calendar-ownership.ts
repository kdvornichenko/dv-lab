import type { APIRequestContext } from '@playwright/test'

import { api, readStudent } from './api.ts'
import {
	BASE,
	cleanupFixtures,
	fixtureOwnership,
	NAMES,
	registerFixture,
	reserveFixture,
	teacherCredentials,
} from './data.ts'
import { record, uuid } from './input.ts'
import { expect } from './test.ts'

async function createOwnedCard(request: APIRequestContext, name: (typeof NAMES)[number], retained: boolean) {
	reserveFixture(name)
	const response = record(
		await api(request, 'POST', '/students', {
			displayName: name,
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
	registerFixture(name, id, retained ? 'retained' : 'disposable')
	return id
}

export async function calendarFixtureRetention(request: APIRequestContext) {
	await api(request, 'POST', '/auth/sign-in', teacherCredentials())
	let retainedId: string | null = null
	try {
		cleanupFixtures()
		const registry = fixtureOwnership()
		const available = NAMES.filter((name) => !registry.some((entry) => entry.name === name))
		const first = available[0]
		const second = available[1]
		if (!first || !second) throw new Error('Two unused synthetic fixture names are required')
		retainedId = await createOwnedCard(request, first, true)
		const disposableId = await createOwnedCard(request, second, false)
		registerFixture(first, retainedId)
		expect(
			fixtureOwnership().some((entry) => entry.id === retainedId && entry.lifecycle === 'retained'),
			'Repeated registration cannot downgrade a retained fixture'
		).toBe(true)
		cleanupFixtures()
		const kept = await readStudent(request, retainedId)
		expect(kept.id === retainedId, 'The real retained card survives disposable cleanup').toBe(true)
		const removed = await request.get<unknown>(`${BASE}/api/students/${disposableId}`)
		expect(removed.status(), 'The disposable card was removed through the approved persistence path').toBe(404)
		expect(
			fixtureOwnership().some((entry) => entry.id === retainedId && entry.lifecycle === 'retained'),
			'The retained identity stays in the durable ownership registry'
		).toBe(true)
		expect(
			fixtureOwnership().some((entry) => entry.id === disposableId),
			'The disposable identity leaves the registry'
		).toBe(false)
	} finally {
		try {
			if (retainedId) await api(request, 'POST', `/students/${retainedId}/archive`, {})
		} finally {
			await api(request, 'POST', '/auth/sign-out', undefined, 204)
		}
	}
}
