import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'

import { readSettings, type StudentFacts } from './api.ts'
import { addDays, mondayOf, shortDay } from './dates.ts'
import { record, uuid } from './input.ts'
import type { Card, Fx } from './test.ts'

export async function openWeekOf(page: Page, date: string): Promise<void> {
	await page.goto('/schedule')
	await expect(page.locator('[data-slot="week-grid"]')).toBeVisible()
	const day = page.locator('[data-slot="week-grid-day"]').first()
	const current = await day.getAttribute('data-date')
	if (!current) throw new Error('Week grid has no date')
	const target = mondayOf(date)
	const steps = Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${current}T00:00:00Z`)) / 604800000)
	if (Math.abs(steps) > 53) throw new Error('Requested week is outside the fixture year')
	for (let step = 1; step <= Math.abs(steps); step += 1) {
		await page.keyboard.press(steps > 0 ? 'j' : 'k')
		await expect(day).toHaveAttribute('data-date', addDays(current, step * (steps > 0 ? 7 : -7)))
	}
}

export function block(page: Page, name: string, date: string, time: string): Locator {
	return page.locator(
		`[data-slot="week-grid-column"][data-date="${date}"] button[data-key][aria-label^="${name}, "][aria-label*=", ${time}–"]`
	)
}

export async function openLesson(page: Page, card: Card, date: string, time: string): Promise<Locator> {
	await openWeekOf(page, date)
	await expect(block(page, card.name, date, time)).toHaveCount(1)
	await block(page, card.name, date, time).click()
	const dialog = page.getByRole('dialog')
	await expect(dialog).toBeVisible()
	await expect(dialog.getByRole('radiogroup', { name: 'Mark', exact: true })).toBeVisible()
	return dialog
}

export function markRadio(dialog: Locator, label: string): Locator {
	return dialog.getByRole('radiogroup', { name: 'Mark', exact: true }).getByRole('radio', { name: label, exact: true })
}

export async function chooseMark(page: Page, dialog: Locator, label: string, help: string): Promise<void> {
	const response = page.waitForResponse(
		(value) => new URL(value.url()).pathname.endsWith('/mark') && value.request().method() === 'POST'
	)
	await markRadio(dialog, label).click()
	expect((await response).status()).toBe(200)
	await expect(markRadio(dialog, label)).toBeChecked()
	await expect(dialog.getByText(help, { exact: true })).toBeVisible()
}

export async function balanceCell(page: Page, card: Card): Promise<Locator> {
	await page.goto('/students')
	await expect(page.getByRole('heading', { name: 'Students', exact: true, level: 1 })).toBeVisible()
	await page.getByRole('searchbox', { name: 'Search students', exact: true }).fill(card.name)
	const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: card.name, exact: true }) })
	await expect(row).toHaveCount(1)
	return row.getByRole('cell').nth(3)
}

export async function profileBalance(page: Page, card: Card, expected: string): Promise<void> {
	await page.goto(`/students/${card.id}`)
	await expect(page.getByRole('heading', { name: card.name, exact: true, level: 1 })).toBeVisible()
	await expect(
		page
			.locator('header')
			.filter({ has: page.getByRole('heading', { name: card.name, exact: true }) })
			.getByText(expected, { exact: true })
	).toBeVisible()
}

export async function balanceEverywhere(
	page: Page,
	fx: Fx,
	card: Card,
	expected: string,
	minutes: number
): Promise<void> {
	const detail = await fx.student(card.id)
	const row = (await fx.students()).find((entry) => entry.id === card.id)
	expect(detail.balanceMinutes).toBe(minutes)
	expect(row?.balanceMinutes).toBe(minutes)
	const due = (await fx.today()).paysSoon.find((entry) => entry.id === card.id)
	if (due) expect(due.balanceMinutes).toBe(minutes)
	await expect(await balanceCell(page, card)).toHaveText(expected)
	await profileBalance(page, card, expected)
}

export function lessonRow(page: Page, panel: string, card: Card): Locator {
	return page
		.locator(`section[aria-labelledby="${panel}"] [data-slot="today-row"][data-student-id="${card.id}"]`)
		.filter({ hasText: card.name })
}

export async function rowBodyStyles(row: Locator, earlier: boolean): Promise<void> {
	const scale = await row.evaluate(
		(element) => Number.parseFloat(getComputedStyle(element).getPropertyValue('--fs-body')) / 13
	)
	expect(scale).toBeGreaterThan(0)
	const slots = earlier ? ['time-main', 'today-row-open', 'today-row-date'] : ['time-main', 'today-row-open']
	for (const slot of slots) {
		const element = row.locator(`[data-slot="${slot}"]`)
		await expect(element).toHaveCount(1)
		const styles = await element.evaluate((node) => {
			const style = getComputedStyle(node)
			return { font: Number.parseFloat(style.fontSize), line: Number.parseFloat(style.lineHeight) }
		})
		expect(styles.font).toBeCloseTo(13 * scale, 3)
		expect(styles.line).toBeCloseTo(20 * scale, 3)
	}
}

export function dueRow(page: Page, card: Card): Locator {
	return page
		.locator(`section[aria-labelledby="today-pays-soon"] [data-slot="due-row"][data-student-id="${card.id}"]`)
		.filter({ hasText: card.name })
}

export function tile(page: Page, label: string): Locator {
	return page
		.locator('[data-slot="stat"]')
		.filter({ has: page.locator('[data-slot="stat-label"]').filter({ hasText: new RegExp(`^${label}$`) }) })
		.locator('[data-slot="stat-value"]')
}

export async function openToday(page: Page): Promise<void> {
	await page.goto('/')
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
	await expect(tile(page, 'To mark')).toBeVisible()
}

export async function changeQuickMark(
	page: Page,
	card: Card,
	time: string,
	current: string,
	target: string
): Promise<void> {
	const row = lessonRow(page, 'today-lessons', card)
	await row.getByRole('button', { name: `${card.name}, ${time}: ${current}. Change the mark`, exact: true }).click()
	const response = page.waitForResponse(
		(value) => new URL(value.url()).pathname.endsWith('/mark') && value.request().method() === 'POST'
	)
	await page.getByRole('menuitem', { name: target, exact: true }).click()
	expect((await response).status()).toBe(200)
}

export async function pickDate(page: Page, date: string, id = 'move-lesson-date'): Promise<void> {
	await page.locator(`#${id}`).click()
	const key = `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}/${date.slice(0, 4)}`
	const cell = page.locator(`button[data-day="${key}"]`).first()
	for (let step = 0; step < 4 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /next month/i }).click()
		await page.waitForTimeout(150)
	}
	for (let step = 0; step < 8 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /previous month/i }).click()
		await page.waitForTimeout(150)
	}
	await cell.click()
	await expect(page.getByRole('listbox', { name: 'Hours' })).toHaveCount(0)
}

