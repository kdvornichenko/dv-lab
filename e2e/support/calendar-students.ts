import type { Page } from '@playwright/test'

import { studentLessonOptionsResponse } from '../../packages/contracts/src/students.ts'
import { addDays } from '../../packages/core/src/index.ts'
import { BASE, fixtureOwnership } from './data.ts'
import { mondayOf, vnToday } from './dates.ts'
import { expect } from './test.ts'

export async function studentChoiceJourney(page: Page) {
	const owned = fixtureOwnership().find((fixture) => fixture.id !== null && fixture.lifecycle === 'retained')
	if (!owned?.id) throw new Error('Student choice journey requires a registered retained card')
	const response = await page.request.get<unknown>(`${BASE}/api/students/options`)
	expect(response.status()).toBe(200)
	const input: unknown = await response.json()
	const choices = studentLessonOptionsResponse.parse(input).students
	expect(choices.some((choice) => choice.id === owned.id)).toBe(true)
	const option = choices.find((choice) => choice.id === owned.id)
	if (!option) throw new Error('Registered card is missing from student choices')
	if (option.displayName !== owned.name) throw new Error('Registered card identity has changed')
	const name = owned.name
	const anonymous = await page.context().browser()?.newContext()
	if (!anonymous) throw new Error('Student choice journey requires a browser')
	try {
		const denied = await anonymous.request.get<unknown>(`${BASE}/api/students/options`)
		expect(denied.status()).toBe(401)
	} finally {
		await anonymous.close()
	}
	await page.goto('/schedule')
	await expect(page.getByRole('button', { name: 'New lesson', exact: true })).toBeEnabled()
	await page.getByRole('button', { name: 'Next week', exact: true }).click()
	await expect(page.getByRole('button', { name: 'New lesson', exact: true })).toBeEnabled()
	let interrupted = false
	let studentRequests = 0
	const requests: string[] = []
	page.on('request', (request) => {
		if (request.url().startsWith(`${BASE}/api/students`)) requests.push(new URL(request.url()).pathname)
	})
	await page.route('**/api/students/options', async (route) => {
		studentRequests++
		if (!interrupted) {
			interrupted = true
			await route.abort('connectionreset')
		} else await route.continue()
	})
	try {
		await page.getByRole('button', { name: 'New lesson', exact: true }).click()
		const dialog = page.getByRole('dialog', { name: 'New lesson', exact: true })
		const student = dialog.getByLabel('Student', { exact: true })
		await expect(student).toBeEnabled()
		await student.click()
		await page.getByRole('option', { name, exact: true }).click()
		await expect(student).toContainText(name)
		expect(studentRequests).toBe(2)
		expect(requests.every((path) => path === '/api/students/options')).toBe(true)
		const monday = addDays(mondayOf(vnToday()), 7)
		const date = dialog.getByRole('button', { name: /^Date: / })
		const selected = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
			new Date(`${monday}T12:00:00Z`)
		)
		await expect(date).toHaveAccessibleName(`Date: ${selected}`)
		await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
		const discard = page.getByRole('alertdialog')
		if (await discard.isVisible()) await discard.getByRole('button', { name: 'Discard changes', exact: true }).click()
	} finally {
		await page.unroute('**/api/students/options')
	}
}
