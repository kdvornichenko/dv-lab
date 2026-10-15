import type { Page } from '@playwright/test'

import type { ScheduleLessonResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, failures, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import { dragDraft } from './drag-draft.ts'
import { dragPart2, dragPart3 } from './drag-limits.ts'
import { cleanupFixtures } from './fixtures.ts'
import { VN, setTheme, openSchedule, goToWeek } from './navigation.ts'
import { createCard } from './read-fixtures.ts'

export const DRAG_LIKE = 'Alex Example 2132%'

export const DRAG_A = 'Alex Example 2132 A'

export const MINUTE_PX = 0.8

export const dragColumn = (page: Page, date: string) =>
	page.locator(`[data-slot="week-grid-column"][data-date="${date}"]`)

export async function dragScrollFor(page: Page, minutesA: number, minutesB: number) {
	await page.evaluate(
		({ from, to, px }) => {
			const body = document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')
			body!.scrollTop = Math.max(0, ((from + to) / 2) * px - body!.clientHeight / 2)
		},
		{ from: minutesA, to: minutesB, px: MINUTE_PX }
	)
	await page.waitForTimeout(80)
}

export async function dragPoint(page: Page, date: string, minutes: number, offset: number = 0) {
	const box = await dragColumn(page, date).boundingBox()
	return { x: box!.x + 10, y: box!.y + minutes * MINUTE_PX + offset }
}

export async function frameFacts(page: Page) {
	return page.evaluate(() => {
		const frame = document.querySelector<HTMLElement>('[data-slot="week-grid-frame"]')
		if (!frame) return null
		const column = frame.closest<HTMLElement>('[data-slot="week-grid-column"]')
		const style = getComputedStyle(frame)
		const rect = frame.getBoundingClientRect()
		const columnRect = column!.getBoundingClientRect()
		const chip = frame.querySelector<HTMLElement>('[data-slot="week-grid-frame-chip"]')
		const caption = frame.querySelector<HTMLElement>('span.text-caption')
		return {
			range: frame.getAttribute('data-range'),
			minutes: Number(frame.getAttribute('data-minutes')),
			state: frame.getAttribute('data-state'),
			top: rect.top - columnRect.top,
			height: rect.height,
			left: rect.left - columnRect.left,
			width: rect.width,
			columnWidth: columnRect.width,
			radius: style.borderTopLeftRadius,
			pointerEvents: style.pointerEvents,
			zIndex: style.zIndex,
			cls: frame.className,
			text: frame.textContent,
			caption: caption ? caption.textContent : null,
			captionSize: caption ? getComputedStyle(caption).fontSize : null,
			captionWrap: caption ? getComputedStyle(caption).whiteSpace : null,
			chip: chip ? chip.textContent : null,
			chipSize: chip ? getComputedStyle(chip).fontSize : null,
			chipLeft: chip ? chip.getBoundingClientRect().left - rect.right : null,
			count: document.querySelectorAll<HTMLElement>('[data-slot="week-grid-frame"]').length,
			cursor: getComputedStyle(column!).cursor,
		}
	})
}

export async function dragSteps(
	page: Page,
	date: string,
	fromMinutes: number,
	toMinutes: number,
	pressOffset = 2,
	toOffset = 2
) {
	await dragScrollFor(page, fromMinutes, toMinutes)
	const start = await dragPoint(page, date, fromMinutes, pressOffset)
	const end = await dragPoint(page, date, toMinutes, toOffset)
	await page.mouse.move(start.x, start.y)
	await page.mouse.down()
	await page.mouse.move(end.x, end.y, { steps: 8 })
	await page.waitForTimeout(120)
	return { start, end }
}

export async function discardNew(page: Page) {
	await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(250)
}

export async function dragFixtures(page: Page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const card = await createCard(page, DRAG_A, 60, null)
	const made = await api<ScheduleLessonResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		studentId: card,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'once',
	})
	check('fixture lesson at 18:00 created', made.status === 201, String(made.status))
	return { today, wednesday }
}

export async function drag() {
	cleanupFixtures('drag start', DRAG_LIKE)

	await withBrowser(
		{ width: 1440, height: 900 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await dragFixtures(page)
			await openSchedule(page)
			const nav = { monday: core.mondayOf(fx.today) }
			await goToWeek(page, nav, core.mondayOf(fx.wednesday))
			await dragDraft(page, fx)
			console.log('DRAG_PART1_OK')
			await dragPart2(page, fx)
			await dragPart3(page, fx)
			const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		},
		() => cleanupFixtures('drag end', DRAG_LIKE)
	)
	if (failures() === 0) console.log('SCHEDULE_WEB_DRAG_OK')
}
