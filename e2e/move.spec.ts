import type { Page } from '@playwright/test'

import { api } from './support/api.ts'
import { cleanupFixtures } from './support/data.ts'
import { addDays, mondayOf, startedSlotToday, VN, vnToday } from './support/dates.ts'
import { record, text } from './support/input.ts'
import { expect, test, type Card, type Fx } from './support/test.ts'
import {
	balanceEverywhere,
	block,
	changeSeries,
	chooseMark,
	cutSeriesToWednesday,
	markRadio,
	moveLesson,
	openLesson,
	openToday,
	openTodayLesson,
	openWeekOf,
	screenshot,
	shortDay,
} from './support/ui.ts'

async function inspectMovedDestination(page: Page, card: Card, date: string, key: string): Promise<void> {
	const dialog = await openLesson(page, card, date, '11:00')
	await expect(page.locator('[data-slot="week-grid-day"]').first()).toHaveAttribute('data-date', mondayOf(date))
	const destination = block(page, card.name, date, '11:00')
	await expect(destination).toHaveCount(1)
	await expect(destination).toHaveAttribute('data-key', key)
	await expect(destination).toHaveAttribute('data-slot', 'to')
	await expect(destination).toHaveAttribute('aria-label', /done/)
	await expect(dialog.getByRole('link', { name: card.name, exact: true })).toBeVisible()
	await expect(markRadio(dialog, 'Done')).toBeChecked()
	await expect(dialog.getByText('Deducts 1 lesson (60 min).', { exact: true })).toBeVisible()
	await page.keyboard.press('Escape')
}

async function movedFallback(page: Page, fx: Fx): Promise<void> {
	cleanupFixtures()
	const date = vnToday()
	const time = startedSlotToday()
	const targetDate = addDays(date, 10)
	const card = await fx.card('Alex Example 2186')
	await fx.opening(card.id, 300, addDays(date, -10))
	const series = fx.pastSeries(card.id, addDays(date, -7), time)
	const key = `s:${series}:${date}`
	await openToday(page)
	let dialog = await openTodayLesson(page, card)
	await chooseMark(page, dialog, 'Done', 'Deducts 1 lesson (60 min).')
	await moveLesson(page, dialog, targetDate, '11:00')
	await expect(page).toHaveURL(/\/schedule$/)
	await inspectMovedDestination(page, card, targetDate, key)
	const target = (await fx.week(mondayOf(targetDate))).find((entry) => entry.key === key && entry.outcome === 'done')
	if (!target) throw new Error('Moved destination is missing from the real week response')
	const today = await fx.today()
	expect(
		[...today.lessons, ...today.earlier].some((entry) => entry.key === key && entry.startsAt === target.startsAt)
	).toBe(false)
	await openToday(page)
	dialog = await openTodayLesson(page, card)
	await expect(
		dialog.getByText(
			`This lesson was moved to ${shortDay(targetDate)}, so nothing is deducted here. Mark it at its new time.`,
			{ exact: true }
		)
	).toBeVisible()
	await dialog.getByRole('button', { name: /^moved to / }).click()
	await expect(page).toHaveURL(/\/schedule$/)
	await inspectMovedDestination(page, card, targetDate, key)
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	expect(fx.markCount(card.id)).toBe(1)
}

