import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'

import { googleConnectionSnapshot } from '../packages/contracts/src/calendar.ts'
import { api } from './support/api.ts'
import { calendarEvidence } from './support/calendar-evidence.ts'
import { AUTH_FILE, BASE } from './support/data.ts'
import { record, text } from './support/input.ts'
import { expect, test as base } from './support/test.ts'

const test = base.extend({ trace: 'off', video: 'off', screenshot: 'off' })
test.use({ storageState: AUTH_FILE })

async function connection(request: APIRequestContext) {
	const result = googleConnectionSnapshot.safeParse(await api(request, 'GET', '/google/connection'))
	if (!result.success) throw new Error('Calendar connection response failed validation')
	return result.data
}

async function begin(request: APIRequestContext, requestId: string) {
	try {
		const response = await request.post<unknown>(`${BASE}/api/google/connect`, {
			headers: { origin: BASE, 'x-request-id': requestId },
			data: {},
		})
		try {
			if (!response.ok()) throw new Error('Consent start failed')
			const value: unknown = await response.json()
			const url = new URL(text(record(value).url))
			const state = text(url.searchParams.get('state'))
			if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new Error('Invalid state')
			return state
		} finally {
			await response.dispose()
		}
	} catch {
		throw new Error('Consent start failed; response details suppressed')
	}
}

async function deny(request: APIRequestContext, state: string) {
	try {
		const response = await request.get<unknown>(
			`${BASE}/api/google/callback?state=${encodeURIComponent(state)}&error=access_denied`,
			{ maxRedirects: 0 }
		)
		try {
			return { status: response.status(), location: response.headers()['location'] }
		} finally {
			await response.dispose()
		}
	} catch {
		throw new Error('Consent callback failed; request details suppressed')
	}
}

test('[calendar] refresh evidence rejects denial replay and invalid control without recording success', async ({
	page,
}) => {
	const before = await connection(page.request)
	const evidence = calendarEvidence()
	const firstId = randomUUID()
	const lastId = randomUUID()
	const state = await begin(page.request, firstId)
	const denied = await deny(page.request, state)
	expect(denied.status).toBe(303)
	expect(denied.location === '/settings?google=denied', 'Clean denial redirect').toBe(true)
	const replay = await deny(page.request, state)
	expect(replay.location === '/settings?google=invalid_state', 'Clean replay redirect').toBe(true)
	await api(page.request, 'POST', '/google/disconnect/confirm-revoked', { confirmed: false }, 400)
	const finalState = await begin(page.request, lastId)
	await deny(page.request, finalState)
	await expect.poll(() => evidence.read().some((entry) => entry.requestId === lastId)).toBe(true)
	const entries = evidence.read()
	const first = entries.find((entry) => entry.requestId === firstId)?.value
	const last = entries.find((entry) => entry.requestId === lastId)?.value
	if (first?.event !== 'google_consent_started' || last?.event !== 'google_consent_started')
		throw new Error('Missing live observer boundaries')
	expect(first.observerSha256 === last.observerSha256, 'Same live observer').toBe(true)
	expect(first.connectionSha256 === last.connectionSha256, 'Same connection').toBe(true)
	expect(last.sequence - first.sequence, 'No intervening acceptance or control events').toBe(1)
	expect(last.connectionGeneration).toBe(first.connectionGeneration)
	expect(Date.parse(last.capturedAt) >= Date.parse(first.capturedAt), 'System UTC ordering').toBe(true)
	expect(JSON.stringify(await connection(page.request)) === JSON.stringify(before), 'Grant is unchanged').toBe(true)
})
