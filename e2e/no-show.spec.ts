import type { Page } from '@playwright/test'

import { readNoShowFlag } from './support/api.ts'
import { addDays, vnToday } from './support/dates.ts'
import { expect, test, type Card } from './support/test.ts'
import { balanceEverywhere, chooseMark, markRadio, openLesson, screenshot } from './support/ui.ts'

async function setNoShow(page: Page, card: Card, enabled: boolean): Promise<void> {
	await page.goto(`/students/${card.id}`)
	await page.getByRole('button', { name: 'Edit details', exact: true }).click()
	const dialog = page.getByRole('dialog')
	const toggle = dialog.getByRole('switch', { name: 'No-show deducts a lesson', exact: true })
	if (enabled) await expect(toggle).not.toBeChecked()
	else await expect(toggle).toBeChecked()
	await toggle.click()
	const response = page.waitForResponse(
		(value) => new URL(value.url()).pathname === `/api/students/${card.id}` && value.request().method() === 'PATCH'
	)
	await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
	expect((await response).status()).toBe(200)
	await expect(dialog).toHaveCount(0)
	expect(await readNoShowFlag(page.request, card.id)).toBe(enabled)
}

test('no-show deducts unless the flag is off', async ({ page, fx }, info) => {
	const today = vnToday()
	const yesterday = addDays(today, -1)
	const card = await fx.card('Alex Example 2184')
	await fx.opening(card.id, 300, addDays(today, -3))
	await fx.once(card.id, yesterday, '10:00')
	let dialog = await openLesson(page, card, yesterday, '10:00')
	await chooseMark(page, dialog, 'No-show', 'Deducts 1 lesson (60 min).')
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	await setNoShow(page, card, false)
	await expect(
		page.locator('section[aria-labelledby="student-details"] dd').filter({ hasText: /^Deducts nothing$/ })
	).toHaveText('Deducts nothing')
	await balanceEverywhere(page, fx, card, '3 lessons left', 180)
	dialog = await openLesson(page, card, yesterday, '10:00')
	await expect(markRadio(dialog, 'No-show')).toBeChecked()
	await expect(
		dialog.getByText('Deducts nothing: No-show deducts a lesson is off for this student.', { exact: true })
	).toBeVisible()
	await screenshot(dialog, info)
	await page.keyboard.press('Escape')
	await setNoShow(page, card, true)
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	dialog = await openLesson(page, card, yesterday, '10:00')
	await expect(dialog.getByText('Deducts 1 lesson (60 min).', { exact: true })).toBeVisible()
})

test('cancelled marked lesson deducts nothing until restored', async ({ page, fx }, info) => {
	const today = vnToday()
	const yesterday = addDays(today, -1)
	const card = await fx.card('Alex Example 2184')
	await fx.opening(card.id, 300, addDays(today, -3))
	const lesson = await fx.once(card.id, yesterday, '12:00')
	await fx.mark(lesson, 'no_show')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	let dialog = await openLesson(page, card, yesterday, '12:00')
	await dialog.getByRole('button', { name: 'Cancel lesson', exact: true }).click()
	const cancelled = page.waitForResponse(
		(value) => new URL(value.url()).pathname.endsWith('/cancel') && value.request().method() === 'POST'
	)
	await page.getByRole('button', { name: 'Yes, cancel', exact: true }).click()
	expect((await cancelled).status()).toBe(200)
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '3 lessons left', 180)
	dialog = await openLesson(page, card, yesterday, '12:00')
	await expect(markRadio(dialog, 'No-show')).toBeChecked()
	for (const label of ['Scheduled', 'Done', 'No-show']) await expect(markRadio(dialog, label)).toBeDisabled()
	await expect(
		dialog.getByText(
			'Cancelled lessons deduct nothing. The mark is kept and counts again if you return the lesson to the schedule.',
			{ exact: true }
		)
	).toBeVisible()
	expect(fx.markCount(card.id)).toBe(1)
	expect(fx.markKind(lesson)).toBe('no_show')
	await screenshot(dialog, info)
	const restored = page.waitForResponse(
		(value) => new URL(value.url()).pathname.endsWith('/restore') && value.request().method() === 'POST'
	)
	await dialog.getByRole('button', { name: 'Return to schedule', exact: true }).click()
	expect((await restored).status()).toBe(200)
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
})
