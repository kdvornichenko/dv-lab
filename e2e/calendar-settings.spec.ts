import type { Page } from '@playwright/test'

import { googleConnectionSnapshot, type GoogleConnectionSnapshot } from '@dv-lab/contracts'

import { api } from './support/api.ts'
import { teacherCredentials } from './support/data.ts'
import { expect, test } from './support/test.ts'

const settingsTest = test.extend({ trace: 'off', video: 'off', screenshot: 'off' })
settingsTest.use({ storageState: { cookies: [], origins: [] } })

const labels = {
	connect: 'Connect Google Calendar',
	reconnect: 'Reconnect',
	disconnect: 'Disconnect',
	retry_disconnect: 'Retry disconnect',
	confirm_revoked: 'Confirm access removed',
	switch: 'Connect another Google account',
} as const

async function snapshot(page: Page) {
	const result = googleConnectionSnapshot.safeParse(await api(page.request, 'GET', '/google/connection'))
	if (!result.success) throw new Error('Calendar snapshot is invalid; response suppressed')
	return result.data
}

async function requireAction(page: Page, action: keyof typeof labels) {
	const current = await snapshot(page)
	if (!current.allowedActions.includes(action)) throw new Error(`Prepare the authorized fixture for ${action}`)
	return current
}

function mutationAuthority() {
	if (process.env.E2E_CALENDAR_SETTINGS_MUTATIONS !== 'authorized')
		throw new Error('This scenario requires authorized synthetic calendar connection mutations')
}

async function openSettings(page: Page, query = 'tab=calendar') {
	await page.goto(`/settings?${query}`)
	await expect(page.getByRole('tab', { name: 'Google Calendar', exact: true })).toHaveAttribute('aria-selected', 'true')
	await expect(page.getByRole('heading', { level: 2, name: 'Connection', exact: true })).toBeVisible()
}

async function matchesSnapshot(page: Page, current: GoogleConnectionSnapshot) {
	await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled()
	const panel = page.getByRole('region', { name: 'Connection', exact: true })
	for (const action of Object.keys(labels) as (keyof typeof labels)[]) {
		const button = panel.getByRole('button', { name: labels[action], exact: true })
		expect((await button.count()) > 0, `Server action ${action}`).toBe(current.allowedActions.includes(action))
	}
	if (current.calendar !== null) {
		const content = await panel.textContent()
		expect(content?.includes(current.calendar.label), 'Actual calendar label is displayed').toBe(true)
		expect(content?.includes(current.calendar.timeZone), 'Actual calendar zone is displayed').toBe(true)
		await expect(
			page.getByText(`Unconfirmed changes: ${current.pendingCommandCount || 'None'}`, { exact: true })
		).toBeVisible()
	}
	for (const text of ['Live updates', 'Last full check', 'Events to review'])
		expect(await page.getByText(text, { exact: true }).count()).toBe(0)
	expect(await panel.getByRole('combobox').count()).toBe(0)
}

settingsTest.beforeEach(async ({ page }) => {
	await api(page.request, 'POST', '/auth/sign-in', teacherCredentials())
})

settingsTest.afterEach(async ({ page }) => {
	await api(page.request, 'POST', '/auth/sign-out')
})

settingsTest('[calendar] settings disabled provider and callback flag do not invent success', async ({ page }) => {
	await api(page.request, 'GET', '/google/connection', undefined, 503)
	await openSettings(page, 'google=connected')
	await expect(page.getByText('Could not load Google Calendar status.', { exact: true })).toBeVisible()
	expect(await page.getByText('Google Calendar connected', { exact: true }).count()).toBe(0)
	expect(await page.getByText('Unconfirmed changes: None', { exact: true }).count()).toBe(0)
	expect(new URL(page.url()).searchParams.has('google'), 'Callback flag was removed').toBe(false)
	await page.getByRole('tab', { name: 'General', exact: true }).click()
	await expect(page.getByRole('heading', { name: 'Default time zone', exact: true })).toBeVisible()
	await page.getByRole('tab', { name: 'Google Calendar', exact: true }).click()
	await page.reload()
	await expect(page.getByRole('tab', { name: 'Google Calendar', exact: true })).toHaveAttribute('aria-selected', 'true')
})

for (const state of [
	'not_connected',
	'connected',
	'reconnect_required',
	'permission_required',
	'disconnecting',
	'disconnect_failed',
] as const) {
	settingsTest(`[calendar] settings snapshot ${state} uses only server actions`, async ({ page }) => {
		const current = await snapshot(page)
		if (current.state !== state) throw new Error(`Prepare the authorized ${state} connection fixture`)
		await page.setViewportSize({ width: 390, height: 844 })
		await openSettings(page)
		await expect(page.getByRole('button', { name: 'Refresh status', exact: true })).toBeEnabled()
		await matchesSnapshot(page, current)
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
	})
}

settingsTest('[calendar] settings failed refresh clears stale actions and count', async ({ page }) => {
	const current = await snapshot(page)
	await openSettings(page)
	await matchesSnapshot(page, current)
	await page.route('**/api/google/connection', (route) => route.abort('failed'))
	await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
	await expect(page.getByText('Could not load Google Calendar status.', { exact: true })).toBeVisible()
	for (const label of Object.values(labels))
		expect(await page.getByRole('button', { name: label, exact: true }).count()).toBe(0)
	expect(await page.getByText(/^Unconfirmed changes:/).count()).toBe(0)
	await page.unroute('**/api/google/connection')
	await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
	await matchesSnapshot(page, await snapshot(page))
})

