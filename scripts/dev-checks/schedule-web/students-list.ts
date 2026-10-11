import type { Page } from 'playwright-core'

import { check, shot } from '../browser-context.ts'
import type { studentsFixtures } from './students.ts'
import { openStudentsList, headerCounts, searchField, studentRow, ST_A, ST_B, fixtureRows, ST_C } from './students.ts'

export async function studentsPart2(page: Page, _fx: Awaited<ReturnType<typeof studentsFixtures>>) {
	const requests: string[] = []
	page.on('request', (request) => {
		if (request.url().includes('/api/')) requests.push(request.url())
	})
	await openStudentsList(page)
	const countsBefore = await headerCounts(page).textContent()
	check('active tab shows the search field', (await searchField(page).count()) === 1)
	const placeholder = await searchField(page).getAttribute('placeholder')
	check('search placeholder is Search students', placeholder === 'Search students', String(placeholder))
	const type = await searchField(page).getAttribute('type')
	check('search field is type search', type === 'search', String(type))
	const beforeSearch = requests.length
	await searchField(page).fill('  ALEX example 2009 a  ')
	await page.waitForTimeout(300)
	check('active: query keeps A', (await studentRow(page, ST_A).count()) === 1)
	check('active: query hides B', (await studentRow(page, ST_B).count()) === 0)
	check('active: only A of the fixtures is listed', (await fixtureRows(page)) === 1)
	check('header counts are unchanged by the filter', (await headerCounts(page).textContent()) === countsBefore)
	await searchField(page).fill('zz-no-such-student')
	await page.waitForTimeout(300)
	check(
		'active: no match shows No students found',
		(await page.getByText('No students found', { exact: true }).count()) === 1
	)
	check('active: no table when nothing matches', (await page.locator('tbody tr').count()) === 0)
	check('header counts are unchanged by an empty result', (await headerCounts(page).textContent()) === countsBefore)
	await shot(page, 'sched-students', 'no-match')
	await searchField(page).fill('2009 c')
	await page.waitForTimeout(300)
	check('active: archived card C is not on the active tab', (await studentRow(page, ST_C).count()) === 0)
	check(
		'active: No students found for an archived-only match',
		(await page.getByText('No students found', { exact: true }).count()) === 1
	)
	await page.getByRole('tab', { name: 'Archived', exact: true }).click()
	await studentRow(page, ST_C).first().waitFor({ timeout: 10000 })
	check('archived: the query is kept across tabs', (await searchField(page).inputValue()) === '2009 c')
	check('archived: C is listed by 2009 c', (await studentRow(page, ST_C).count()) === 1)
	check('archived: only C of the fixtures is listed', (await fixtureRows(page)) === 1)
	await shot(page, 'sched-students', 'archived')
	await searchField(page).fill('zz-no-such-student')
	await page.waitForTimeout(300)
	check(
		'archived: no match shows No students found',
		(await page.getByText('No students found', { exact: true }).count()) === 1
	)
	const searchRequests = requests.length - beforeSearch
	await page.getByRole('tab', { name: /^Unassigned payments/ }).click()
	await page.waitForTimeout(500)
	check('unassigned: no search field', (await searchField(page).count()) === 0)
	await page.getByRole('tab', { name: 'Active', exact: true }).click()
	await page.waitForTimeout(500)
	check(
		'back on active: the field returns with the kept query',
		(await searchField(page).inputValue()) === 'zz-no-such-student'
	)
	await searchField(page).fill('')
	await page.waitForTimeout(300)
	check(
		'empty query lists the fixtures again',
		(await studentRow(page, ST_A).count()) === 1 && (await studentRow(page, ST_B).count()) === 1
	)
	check('header counts are unchanged after clearing', (await headerCounts(page).textContent()) === countsBefore)
	check('searching on Active and Archived sends no request', searchRequests === 0, String(searchRequests))
	console.log(
		`INFO requests after the search began: ${requests
			.slice(beforeSearch)
			.map((url) => new URL(url).pathname)
			.join(', ')}`
	)
	check('the query is not in the url', !page.url().includes('?') && !page.url().includes('search'), page.url())
	const layout = await page.evaluate(() => {
		const input = document.querySelector<HTMLInputElement>('input[type="search"]')
		const list = document.querySelector<HTMLElement>('[role="tablist"]')
		if (!input || !list) return null
		const inputBox = input.getBoundingClientRect()
		const listBox = list.getBoundingClientRect()
		return {
			width: Math.round(inputBox.width),
			inputLeft: inputBox.left,
			listRight: listBox.right,
			inputBottom: inputBox.bottom,
			listBottom: listBox.bottom,
		}
	})
	check('search field is 288px wide on desktop', layout?.width === 288, String(layout?.width))
	check('search field sits right of the tabs', layout !== null && layout.inputLeft > layout.listRight)
	check(
		'search field and tabs share a bottom edge',
		layout !== null && Math.abs(layout.inputBottom - layout.listBottom) <= 1
	)
	await shot(page, 'sched-students', 'desktop')
}
