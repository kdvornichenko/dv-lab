import { expect, type Locator, type Page, type Request } from '@playwright/test'

import { readSettings } from './api.ts'
import { record, text, uuid } from './input.ts'
import { navigationStudent } from './navigation-account.ts'

async function clickTiming(link: Locator): Promise<number> {
	await link.evaluate((element) => {
		element.addEventListener(
			'click',
			() => {
				const start = performance.now()
				const observer = new MutationObserver(() => {
					if (element.getAttribute('aria-current') !== 'page') return
					observer.disconnect()
					requestAnimationFrame(() => element.setAttribute('data-navigation-ms', String(performance.now() - start)))
				})
				observer.observe(element, { attributes: true, attributeFilter: ['aria-current'] })
			},
			{ once: true }
		)
	})
	await link.click()
	await expect(link).toHaveAttribute('aria-current', 'page', { timeout: 250 })
	await expect(link).toHaveAttribute('data-navigation-ms', /\d/)
	const result = Number(await link.getAttribute('data-navigation-ms'))
	expect(result).toBeLessThan(250)
	return result
}

async function signIn(page: Page): Promise<void> {
	const login = process.env.DEV_TEACHER_LOGIN
	const password = process.env.DEV_TEACHER_PASSWORD
	if (!login || !password) throw new Error('Navigation requires dev teacher credentials in the process environment')
	await page.goto('/login')
	await page.getByLabel('Login or email').fill(login)
	await page.locator('#password').fill(password)
	await page.getByRole('button', { name: 'Sign in to dv-lab' }).click()
	await page.waitForURL('http://localhost:3000/')
}

async function saveThreshold(page: Page, input: Locator, value: string): Promise<void> {
	await input.fill(value)
	const saved = page.waitForResponse(
		(response) => response.url().endsWith('/api/settings') && response.request().method() === 'PATCH',
		{ timeout: 10000 }
	)
	await input.press('Enter')
	expect((await saved).status()).toBe(200)
	await expect(input).toBeEnabled()
}

async function studentsState(page: Page): Promise<void> {
	await page.locator('a[href="/students"]').first().click()
	const search = page.getByRole('searchbox', { name: 'Search students', exact: true })
	await search.fill('__navigation_cache_probe__')
	const body = page.getByText('No students found', { exact: true })
	await expect(body).toBeVisible()
	await page.locator('a[href="/settings"]').first().click()
	await expect(page).toHaveURL(/\/settings$/)
	let reads = 0
	const count = (request: Request) => {
		if (new URL(request.url()).pathname === '/api/students' && request.method() === 'GET') reads += 1
	}
	page.on('request', count)
	const start = Date.now()
	await page.locator('a[href="/students"]').first().click()
	await expect(search).toHaveValue('__navigation_cache_probe__', { timeout: 250 })
	await expect(body).toBeVisible({ timeout: 250 })
	page.off('request', count)
	console.log(JSON.stringify({ navigation: 'students-retained-body', ms: Date.now() - start, reads }))
	await page.locator('a[href="/settings"]').first().click()
	await expect(page).toHaveURL(/\/settings$/)
}