export async function pickTime(page: Page, time: string, id = 'move-lesson-time'): Promise<void> {
	await page.locator(`#${id}`).click()
	await page
		.getByRole('listbox', { name: 'Hours' })
		.getByRole('option', { name: time.slice(0, 2), exact: true })
		.click()
	await page
		.getByRole('listbox', { name: 'Minutes' })
		.getByRole('option', { name: time.slice(3), exact: true })
		.click()
	await page.getByRole('button', { name: 'Done', exact: true }).click()
	await expect(page.getByRole('listbox', { name: 'Hours' })).toHaveCount(0)
}

export async function moveLesson(page: Page, dialog: Locator, date: string, time: string): Promise<void> {
	await dialog.getByRole('button', { name: 'Move lesson', exact: true }).click()
	await pickDate(page, date)
	await pickTime(page, time)
	const response = page.waitForResponse(
		(value) => new URL(value.url()).pathname.endsWith('/move') && value.request().method() === 'POST'
	)
	await dialog
		.getByRole('group', { name: 'Move lesson', exact: true })
		.getByRole('button', { name: 'Move lesson', exact: true })
		.click()
	expect((await response).status()).toBe(200)
	await expect(page.getByText('Lesson moved', { exact: true })).toBeVisible()
	await page.keyboard.press('Escape')
}

export async function openTodayLesson(page: Page, card: Card): Promise<Locator> {
	const row = lessonRow(page, 'today-lessons', card)
	await expect(row).toHaveCount(1)
	await row.locator('button[data-slot="today-row-open"]').click()
	const dialog = page.getByRole('dialog')
	await expect(dialog.getByRole('link', { name: card.name, exact: true })).toBeVisible()
	return dialog
}

