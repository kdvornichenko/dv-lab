import type { APIRequestContext } from '@playwright/test'

import { readFileSync } from 'node:fs'
import { z } from 'zod'

import { googleConnectionSnapshot, googleScheduleWindow } from '../packages/contracts/src/calendar.ts'
import { api } from './support/api.ts'
import { conflictCreateUi, conflictReconnectUi } from './support/calendar-conflict-ui.ts'
import { conflictsJourney } from './support/calendar-conflicts.ts'
import { calendarFixtureRetention } from './support/calendar-ownership.ts'
import {
	calendarCachedNext,
	calendarNextPrefixRecovery,
	calendarWindowRecovery,
} from './support/calendar-read-recovery.ts'
import { conflictMoveUi, completeSeriesUi } from './support/calendar-series-ui.ts'
import { studentChoiceJourney } from './support/calendar-students.ts'
import { blockedHistoryUi, failedNoneUi, lostPostUi, pendingUi, recoveryUi } from './support/calendar-ui.ts'
import { AUTH_FILE, BASE, PRIVATE_DIR, teacherCredentials } from './support/data.ts'
import { mondayOf, vnToday } from './support/dates.ts'
import { record, text } from './support/input.ts'
import { expect, test } from './support/test.ts'

test.use({ storageState: { cookies: [], origins: [] } })

test('[calendar] student choices recover automatically in the selected week', async ({ page }) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
	await studentChoiceJourney(page)
})

test('[calendar] conflicts cover every interval and page without partial success', async ({ page }) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
	await conflictsJourney(page.request)
})

test('[calendar] conflict UI invalidates stale checks and keeps an empty explicit series range', async ({ page }) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
	await conflictCreateUi(page)
})

test('[calendar] conflict UI keeps a mounted draft across actual same-calendar reconnect', async ({ page }) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
	await conflictReconnectUi(page)
})

test('[calendar] ownership cleanup preserves retained cards and their registry', async ({ page }) => {
	await calendarFixtureRetention(page.request)
})

test('[calendar] conflict move keeps exact targets, natural series rules and refuses stale context', async ({
	page,
}) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
	await conflictMoveUi(page)
})

test('[calendar] complete UI series waits for ACK, resumes partial cuts and reloads confirmed rules', async ({
	page,
}) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
	await completeSeriesUi(page)
})

function observedCancellations(): unknown {
	try {
		return JSON.parse(readFileSync(`${PRIVATE_DIR}/calendar-cancellations.json`, 'utf8')) as unknown
	} catch {
		throw new Error('Observed synthetic cancellation fixture is required')
	}
}

test('[calendar] window stays unavailable without a connection and never returns local fallback', async ({ page }) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
	for (const start of ['2030-01-07', '2030-01-14', '2030-01-07']) {
		const parsed = googleScheduleWindow.safeParse(await api(page.request, 'GET', `/schedule/week?start=${start}`))
		if (!parsed.success) throw new Error('Calendar window response failed schema validation')
		const window = parsed.data
		expect(window.connection.state === 'not_connected', 'The fixture has no active Calendar connection').toBe(true)
		expect(window.read.state === 'unavailable', 'Disconnected window is unavailable').toBe(true)
		expect(window.write.state === 'blocked', 'Disconnected window blocks writes').toBe(true)
		expect(window.snapshotRange === null, 'No complete provider snapshot is claimed').toBe(true)
		expect(window.events.length === 0 && window.series.length === 0, 'No legacy fallback is published').toBe(true)
	}
})

test('[calendar] credential recovery refuses anonymous control requests', async ({ page }) => {
	for (const path of ['/google/disconnect', '/google/disconnect/confirm-revoked']) {
		const response = await page.request.post<unknown>(`${BASE}/api${path}`, {
			headers: { origin: BASE },
			data: { confirmed: true },
		})
		expect(response.status()).toBe(401)
		expect(response.headers()['cache-control']).toBe('no-store')
	}
})