async function sessionIsolation(page: Page, threshold: Locator): Promise<void> {
	const original = Number(await threshold.inputValue())
	const changed = String(original === 0 ? 1 : original - 1)
	try {
		await saveThreshold(page, threshold, changed)
		console.log(JSON.stringify({ navigation: 'mutation-saved', status: 'passed' }))
		await page.locator('a[href="/students"]').first().click()
		await page.getByRole('heading', { name: 'Students', exact: true }).waitFor()
		await page.locator('a[href="/settings"]').first().click()
		await expect(threshold).toHaveValue(changed)
	} finally {
		await page.goto('/settings')
		await expect(threshold).toBeEnabled()
		if (Number(await threshold.inputValue()) !== original) await saveThreshold(page, threshold, String(original))
	}
	await threshold.fill(`0${original}`)
	await page.getByRole('button', { name: 'Open account menu' }).click()
	await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
	await expect(page).toHaveURL(/\/login$/)
	expect((await page.request.get<unknown>('/api/auth/me')).status()).toBe(401)
	await page.goBack()
	await expect(page).toHaveURL(/\/login/)
	await expect(page.getByLabel('Pays soon threshold (lessons)')).toHaveCount(0)
	await signIn(page)
	await page.locator('a[href="/settings"]').first().click()
	await expect(threshold).toHaveValue(String(original))
	await threshold.fill(`0${original}`)
	const otherTab = await page.context().newPage()
	try {
		await otherTab.goto('/')
		await otherTab.getByRole('button', { name: 'Open account menu' }).click()
		await otherTab.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
		await expect(page).toHaveURL(/\/login/)
		await expect(threshold).toHaveCount(0)
		await signIn(otherTab)
		await page.goto('/settings')
		await expect(threshold).toHaveValue(String(original))
	} finally {
		await otherTab.close()
	}
	console.log(JSON.stringify({ navigation: 'mutation-session-isolation', status: 'passed', role: 'teacher' }))
}

export async function navigationJourney(page: Page): Promise<void> {
	await signIn(page)
	const me = await page.request.get<unknown>('/api/auth/me')
	const identity: unknown = await me.json()
	expect(me.status()).toBe(200)
	expect(identity).toMatchObject({ account: { role: 'teacher' } })
	const settings = page.locator('a[href="/settings"]').first()
	const feedback = await clickTiming(settings)
	console.log(JSON.stringify({ navigation: 'uncached-feedback', ms: feedback, role: 'teacher' }))
	await page.getByRole('heading', { name: 'Settings', exact: true }).waitFor()
	await expect(page).toHaveURL(/\/settings$/)
	const threshold = page.getByLabel('Pays soon threshold (lessons)')
	await expect(threshold).toBeEnabled()
	const draft = `0${await threshold.inputValue()}`
	await threshold.fill(draft)
	let rsc = 0
	let settingsReads = 0
	page.on('request', (request) => {
		const url = new URL(request.url())
		if (url.searchParams.has('_rsc')) rsc += 1
		if (url.pathname === '/api/settings' && request.method() === 'GET') settingsReads += 1
	})
	const tabStart = Date.now()
	const historyBefore = await page.evaluate(() => history.length)
	await page.getByRole('tab', { name: 'Google Calendar', exact: true }).click()
	await expect(page.getByRole('tab', { name: 'Google Calendar', exact: true })).toHaveAttribute(
		'aria-selected',
		'true',
		{
			timeout: 250,
		}
	)
	await expect(page).toHaveURL(/\/settings\?tab=calendar$/)
	expect(rsc).toBe(0)
	expect(settingsReads).toBe(0)
	console.log(
		JSON.stringify({
			navigation: 'settings-tab',
			ms: Date.now() - tabStart,
			rsc,
			historyBefore,
			historyAfter: await page.evaluate(() => history.length),
		})
	)
	await page.goBack()
	console.log(JSON.stringify({ navigation: 'back', path: new URL(page.url()).pathname + new URL(page.url()).search }))
	await expect(page.getByRole('tab', { name: 'General', exact: true })).toHaveAttribute('aria-selected', 'true')
	await expect(threshold).toHaveValue(draft)
	await page.goForward()
	await expect(page.getByRole('tab', { name: 'Google Calendar', exact: true })).toHaveAttribute('aria-selected', 'true')
	await page.getByRole('tab', { name: 'General', exact: true }).click()
	await page.locator('a[href="/students"]').first().click()
	await page.getByRole('heading', { name: 'Students', exact: true }).waitFor()
	const revisit = Date.now()
	const previousRsc = rsc
	const previousReads = settingsReads
	await page.locator('a[href="/settings"]').first().click()
	await expect(threshold).toHaveValue(draft, { timeout: 500 })
	console.log(
		JSON.stringify({
			navigation: 'revisit-state',
			ms: Date.now() - revisit,
			rsc: rsc - previousRsc,
			settingsReads: settingsReads - previousReads,
		})
	)
	await studentsState(page)
	await page.goto('/settings?google=denied')
	await expect(page.getByRole('tab', { name: 'Google Calendar', exact: true })).toHaveAttribute('aria-selected', 'true')
	await page.getByRole('tab', { name: 'General', exact: true }).click()
	await expect(page).toHaveURL(/\/settings\?tab=general$/)
	await sessionIsolation(page, threshold)
}