settingsTest('[calendar] settings denial does not replace a valid connection', async ({ page }) => {
	const before = await snapshot(page)
	if (before.state !== 'connected') throw new Error('Prepare an authorized connected calendar fixture')
	await openSettings(page, 'google=denied')
	await expect(
		page.getByText('Google Calendar was not connected. You can try again when you are ready.', { exact: true })
	).toBeVisible()
	await matchesSnapshot(page, before)
	expect(JSON.stringify(await snapshot(page)) === JSON.stringify(before), 'Existing grant is unchanged').toBe(true)
})

for (const action of ['connect', 'reconnect'] as const) {
	settingsTest(`[calendar] settings ${action} requires a fresh snapshot before consent`, async ({ page }) => {
		await requireAction(page, action)
		await openSettings(page)
		let sent = 0
		page.on('request', (request) => {
			if (new URL(request.url()).pathname === '/api/google/connect') sent += 1
		})
		await page.route('**/api/google/connection', (route) => route.abort('failed'))
		await page.getByRole('button', { name: labels[action], exact: true }).click()
		await expect(page.getByText('Could not load Google Calendar status.', { exact: true })).toBeVisible()
		expect(sent, 'No consent request after failed preflight').toBe(0)
	})
}

for (const action of ['disconnect', 'confirm_revoked'] as const) {
	settingsTest(`[calendar] settings ${action} confirmation starts with a safe exit`, async ({ page }) => {
		const before = await requireAction(page, action)
		await openSettings(page)
		const trigger = page.getByRole('button', { name: labels[action], exact: true })
		await trigger.click()
		const dialog = page.getByRole('dialog')
		await expect(
			dialog.getByRole('button', { name: action === 'disconnect' ? 'Keep connected' : 'Back', exact: true })
		).toBeFocused()
		await page.keyboard.press('Escape')
		await expect(dialog).toHaveCount(0)
		await expect(trigger).toBeFocused()
		expect(JSON.stringify(await snapshot(page)) === JSON.stringify(before), 'Cancelling preserves the connection').toBe(
			true
		)
	})
}

settingsTest('[calendar] settings lost disconnect reply never confirms before a fresh read', async ({ page }) => {
	mutationAuthority()
	await requireAction(page, 'disconnect')
	await openSettings(page)
	await page.getByRole('button', { name: 'Disconnect', exact: true }).click()
	await page.route('**/api/google/disconnect', async (route) => {
		const response = await route.fetch<unknown>()
		await response.dispose()
		await page.route('**/api/google/connection', (read) => read.abort('failed'))
		await route.abort('failed')
	})
	await page.getByRole('dialog').getByRole('button', { name: 'Disconnect', exact: true }).click()
	await expect(
		page
			.getByText('Could not confirm the disconnect request. Refresh the connection status before trying again.', {
				exact: true,
			})
			.first()
	).toBeVisible()
	expect(await page.getByText(/^Google Calendar disconnected\./).count()).toBe(0)
	await page.unroute('**/api/google/connection')
	await page.getByRole('dialog').getByRole('button', { name: 'Keep connected', exact: true }).click()
	await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
	await matchesSnapshot(page, await snapshot(page))
})

settingsTest(
	'[calendar] settings operator confirmation remains distinct from provider confirmation',
	async ({ page }) => {
		mutationAuthority()
		if (process.env.E2E_GOOGLE_ACCESS_REMOVED !== 'confirmed')
			throw new Error('Remove the authorized synthetic grant in Google Account before this scenario')
		await requireAction(page, 'confirm_revoked')
		await openSettings(page)
		await page.getByRole('button', { name: 'Confirm access removed', exact: true }).click()
		await page.getByRole('dialog').getByRole('button', { name: 'Confirm access removed', exact: true }).click()
		await expect(page.getByRole('dialog')).toHaveCount(0)
		await expect(
			page.getByText('Disconnected after your confirmation that Google access was removed.', { exact: true })
		).toBeVisible()
		const current = await snapshot(page)
		expect(current.state === 'not_connected' && current.disconnectResolution === 'operator_confirmed').toBe(true)
		await matchesSnapshot(page, current)
	}
)

settingsTest('[calendar] settings retry disconnect reports the actual server resolution', async ({ page }) => {
	mutationAuthority()
	await requireAction(page, 'retry_disconnect')
	await openSettings(page)
	await page.getByRole('button', { name: 'Retry disconnect', exact: true }).click()
	await expect.poll(async () => (await snapshot(page)).state !== 'disconnecting', { timeout: 30000 }).toBe(true)
	await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
	const current = await snapshot(page)
	await matchesSnapshot(page, current)
	if (current.state === 'not_connected') {
		expect(current.disconnectResolution === 'provider_confirmed').toBe(true)
		await expect(page.getByText(/^Google Calendar disconnected\./)).toBeVisible()
	} else {
		expect(current.state === 'disconnect_failed').toBe(true)
		await expect(
			page.getByText('Calendar changes are stopped. Google access removal is not confirmed.', { exact: true })
		).toBeVisible()
	}
})