test('[calendar] credential recovery requires explicit confirmation and same Origin', async ({ page }) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
	const before = await page.request.get<unknown>(`${BASE}/api/google/connection`)
	const beforeBody = record(await before.json())
	for (const body of [{}, { confirmed: false }, { confirmed: true, unexpected: true }]) {
		const response = await page.request.post<unknown>(`${BASE}/api/google/disconnect/confirm-revoked`, {
			headers: { origin: BASE },
			data: body,
		})
		expect(response.status()).toBe(400)
	}
	const foreign = await page.request.post<unknown>(`${BASE}/api/google/disconnect/confirm-revoked`, {
		headers: { origin: 'https://invalid.example' },
		data: { confirmed: true },
	})
	expect(foreign.status()).toBe(403)
	const after = await page.request.get<unknown>(`${BASE}/api/google/connection`)
	const afterBody = record(await after.json())
	if (before.status() === 200) {
		expect(after.status()).toBe(200)
		expect(JSON.stringify(afterBody) === JSON.stringify(beforeBody)).toBe(true)
	} else {
		expect(before.status()).toBe(503)
		expect(after.status()).toBe(503)
		expect(text(record(afterBody.error).code)).toBe('provider_unavailable')
	}
})

test('[calendar] oauth refuses anonymous access and strips callback input', async ({ page }) => {
	for (const path of ['/google/connection', '/google/callback?code=synthetic-code&state=synthetic-state']) {
		const response = await page.request.get<unknown>(`${BASE}/api${path}`, { maxRedirects: 0 })
		expect(response.status()).toBe(401)
		expect(response.headers()['cache-control']).toBe('no-store')
		expect(await response.text()).not.toContain('synthetic-code')
	}
})

const oauthTest = test.extend({
	trace: 'off',
	video: 'off',
	screenshot: 'off',
})

oauthTest.describe('calendar confirmed UI', () => {
	oauthTest.use({ storageState: AUTH_FILE })
	oauthTest('[calendar] complete UI foundation 202 waits for correlated apply and refresh', async ({ page }) => {
		await pendingUi(page)
	})
	oauthTest('[calendar] complete UI foundation lost POST and lookup 404 retry the same command', async ({ page }) => {
		await lostPostUi(page)
	})
	oauthTest(
		'[calendar] complete UI foundation projection pending survives reload without success',
		async ({ page }) => {
			await recoveryUi(page, 'projection_pending')
		}
	)
	oauthTest('[calendar] complete UI foundation recovery resumes only by explicit current action', async ({ page }) => {
		await recoveryUi(page, 'resume')
	})
	oauthTest('[calendar] complete UI foundation known failed retains draft and needs a new Save', async ({ page }) => {
		await failedNoneUi(page)
	})
	oauthTest('[calendar] complete UI foundation blocked calendar preserves historical marks', async ({ page }) => {
		await blockedHistoryUi(page)
	})
})

