import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'

import {
	googleConnectionSnapshot,
	googleScheduleWindow,
	type GoogleScheduleWindow,
} from '../packages/contracts/src/calendar.ts'
import { api } from './support/api.ts'
import { calendarEvidence } from './support/calendar-evidence.ts'
import { AUTH_FILE, BASE } from './support/data.ts'
import { mondayOf, vnToday } from './support/dates.ts'
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

async function week(request: APIRequestContext, requestId: string) {
	try {
		const response = await request.get<unknown>(`${BASE}/api/schedule/week?start=${mondayOf(vnToday())}`, {
			headers: { origin: BASE, 'x-request-id': requestId },
		})
		try {
			if (response.status() !== 200) throw new Error('Week read failed')
			if (response.headers()['x-request-id'] !== requestId) throw new Error('Week request correlation failed')
			const value: unknown = await response.json()
			const parsed = googleScheduleWindow.safeParse(value)
			if (!parsed.success) throw new Error('Week response failed validation')
			return parsed.data
		} finally {
			await response.dispose()
		}
	} catch {
		throw new Error('Public Calendar week read failed; request and calendar contents suppressed')
	}
}

test('[calendar] refresh evidence observes the first public week read after real consent', async ({ page }) => {
	test.info().annotations.push({
		type: 'precondition',
		description:
			'Attested TEST account PRIMARY; saved teacher auth before real consent; same API process and private log; first Calendar read; run with --no-deps because setup opens Schedule.',
	})
	const before = await connection(page.request)
	if (before.state !== 'connected') throw new Error('Complete real TEST account consent before this journey')
	const evidence = calendarEvidence()
	const requestId = randomUUID()
	const result = await week(page.request, requestId)
	if (result.read.state !== 'fresh') throw new Error('Public Calendar week read must be fresh')
	const publicRead = await assertPublicRead(evidence, requestId, result)
	expect(result.connection.state).toBe('connected')
	expect(result.connection.allowedActions.includes('reconnect'), 'Reconnect is not required').toBe(false)
	expect(result.connection.generation).toBe(before.generation)
	expect(result.connection.calendar?.id === before.calendar?.id, 'PRIMARY target is unchanged').toBe(true)
	expect(
		JSON.stringify(result.snapshotRange) === JSON.stringify(result.requestedRange),
		'Complete requested window'
	).toBe(true)
	const matching = evidence
		.read()
		.filter((entry) => entry.requestId === requestId && entry.value.event === 'google_access_refreshed')
	if (matching.length !== 1)
		throw new Error('Expected one actual refresh; cached or missing observation is not evidence')
	const refresh = matching[0].value
	if (refresh.event !== 'google_access_refreshed' || !refresh.priorAccess)
		throw new Error('Actual refresh requires an observed prior access issuance and expiry')
	const prior = refresh.priorAccess
	const consent = evidence
		.history()
		.find(
			(entry) =>
				entry.value.observerSha256 === prior.sourceEvent.observerSha256 &&
				entry.value.sequence === prior.sourceEvent.sequence
		)?.value
	if (consent?.event !== 'google_consent_accepted')
		throw new Error('Run as the first Calendar read after a real consent recorded in this log')
	expect(JSON.stringify(consent.access) === JSON.stringify(prior), 'Prior access comes from accepted consent').toBe(
		true
	)
	expect(JSON.stringify(consent.identity) === JSON.stringify(refresh.identity), 'Same accepted grant').toBe(true)
	expect(refresh.observerSha256 === consent.observerSha256, 'Same API process after consent').toBe(true)
	expect(refresh.deployedCommit === consent.deployedCommit, 'Same deployed build').toBe(true)
	expect(refresh.sequence > consent.sequence, 'Refresh follows accepted consent').toBe(true)
	expect(refresh.identity.connectionGeneration).toBe(result.connection.generation)
	expect(refresh.providerSuccess).toBe(true)
	expect(refresh.generationCasCommitted).toBe(true)
	expect(refresh.credentialGenerationBefore).toBe(prior.credentialGeneration)
	expect(refresh.credentialGenerationAfter).toBe(refresh.credentialGenerationBefore + 1)
	expect(
		JSON.stringify(publicRead.identity) === JSON.stringify(refresh.identity),
		'Public read uses refreshed grant'
	).toBe(true)
	expect(publicRead.credentialGeneration).toBe(refresh.credentialGenerationAfter)
	expect(publicRead.deployedCommit === refresh.deployedCommit, 'Public read uses refreshed build').toBe(true)
	const ordered = [
		prior.issuedAt,
		consent.acceptedAt,
		refresh.startedAt,
		refresh.providerSucceededAt,
		refresh.committedAt,
		publicRead.providerReadAt,
		result.read.fetchedAt,
	]
	for (let index = 1; index < ordered.length; index++)
		expect(Date.parse(ordered[index]) >= Date.parse(ordered[index - 1]), 'Actual server UTC ordering').toBe(true)
	expect(Date.parse(prior.expiresAt) > Date.parse(prior.issuedAt), 'Prior expiry is recorded').toBe(true)
	expect(
		Date.parse(refresh.expiresAt) > Date.parse(refresh.providerSucceededAt),
		'Actual refreshed access expiry'
	).toBe(true)
})

