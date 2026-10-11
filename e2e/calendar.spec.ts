import { googleConnectionSnapshot } from '../packages/contracts/src/calendar.ts'
import { api } from './support/api.ts'
import { AUTH_FILE, BASE, teacherCredentials } from './support/data.ts'
import { record, text } from './support/input.ts'
import { expect, test } from './support/test.ts'

test.use({ storageState: { cookies: [], origins: [] } })

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

test.describe('teacher calendar authorization', () => {
	test.use({ storageState: AUTH_FILE })

	test('[calendar] oauth rejects foreign Origin and invalid state without replacing the grant', async ({ page }) => {
		const before = googleConnectionSnapshot.parse(await api(page.request, 'GET', '/google/connection'))
		const foreign = await page.request.post<unknown>(`${BASE}/api/google/connect`, {
			headers: { origin: 'https://invalid.example' },
			data: {},
		})
		expect(foreign.status()).toBe(403)
		for (const query of ['code=synthetic-code', 'state=' + 'x'.repeat(43) + '&code=synthetic-code']) {
			const response = await page.request.get<unknown>(`${BASE}/api/google/callback?${query}`, { maxRedirects: 0 })
			expect(response.status()).toBe(303)
			expect(response.headers()['location']).toBe('/settings?google=invalid_state')
			expect(response.headers()['referrer-policy']).toBe('no-referrer')
			expect(response.headers()['cache-control']).toBe('no-store')
		}
		expect(await api(page.request, 'GET', '/google/connection')).toEqual(before)
	})

	test('[calendar] oauth consumes denial once and binds state to the initiating session', async ({ page, browser }) => {
		const before = googleConnectionSnapshot.parse(await api(page.request, 'GET', '/google/connection'))
		const result = record(await api(page.request, 'POST', '/google/connect', {}))
		const authorization = new URL(text(result.url))
		const state = authorization.searchParams.get('state')
		expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/)
		expect(authorization.searchParams.get('code_challenge_method')).toBe('S256')
		const callback = `${BASE}/api/google/callback?state=${state}&error=access_denied`
		const other = await browser.newContext({ storageState: { cookies: [], origins: [] } })
		try {
			await api(other.request, 'POST', '/auth/sign-in', teacherCredentials())
			const wrongSession = await other.request.get<unknown>(callback, { maxRedirects: 0 })
			expect(wrongSession.headers()['location']).toBe('/settings?google=invalid_state')
		} finally {
			await other.close()
		}
		const denied = await page.request.get<unknown>(callback, { maxRedirects: 0 })
		expect(denied.headers()['location']).toBe('/settings?google=denied')
		const replay = await page.request.get<unknown>(callback, { maxRedirects: 0 })
		expect(replay.headers()['location']).toBe('/settings?google=invalid_state')
		expect(await api(page.request, 'GET', '/google/connection')).toEqual(before)
	})
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
		'Calendar view metadata',
		'Last checked view and retention',
		'Connection and request records',
		'Local teaching records',
		'Form recovery',
		'Authorization',
		'Data recipients',
		'Operational records',
		'Disconnecting',
		'Refreshing the view',
	])
		await expect(page.getByRole('heading', { level: 2, name: section, exact: true })).toBeVisible()
	for (const disclosure of [
		'This feature does not automatically delete the cache or history after a fixed period.',
		'Access and refresh tokens are not sent to the browser.',
		'Unsaved form inputs stay only in the memory of the open tab.',
		'Your local history, existing Google events, last checked view, links and request records are kept.',
	])
		await expect(page.getByText(disclosure, { exact: false })).toBeVisible()
	await page.goto('/terms')
	await expect(page.getByText('A pending or unknown result is not a saved change.', { exact: false })).toBeVisible()
	await expect(page.getByText('New offline calendar changes are not accepted.', { exact: false })).toBeVisible()
	await page.getByRole('main').getByRole('link', { name: 'Privacy policy', exact: true }).click()
	await expect(page).toHaveURL(/\/privacy$/)
})