oauthTest.describe('teacher calendar reads', () => {
	oauthTest.use({ storageState: AUTH_FILE })
	oauthTest('[calendar] read recovery keeps complete snapshot after a real next-page failure', async ({ page }) => {
		await calendarWindowRecovery(page.request)
	})
	oauthTest(
		'[calendar] C2 prefix keeps known unknown and none distinct after a real next-page failure',
		async ({ page }) => {
			await calendarNextPrefixRecovery(page.request)
		}
	)
	oauthTest('[calendar] C2 cached mutation preserves the last-known next instant', async ({ page }) => {
		await calendarCachedNext(page.request)
	})
	oauthTest('[calendar] window remains complete after real synthetic cancellations', async ({ page }) => {
		const fixture = z
			.strictObject({
				kind: z.literal('observed-google-cancellations'),
				ownership: z.literal('dv-lab-synthetic'),
				weekStart: z.iso.date(),
				cases: z
					.array(
						z.strictObject({
							kind: z.enum(['single', 'occurrence']),
							eventKey: z.string().regex(/^[0-9a-f]{64}$/),
							cancelledAt: z.iso.datetime({ offset: true }),
						})
					)
					.min(2),
			})
			.safeParse(observedCancellations())
		if (!fixture.success) throw new Error('Observed synthetic cancellation fixture is required')
		expect(
			new Set(fixture.data.cases.map((item) => item.kind)).size === 2,
			'Single and recurring cancellations are required'
		).toBe(true)
		const parsed = googleScheduleWindow.safeParse(
			await api(page.request, 'GET', `/schedule/week?start=${fixture.data.weekStart}`)
		)
		if (!parsed.success) throw new Error('Calendar window response failed schema validation')
		expect(parsed.data.read.state === 'fresh', 'Real cancellations do not poison full reads').toBe(true)
		for (const fixtureEvent of fixture.data.cases) {
			const event = parsed.data.events.find((item) => item.eventKey === fixtureEvent.eventKey)
			expect(!event || event.status === 'cancelled', 'A cancelled synthetic event is never resurrected').toBe(true)
			expect(!event || !event.blocksTime, 'Cancelled events never block time').toBe(true)
		}
	})
	oauthTest('[calendar] window publishes complete provider facts on repeated reads', async ({ page }) => {
		let revision = -1n
		for (let attempt = 0; attempt < 2; attempt++) {
			const parsed = googleScheduleWindow.safeParse(
				await api(page.request, 'GET', `/schedule/week?start=${mondayOf(vnToday())}`)
			)
			if (!parsed.success) throw new Error('Calendar window response failed schema validation')
			const window = parsed.data
			expect(window.connection.state === 'connected', 'The attested synthetic grant is connected').toBe(true)
			expect(window.read.state === 'fresh', 'A complete provider traversal was published').toBe(true)
			if (window.read.state !== 'fresh') throw new Error('Fresh Calendar read required')
			expect(BigInt(window.read.revision) > revision, 'Read revision advances').toBe(true)
			revision = BigInt(window.read.revision)
			expect(
				JSON.stringify(window.snapshotRange) === JSON.stringify(window.requestedRange),
				'The entire requested range is covered'
			).toBe(true)
			expect(
				new Set(window.events.map((event) => event.eventKey)).size === window.events.length,
				'Provider identities are unique'
			).toBe(true)
			expect(
				window.events.every((event) => event.binding.kind !== 'external' || event.editBlock !== null),
				'External events remain read-only'
			).toBe(true)
		}
	})
})

oauthTest.describe('teacher calendar authorization', () => {
	oauthTest.use({ storageState: AUTH_FILE })

	async function readConnection(request: APIRequestContext) {
		const result = googleConnectionSnapshot.safeParse(await api(request, 'GET', '/google/connection'))
		if (!result.success) throw new Error('Calendar connection response failed schema validation')
		return result.data
	}

	async function callback(request: APIRequestContext, query: string) {
		return request.get<unknown>(`${BASE}/api/google/callback?${query}`, { maxRedirects: 0 }).catch(() => {
			throw new Error('OAuth callback request failed; request details suppressed')
		})
	}

	oauthTest(
		'[calendar] oauth rejects foreign Origin and invalid state without replacing the grant',
		async ({ page }) => {
			const before = await readConnection(page.request)
			const foreign = await page.request.post<unknown>(`${BASE}/api/google/connect`, {
				headers: { origin: 'https://invalid.example' },
				data: {},
			})
			expect(foreign.status()).toBe(403)
			for (const query of ['code=synthetic-code', 'state=' + 'x'.repeat(43) + '&code=synthetic-code']) {
				const response = await callback(page.request, query)
				expect(response.status()).toBe(303)
				expect(
					response.headers()['location'] === '/settings?google=invalid_state',
					'Clean invalid-state redirect'
				).toBe(true)
				expect(response.headers()['referrer-policy']).toBe('no-referrer')
				expect(response.headers()['cache-control']).toBe('no-store')
			}
			expect(JSON.stringify(await readConnection(page.request)) === JSON.stringify(before), 'Grant is unchanged').toBe(
				true
			)
		}
	)

	oauthTest(
		'[calendar] oauth consumes denial once and binds state to the initiating session',
		async ({ page, browser }) => {
			const before = await readConnection(page.request)
			const result = record(await api(page.request, 'POST', '/google/connect', {}))
			const authorization = new URL(text(result.url))
			const state = text(authorization.searchParams.get('state'))
			expect(/^[A-Za-z0-9_-]{43}$/.test(state), 'OAuth state has the expected format').toBe(true)
			expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
			const query = `state=${encodeURIComponent(state)}&error=access_denied`
			const other = await browser.newContext({ storageState: { cookies: [], origins: [] } })
			try {
				await api(other.request, 'POST', '/auth/sign-in', teacherCredentials())
				const wrongSession = await callback(other.request, query)
				expect(
					wrongSession.headers()['location'] === '/settings?google=invalid_state',
					'Clean wrong-session redirect'
				).toBe(true)
			} finally {
				await other.close()
			}
			const denied = await callback(page.request, query)
			expect(denied.headers()['location'] === '/settings?google=denied', 'Clean denial redirect').toBe(true)
			const replay = await callback(page.request, query)
			expect(replay.headers()['location'] === '/settings?google=invalid_state', 'Clean replay redirect').toBe(true)
			expect(JSON.stringify(await readConnection(page.request)) === JSON.stringify(before), 'Grant is unchanged').toBe(
				true
			)
		}
	)
})

