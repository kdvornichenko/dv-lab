import { test as setup, expect } from '@playwright/test'

import { teacherId } from './support/api.ts'
import ensureCalendarTarget from './support/calendar.ts'
import {
	BASE,
	cleanupFixtures,
	prepareState,
	restoreTeacherSettings,
	saveAuth,
	saveTeacherSettings,
	teacherCredentials,
} from './support/data.ts'
import { assertDayWindow } from './support/dates.ts'

setup('teacher signs in once', async ({ page }) => {
	await ensureCalendarTarget()
	assertDayWindow()
	prepareState()
	cleanupFixtures()
	const { login, password } = teacherCredentials()
	try {
		await page.goto('/login')
		await page.getByLabel('Login or email', { exact: true }).fill(login)
		await page.locator('#password').fill(password)
		await page.getByRole('button', { name: 'Sign in to dv-lab', exact: true }).click()
		await expect(page).toHaveURL(`${BASE}/`)
	} catch {
		throw new Error('Teacher sign-in failed; credential values suppressed')
	}
	saveAuth(await page.context().storageState())
	const id = await teacherId(page.request)
	restoreTeacherSettings(id)
	saveTeacherSettings(id)
	for (const [path, heading] of [
		['/', 'Today'],
		['/schedule', 'Schedule'],
		['/students', 'Students'],
		['/settings', 'Settings'],
	] as const) {
		await page.goto(path)
		if (path === '/schedule') {
			await expect(page.locator('[data-slot="week-grid"]')).toBeVisible()
		} else {
			await expect(
				page.getByRole('heading', { level: 1, ...(path === '/' ? {} : { name: heading, exact: true }) })
			).toBeVisible()
		}
	}
	console.log('E2E_SETUP_OK')
})