export async function changeSeries(page: Page, dialog: Locator, action: 'cut' | 'end', date: string): Promise<void> {
	const label = action === 'cut' ? 'Move series' : 'End series'
	await dialog.getByRole('button', { name: label, exact: true }).click()
	const next = page.getByRole('dialog')
	await expect(next.getByRole('button', { name: label, exact: true })).toBeVisible()
	if (action === 'cut') {
		await pickDate(page, date, 'move-series-from')
		await pickTime(page, '11:00', 'move-series-time')
	} else await pickDate(page, addDays(date, -1), 'end-series-last')
	const endpoint = action === 'cut' ? '/move' : '/end'
	const response = page.waitForResponse(
		(value) =>
			new URL(value.url()).pathname.includes('/api/schedule/series/') &&
			new URL(value.url()).pathname.endsWith(endpoint) &&
			value.request().method() === 'POST'
	)
	await next.getByRole('button', { name: label, exact: true }).click()
	expect((await response).status()).toBe(200)
	await expect(page.getByText(action === 'cut' ? 'Series moved' : 'Series ended', { exact: true })).toBeVisible()
	await expect(next).toHaveCount(0)
}

export async function cutSeriesToWednesday(page: Page, dialog: Locator, from: string): Promise<string> {
	await dialog.getByRole('button', { name: 'Move series', exact: true }).click()
	const next = page.getByRole('dialog')
	await expect(next.getByRole('button', { name: 'Move series', exact: true })).toBeVisible()
	await pickDate(page, from, 'move-series-from')
	await page.locator('#move-series-day').click()
	await page.getByRole('option', { name: 'Wednesday', exact: true }).click()
	await pickTime(page, '18:00', 'move-series-time')
	const pending = page.waitForResponse(
		(value) =>
			new URL(value.url()).pathname.includes('/api/schedule/series/') &&
			new URL(value.url()).pathname.endsWith('/move') &&
			value.request().method() === 'POST'
	)
	await next.getByRole('button', { name: 'Move series', exact: true }).click()
	const response = await pending
	expect(response.status()).toBe(200)
	const value: unknown = await response.json()
	const id = uuid(record(record(value).series).id)
	await expect(page.getByText('Series moved', { exact: true })).toBeVisible()
	await expect(next).toHaveCount(0)
	return id
}

export async function setThreshold(page: Page, value: number): Promise<void> {
	await page.goto('/settings')
	await page.getByRole('tab', { name: 'General', exact: true }).click()
	const field = page.getByLabel('Pays soon threshold (lessons)', { exact: true })
	await expect(field).toBeEnabled()
	const before = await readSettings(page.request)
	await field.fill(String(value))
	if (before.paysSoonLessons !== value) {
		const response = page.waitForResponse(
			(result) => new URL(result.url()).pathname === '/api/settings' && result.request().method() === 'PATCH'
		)
		await field.press('Enter')
		expect((await response).status()).toBe(200)
		await expect(page.getByText('Saved', { exact: true })).toBeVisible()
	}
	await expect(field).toHaveValue(String(value))
	expect((await readSettings(page.request)).paysSoonLessons).toBe(value)
}

export async function expectDue(
	page: Page,
	card: Card,
	values: StudentFacts[],
	expected: string,
	status: string,
	info: TestInfo
): Promise<void> {
	const index = values.findIndex((entry) => entry.id === card.id)
	expect(index).toBeGreaterThanOrEqual(0)
	if (index >= 8) {
		await expect(page.locator('section[aria-labelledby="today-pays-soon"] [data-slot="more-row"]')).toHaveText(
			`+${values.length - 8} more`
		)
		info.annotations.push({
			type: 'ui-limit',
			description: 'pays soon: fixture beyond the first 8 rows; balance text and dot not verified in Today',
		})
		return
	}
	const row = dueRow(page, card)
	await expect(row.locator('[data-slot="due-balance"]')).toHaveText(expected)
	await expect(row.getByRole('img', { name: status, exact: true })).toBeVisible()
}

export async function screenshot(locator: Locator, info: TestInfo): Promise<void> {
	await locator.screenshot({ path: info.outputPath('fixture.png'), animations: 'disabled' })
}

export { shortDay }