test('[calendar] public pages keep the workspace private', async ({ page }) => {
	const response = await page.goto('/welcome')
	expect(response?.status()).toBe(200)
	await expect(page.getByRole('heading', { level: 1, name: 'dv-lab', exact: true })).toBeVisible()
	await expect(
		page.getByText('A private workspace for managing lessons, student records and lesson payments.')
	).toBeVisible()
	await page.keyboard.press('Tab')
	await expect(page.getByRole('navigation').getByRole('link', { name: 'dv-lab', exact: true })).toBeFocused()
	await page.keyboard.press('Tab')
	await expect(page.getByRole('navigation').getByRole('link', { name: 'Sign in', exact: true })).toBeFocused()
	await page.keyboard.press('Enter')
	await expect(page).toHaveURL(/\/login$/)
	for (const path of ['/', '/settings', '/welcome/private', '/privacy-extra', '/terms/private']) {
		await page.goto(path)
		await expect(page).toHaveURL(/\/login$/)
	}
})

test('[calendar] public policies describe calendar storage and recovery', async ({ page }) => {
	await page.setViewportSize({ width: 360, height: 800 })
	for (const [path, title] of [
		['/welcome', 'dv-lab'],
		['/privacy', 'Privacy policy'],
		['/terms', 'Terms'],
	] as const) {
		const response = await page.goto(path)
		expect(response?.status()).toBe(200)
		await expect(page).toHaveURL(new RegExp(`${path}$`))
		await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible()
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
		for (const [name, destination] of [
			['Home', '/welcome'],
			['Privacy policy', '/privacy'],
			['Terms', '/terms'],
		] as const) {
			const link = page.getByRole('contentinfo').getByRole('link', { name, exact: true })
			await expect(link).toHaveAttribute('href', destination)
			await link.focus()
			await page.keyboard.press('Enter')
			await expect(page).toHaveURL(new RegExp(`${destination}$`))
			await page.goto(path)
		}
	}
	await page.goto('/privacy')
	for (const section of [
		'Calendar access',
		'Information sent to Google',
		'Calendar information read and stored',
		'Background updates from Google',
		'Stored copy and retention',
		'Connection and request records',
		'Local teaching records',
		'Form recovery',
		'Authorization',
		'Data recipients',
		'Operational records',
		'Disconnecting',
		'Changes made in Google',
		'Chat assistant',
	])
		await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible()
	for (const disclosure of [
		'During a full reconcile, events outside that range or no longer present in Google are removed from it unless they are linked to a lesson.',
		'Access and refresh tokens are not sent to the browser.',
		'To preserve event settings, these records can include validated event descriptions, locations',
		'Attendee details, conference data and attachments are not kept in these supported snapshots',
		'Unsaved form inputs stay only in the memory of the open tab.',
		'Your local history, existing Google events, the stored copy, links and request records are kept.',
	])
		await expect(page.getByText(disclosure, { exact: false })).toBeVisible()
	await expect(
		page.getByText(
			'Event descriptions, attendee details, locations, meeting links and attachments are not stored or shown by this feature.',
			{ exact: false }
		)
	).toHaveCount(0)
	await page.goto('/terms')
	await expect(page.getByText('A pending or unknown result is not a saved change.', { exact: false })).toBeVisible()
	await expect(page.getByText('New offline calendar changes are not accepted.', { exact: false })).toBeVisible()
	await page.getByRole('main').getByRole('link', { name: 'Privacy policy', exact: true }).click()
	await expect(page).toHaveURL(/\/privacy$/)
})