async function studentBody(page: Page): Promise<void> {
	await expect(page.getByRole('heading', { name: /^Signed in as / })).toBeVisible()
	await teacherBodyAbsent(page)
}

async function teacherBodyAbsent(page: Page): Promise<void> {
	expect(await page.getByRole('button', { name: 'Open account menu' }).count()).toBe(0)
	expect(await page.getByLabel('Pays soon threshold (lessons)').count()).toBe(0)
	expect(await page.getByRole('searchbox', { name: 'Search students', exact: true }).count()).toBe(0)
	for (const name of ['Today', 'Settings', 'Students', 'Schedule'])
		expect(await page.getByRole('heading', { name, exact: true }).count()).toBe(0)
}

export async function navigationIdentityJourney(page: Page): Promise<void> {
	page.setDefaultTimeout(10000)
	await signIn(page)
	const teacher = record(record(await (await page.request.get<unknown>('/api/auth/me')).json()).account)
	expect(text(teacher.role)).toBe('teacher')
	const settingsBefore = await readSettings(page.request)
	const credentials = await navigationStudent(page.request)
	await page.locator('a[href="/settings"]').first().click()
	await expect(page.getByLabel('Pays soon threshold (lessons)')).toBeEnabled()
	await page.locator('a[href="/students"]').first().click()
	await expect(page.getByRole('searchbox', { name: 'Search students', exact: true })).toBeVisible()
	await page.getByRole('button', { name: 'Open account menu' }).click()
	await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
	await expect(page).toHaveURL((url) => url.pathname === '/login')
	await page.waitForLoadState('load')
	expect((await page.request.get<unknown>('/api/auth/me')).status()).toBe(401)
	let privilegedReads = 0
	const count = (request: Request) => {
		if (/^\/api\/(students|settings|today|schedule)(\/|$)/.test(new URL(request.url()).pathname)) privilegedReads += 1
	}
	page.on('request', count)
	try {
		await page.getByLabel('Login or email').fill(credentials.login)
		await page.locator('#password').fill(credentials.password)
		await page.getByRole('button', { name: 'Sign in to dv-lab' }).click()
	} catch {
		throw new Error('Owned student public login failed; credential details suppressed')
	}
	await expect(page).toHaveURL('http://localhost:3000/')
	const student = record(record(await (await page.request.get<unknown>('/api/auth/me')).json()).account)
	expect(text(student.role)).toBe('student')
	expect(uuid(student.id) !== uuid(teacher.id)).toBe(true)
	try {
		await studentBody(page)
		await page.goBack({ waitUntil: 'commit' })
		await teacherBodyAbsent(page)
		await studentBody(page)
		for (const path of ['/settings', '/students', '/schedule']) {
			await page.goto(path)
			await studentBody(page)
		}
		expect(privilegedReads).toBe(0)
		for (const path of ['/api/students', '/api/settings', '/api/today', '/api/schedule/week?start=2026-10-12'])
			expect((await page.request.get<unknown>(path)).status()).toBe(403)
	} finally {
		page.off('request', count)
		await page.getByRole('button', { name: 'Sign out', exact: true }).click()
		await expect(page).toHaveURL((url) => url.pathname === '/login')
	}
	await signIn(page)
	expect(JSON.stringify(await readSettings(page.request)) === JSON.stringify(settingsBefore)).toBe(true)
	await page.getByRole('button', { name: 'Open account menu' }).click()
	await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
	await expect(page).toHaveURL((url) => url.pathname === '/login')
	console.log(
		JSON.stringify({
			navigation: 'different-identity',
			teacher: 'passed',
			student: 'passed',
			privilegedReads,
			deniedReads: 4,
			settings: 'unchanged',
			cleanup: 'passed',
		})
	)
}