async function assertPublicRead(
	evidence: ReturnType<typeof calendarEvidence>,
	requestId: string,
	result: GoogleScheduleWindow
) {
	await expect
		.poll(() =>
			evidence.read().some((entry) => entry.requestId === requestId && entry.value.event === 'google_public_week_read')
		)
		.toBe(true)
	const entries = evidence.read().filter((entry) => entry.requestId === requestId)
	const completed = entries.filter((entry) => entry.value.event === 'google_public_week_read')
	if (completed.length !== 1 || result.read.state !== 'fresh')
		throw new Error('Missing complete public read observation')
	const read = completed[0].value
	if (read.event !== 'google_public_week_read') throw new Error('Unexpected public read observation')
	const provider = entries.find(
		(entry) =>
			entry.value.observerSha256 === read.providerSourceEvent.observerSha256 &&
			entry.value.sequence === read.providerSourceEvent.sequence
	)?.value
	if (provider?.event !== 'google_calendar_window_read') throw new Error('Missing actual provider read source')
	expect(
		entries.some((entry) => entry.value.event === 'google_public_week_read_unverified'),
		'No failed public read outcome'
	).toBe(false)
	expect(JSON.stringify(read.identity) === JSON.stringify(provider.identity), 'Same provider grant').toBe(true)
	expect(read.credentialGeneration).toBe(provider.credentialGeneration)
	expect(read.readRevision).toBe(result.read.revision)
	expect(read.readRevision).toBe(provider.readRevision)
	expect(read.identity.connectionGeneration).toBe(result.connection.generation)
	expect(read.deployedCommit === provider.deployedCommit, 'Same provider build').toBe(true)
	expect(read.providerReadAt).toBe(provider.providerReadAt)
	expect(read.requestedAt).toBe(provider.requestedAt)
	expect(read.providerAcknowledged).toBe(true)
	expect(read.coverage).toBe('complete')
	expect(read.delivery).toBe('server-response-finished')
	expect(read.responseStatus).toBe(200)
	const times = [
		read.requestedAt,
		read.providerReadAt,
		result.read.fetchedAt,
		provider.publishedAt,
		provider.capturedAt,
		read.completedAt,
	]
	for (let index = 1; index < times.length; index++)
		expect(
			Date.parse(times[index]) >= Date.parse(times[index - 1]),
			'Provider, publication and actual response UTC ordering'
		).toBe(true)
	return read
}

async function rejectedWeek(request: APIRequestContext, query: string, requestId: string) {
	try {
		const response = await request.get<unknown>(`${BASE}/api/schedule/week?start=${query}`, {
			headers: { 'x-request-id': requestId },
		})
		try {
			if (response.headers()['x-request-id'] !== requestId) throw new Error('Request correlation failed')
			return response.status()
		} finally {
			await response.dispose()
		}
	} catch {
		throw new Error('Rejected Calendar read request failed; request details suppressed')
	}
}

test('[calendar] public read evidence rejects invalid and anonymous week requests', async ({ page, playwright }) => {
	const evidence = calendarEvidence()
	const anonymous = await playwright.request.newContext({ storageState: { cookies: [], origins: [] } })
	try {
		for (const input of [
			{ request: page.request, query: 'invalid-date', status: 400 },
			{ request: anonymous, query: mondayOf(vnToday()), status: 401 },
		]) {
			const requestId = randomUUID()
			expect(await rejectedWeek(input.request, input.query, requestId)).toBe(input.status)
			await expect.poll(() => evidence.read().some((entry) => entry.requestId === requestId)).toBe(true)
			const entries = evidence.read().filter((entry) => entry.requestId === requestId)
			expect(entries.length).toBe(1)
			const outcome = entries[0].value
			if (outcome.event !== 'google_public_week_read_unverified')
				throw new Error('Rejected read produced success evidence')
			expect(outcome.responseStatus).toBe(input.status)
			expect(outcome.reason).toBe('http_error')
		}
	} finally {
		await anonymous.dispose()
	}
})