async function staleEmptySeries(page: Page, fx: Fx): Promise<void> {
	cleanupFixtures()
	const now = new Date()
	const today = vnToday(now)
	const weekday = new Date(`${today}T00:00:00Z`).getUTCDay()
	const untilWednesday = (3 - weekday + 7) % 7
	const clock = new Intl.DateTimeFormat('en-GB', {
		timeZone: VN,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(now)
	const first = addDays(today, untilWednesday === 0 && clock >= '18:00' ? 7 : untilWednesday)
	const second = addDays(first, 7)
	const oldStart = addDays(first, 8)
	const card = await fx.card('Alex Example 2186')
	const oldId = await fx.weekly(card.id, oldStart, '18:00')
	const dialog = await openLesson(page, card, oldStart, '18:00')
	const newId = await cutSeriesToWednesday(page, dialog, today)
	expect(newId).not.toBe(oldId)
	const saved = fx.seriesRows(card.id)
	expect(saved).toHaveLength(2)
	expect(fx.scheduleCounts(card.id)).toEqual({ series: 2, lessons: 0, exceptions: 0, marks: 0 })
	expect(saved.find((row) => row.id === oldId)?.endsOn).toBe(addDays(oldStart, -1))
	expect(saved.find((row) => row.id === oldId)?.startsOn).toBe(oldStart)
	expect(saved.find((row) => row.id === newId)).toMatchObject({
		startsOn: first,
		endsOn: null,
		weekday: 3,
		startTime: '18:00',
	})
	const firstBefore = (await fx.week(mondayOf(first))).filter((entry) => entry.studentId === card.id)
	const secondBefore = (await fx.week(mondayOf(second))).filter((entry) => entry.studentId === card.id)
	expect(firstBefore).toHaveLength(1)
	expect(secondBefore).toHaveLength(1)
	expect(firstBefore[0]?.key).toBe(`s:${newId}:${first}`)
	expect(secondBefore[0]?.key).toBe(`s:${newId}:${second}`)
	const refused = await api(
		page.request,
		'POST',
		`/schedule/series/${oldId}/move`,
		{ from: today, weekday: 3, startTime: '18:00' },
		409
	)
	expect(text(record(record(refused).error).code)).toBe('lesson_changed')
	expect(fx.seriesRows(card.id)).toEqual(saved)
	expect(fx.scheduleCounts(card.id)).toEqual({ series: 2, lessons: 0, exceptions: 0, marks: 0 })
	expect((await fx.week(mondayOf(first))).filter((entry) => entry.studentId === card.id)).toEqual(firstBefore)
	expect((await fx.week(mondayOf(second))).filter((entry) => entry.studentId === card.id)).toEqual(secondBefore)
	for (const date of [first, second]) {
		await openWeekOf(page, date)
		await expect(block(page, card.name, date, '18:00')).toHaveCount(1)
		await expect(block(page, card.name, date, '18:00')).toHaveAttribute('data-key', `s:${newId}:${date}`)
	}
	await openWeekOf(page, oldStart)
	await expect(block(page, card.name, oldStart, '18:00')).toHaveCount(0)
}

async function restoredTail(page: Page, fx: Fx, label: 'Done' | 'No-show', action: 'cut' | 'end'): Promise<void> {
	cleanupFixtures()
	const today = vnToday()
	const future = addDays(today, 7)
	const past = addDays(today, -1)
	const card = await fx.card('Alex Example 2186')
	await fx.opening(card.id, 300, addDays(today, -10))
	const series = await fx.weekly(card.id, future, '10:00')
	let dialog = await openLesson(page, card, future, '10:00')
	await moveLesson(page, dialog, past, '10:00')
	dialog = await openLesson(page, card, past, '10:00')
	await chooseMark(page, dialog, label, 'Deducts 1 lesson (60 min).')
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	dialog = await openLesson(page, card, past, '10:00')
	await moveLesson(page, dialog, future, '10:00')
	const saved = fx.occurrenceState(card.id, series, future)
	expect(saved.exception).toBe('restored')
	expect(saved.mark).toBe(label === 'Done' ? 'done' : 'no_show')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	dialog = await openLesson(page, card, future, '10:00')
	await expect(markRadio(dialog, label)).toBeChecked()
	await changeSeries(page, dialog, action, future)
	const retained = fx.occurrenceState(card.id, series, future)
	expect(retained.markId).toBe(saved.markId)
	expect(retained.mark).toBe(saved.mark)
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	const marked = (await fx.week(mondayOf(future))).filter(
		(entry) => entry.studentId === card.id && entry.outcome === saved.mark
	)
	expect(marked).toHaveLength(1)
	expect(marked[0]?.mark).toBe(saved.mark)
	await openWeekOf(page, future)
	await expect(block(page, card.name, future, '10:00')).toHaveCount(1)
	await expect(block(page, card.name, future, '10:00')).toHaveAttribute(
		'aria-label',
		label === 'Done' ? /done/ : /no-show/
	)
	dialog = await openLesson(page, card, future, '10:00')
	await expect(markRadio(dialog, label)).toBeChecked()
	await expect(dialog.getByText('Deducts 1 lesson (60 min).', { exact: true })).toBeVisible()
	await page.keyboard.press('Escape')
}

test('a marked started lesson moves with its mark', async ({ page, fx }, info) => {
	const today = vnToday()
	const yesterday = addDays(today, -1)
	const opening = addDays(today, -3)
	const future = addDays(today, 2)
	const card = await fx.card('Alex Example 2185')
	await fx.opening(card.id, 200, opening)
	await fx.once(card.id, yesterday, '10:00')
	let dialog = await openLesson(page, card, yesterday, '10:00')
	await chooseMark(page, dialog, 'Done', 'Deducts 1 lesson (60 min).')
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '1 lesson left', 60)
	dialog = await openLesson(page, card, yesterday, '10:00')
	await moveLesson(page, dialog, opening, '09:00')
	await openWeekOf(page, yesterday)
	await expect(block(page, card.name, yesterday, '10:00')).toHaveCount(0)
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	dialog = await openLesson(page, card, opening, '09:00')
	await expect(markRadio(dialog, 'Done')).toBeChecked()
	await expect(
		dialog.getByText(`Not counted: it falls on or before the opening balance date (${shortDay(opening)}).`, {
			exact: true,
		})
	).toBeVisible()
	await expect(block(page, card.name, opening, '09:00')).toHaveAttribute('aria-label', /done/)
	await moveLesson(page, dialog, future, '10:00')
	await balanceEverywhere(page, fx, card, '1 lesson left', 60)
	dialog = await openLesson(page, card, future, '10:00')
	await expect(block(page, card.name, future, '10:00')).toHaveAttribute('aria-label', /done/)
	await expect(markRadio(dialog, 'Done')).toBeChecked()
	for (const label of ['Scheduled', 'Done', 'No-show']) await expect(markRadio(dialog, label)).toBeEnabled()
	await chooseMark(page, dialog, 'Scheduled', 'You can mark a lesson once it has started.')
	for (const label of ['Scheduled', 'Done', 'No-show']) await expect(markRadio(dialog, label)).toBeDisabled()
	await screenshot(dialog, info)
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
})

test('a moved series occurrence leaves a ghost that deducts nothing', async ({ page, fx }, info) => {
	test.setTimeout(240000)
	const today = vnToday()
	const original = addDays(today, -7)
	const moved = addDays(today, -2)
	const card = await fx.card('Alex Example 2186')
	await fx.opening(card.id, 300, addDays(today, -10))
	fx.pastSeries(card.id, original, '10:00')
	let dialog = await openLesson(page, card, original, '10:00')
	await chooseMark(page, dialog, 'Done', 'Deducts 1 lesson (60 min).')
	await page.keyboard.press('Escape')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	dialog = await openLesson(page, card, original, '10:00')
	await moveLesson(page, dialog, moved, '11:00')
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
	dialog = await openLesson(page, card, original, '10:00')
	await expect(block(page, card.name, original, '10:00')).toHaveAttribute('aria-label', /moved/)
	await expect(
		dialog.getByText(
			`This lesson was moved to ${shortDay(moved)}, so nothing is deducted here. Mark it at its new time.`,
			{ exact: true }
		)
	).toBeVisible()
	for (const label of ['Scheduled', 'Done', 'No-show']) await expect(markRadio(dialog, label)).toBeDisabled()
	await screenshot(dialog, info)
	await page.keyboard.press('Escape')
	dialog = await openLesson(page, card, moved, '11:00')
	await expect(block(page, card.name, moved, '11:00')).toHaveAttribute('aria-label', /done/)
	await expect(markRadio(dialog, 'Done')).toBeChecked()
	await expect(dialog.getByText('Deducts 1 lesson (60 min).', { exact: true })).toBeVisible()
	expect(fx.markCount(card.id)).toBe(1)
	await page.keyboard.press('Escape')
	for (const label of ['Done', 'No-show'] as const) {
		for (const action of ['cut', 'end'] as const) await restoredTail(page, fx, label, action)
	}
	await staleEmptySeries(page, fx)
	await movedFallback(page, fx)
})
