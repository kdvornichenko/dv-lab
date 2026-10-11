import type { Page } from 'playwright-core'

import { check, shot } from '../browser-context.ts'
import { openStudentsList } from './students.ts'

export async function studentsPart3(page: Page) {
	const posts: string[] = []
	page.on('request', (request) => {
		if (request.method() !== 'GET' && request.url().includes('/api/students')) posts.push(request.url())
	})
	await openStudentsList(page)
	await page.getByRole('button', { name: 'New student' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	await dialog.locator('#student-form-time-zone').click()
	const zoneInput = page.getByPlaceholder('Search time zones')
	await zoneInput.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	const firstRow = await page.getByRole('option').first().textContent()
	check('time zone field: first row is Same as teacher', firstRow?.trim() === 'Same as teacher', String(firstRow))
	check('time zone field: no None row', (await page.getByRole('option', { name: /^None/ }).count()) === 0)
	await zoneInput.fill('kolk')
	await page.waitForTimeout(300)
	const kolkata = await page.getByRole('option').allTextContents()
	check(
		'time zone search kolk finds Asia/Kolkata with IST',
		kolkata.length === 1 && kolkata[0].includes('Asia/Kolkata') && kolkata[0].includes('IST'),
		kolkata.join(' | ')
	)
	await zoneInput.fill('+7')
	await page.waitForTimeout(300)
	const seven = await page.getByRole('option').allTextContents()
	check('time zone search +7 lists zones', seven.length > 0, String(seven.length))
	check(
		'time zone search +7 lists Bangkok and Ho Chi Minh, not Kolkata',
		seven.some((text) => text.includes('Asia/Bangkok')) &&
			seven.some((text) => text.includes('Asia/Ho_Chi_Minh')) &&
			!seven.some((text) => text.includes('Asia/Kolkata')),
		String(seven.length)
	)
	await zoneInput.fill('utc+5:30')
	await page.waitForTimeout(300)
	const half = await page.getByRole('option').allTextContents()
	check(
		'time zone search 5:30 finds Asia/Kolkata',
		half.some((text) => text.includes('Asia/Kolkata'))
	)
	await zoneInput.fill('kathm')
	await page.waitForTimeout(300)
	const modern = await page.getByRole('option').allTextContents()
	check(
		'time zone search kathm finds Asia/Kathmandu with KATH',
		modern.some((text) => text.includes('Asia/Kathmandu') && text.includes('KATH')),
		modern.join(' | ')
	)
	await zoneInput.fill('zz-no-zone')
	await page.waitForTimeout(300)
	check(
		'time zone search with no match shows the empty title',
		(await page.getByText('No time zones found').count()) === 1
	)
	await shot(page, 'sched-students', 'zone-search')
	await page.keyboard.press('Escape')
	await page.getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	check('dialog closed without saving', posts.length === 0, posts.join(' | '))
	const left = await page.evaluate(() => document.querySelectorAll<HTMLElement>('tbody tr').length)
	check('list is still shown after closing the dialog', left > 0)
}
