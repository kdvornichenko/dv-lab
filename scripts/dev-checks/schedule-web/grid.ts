import type { Page } from '@playwright/test'

import type {
	ScheduleLessonResponse,
	ErrorResponse,
	ScheduleOccurrenceResponse,
} from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, failures, shot, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import { readBlocks, blockLocator, checkPair, pairOf } from './block-probes.ts'
import { cleanupFixtures } from './fixtures.ts'
import { VN, openSchedule, goToWeek, setTheme } from './navigation.ts'
import { createCard } from './read-fixtures.ts'

export const GRID_LIKE = 'Alex Example 2130%'

export const GRID_A = 'Alex Example 2130 A'

export const GRID_B = 'Alex Example 2130 B'

export const GCAL_LINE_PROBE = 'var(--gcal-line)'

export async function gridFixtures(page: Page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const thursday = core.addDays(wednesday, 1)
	const cancelledWednesday = core.addDays(wednesday, 63)
	const a = await createCard(page, GRID_A, 60, null)
	const b = await createCard(page, GRID_B, 60, null)
	const make = async (studentId: string, date: string, startTime: string, durationMinutes: number) => {
		const result = await api<ScheduleLessonResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
			studentId,
			date,
			startTime,
			durationMinutes,
			repeats: 'once',
		})
		check(
			`lesson ${date} ${startTime} for ${durationMinutes} min created`,
			result.status === 201,
			String(result.status)
		)
		return result.json?.lesson
	}
	await make(a, wednesday, '18:00', 60)
	await make(a, thursday, '09:00', 30)
	await make(a, thursday, '11:00', 40)
	await make(a, thursday, '14:00', 45)
	await make(a, thursday, '16:00', 60)
	const doomed = await make(b, cancelledWednesday, '12:00', 60)
	const cancelled = await api<ScheduleOccurrenceResponse & Partial<ErrorResponse>>(
		page,
		'POST',
		`/schedule/lessons/${encodeURIComponent(doomed!.id)}/cancel`,
		{
			expectedStartsAt: doomed!.startsAt,
		}
	)
	check('lesson in the far week cancelled', cancelled.status === 200, String(cancelled.status))
	return { today, wednesday, thursday, cancelledWednesday }
}

export async function gutterGeometry(page: Page) {
	return page.evaluate((linePaint) => {
		const rect = (element: Element) => element.getBoundingClientRect()
		const gutter = document.querySelector<HTMLElement>('[data-slot="week-grid-gutter"]')
		const corner = document.querySelector<HTMLElement>('[data-slot="week-grid-corner"]')
		const column = document.querySelector<HTMLElement>('[data-slot="week-grid-column"]')
		const day = document.querySelector<HTMLElement>('[data-slot="week-grid-day"]')
		const line = (hour: number) =>
			document.querySelector<HTMLElement>(`[data-slot="week-grid-line"][data-hour="${hour}"]`)
		const cells = (element: Element) =>
			Array.from(element.querySelectorAll<HTMLElement>('span')).map((span) => ({
				text: span.textContent,
				left: rect(span).left,
				right: rect(span).right,
				width: rect(span).width,
			}))
		const probe = document.createElement('div')
		probe.style.borderLeft = `1px solid ${linePaint}`
		document.body.append(probe)
		const expectedBorder = getComputedStyle(probe).borderLeftColor
		probe.remove()
		const rowZero = gutter!.children[0]
		const rowEight = gutter!.children[8]
		return {
			gutterLeft: rect(gutter!).left,
			gutterRight: rect(gutter!).right,
			gutterWidth: rect(gutter!).width,
			cornerWidth: rect(corner!).width,
			gridLeft: rect(column!).left,
			rowEight: cells(rowEight),
			rowEightCenter: rect(rowEight).top + rect(rowEight).height / 2,
			lineEightTop: rect(line(8)!).top,
			lineEightLeft: rect(line(8)!).left,
			rowZeroTop: rect(rowZero).top,
			lineZeroTop: rect(line(0)!).top,
			corner: cells(corner!),
			dayLeft: rect(day!).left,
			dayBorderWidth: getComputedStyle(day!).borderLeftWidth,
			dayBorderColor: getComputedStyle(day!).borderLeftColor,
			expectedBorder,
		}
	}, GCAL_LINE_PROBE)
}

export async function toolbarFacts(page: Page) {
	const targets = {
		Today: page.getByRole('button', { name: 'Today', exact: true }),
		'Previous week': page.getByRole('button', { name: 'Previous week' }),
		'Next week': page.getByRole('button', { name: 'Next week' }),
		'Second time zone': page.locator('[aria-label="Second time zone"]'),
		'Calendar view': page.getByRole('combobox', { name: 'Calendar view' }),
	}
	const facts: Record<string, { height: number; radius: number }> = {}
	for (const [name, locator] of Object.entries(targets)) {
		facts[name] = await locator.evaluate((element) => {
			const style = getComputedStyle(element)
			return { height: element.getBoundingClientRect().height, radius: parseFloat(style.borderTopLeftRadius) }
		})
	}
	return facts
}

export async function gridPart1(page: Page) {
	await openSchedule(page)
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	const near = (value: number, expected: number, tolerance = 0.6) => Math.abs(value - expected) <= tolerance
	let geo = await gutterGeometry(page)
	check(
		'gutter is 100px wide',
		near(geo.gutterWidth, 100) && near(geo.cornerWidth, 100),
		`${geo.gutterWidth}/${geo.cornerWidth}`
	)
	const [second, vn] = geo.rowEight
	check(
		'row 08:00: second zone left, Vietnam right',
		second?.text === '04:00' && vn?.text === '08:00',
		JSON.stringify(geo.rowEight)
	)
	check('row 08:00: two columns of 36px', near(second.width, 36) && near(vn.width, 36), `${second.width}/${vn.width}`)
	check('row 08:00: gap between the columns is 8px', near(vn.left - second.right, 8), String(vn.left - second.right))
	check(
		'row 08:00: Vietnam is 8px from the grid line',
		near(geo.gridLeft - vn.right, 8),
		String(geo.gridLeft - vn.right)
	)
	check(
		'row 08:00: 12px from the card edge to the second zone',
		near(second.left - geo.gutterLeft, 12),
		String(second.left - geo.gutterLeft)
	)
	const [cornerSecond, cornerVn] = geo.corner
	check(
		'corner names MSK and VN',
		geo.corner.map((item) => item.text).join(' ') === 'MSK VN',
		JSON.stringify(geo.corner)
	)
	check(
		'corner columns match the row columns',
		near(cornerSecond.left, second.left) && near(cornerVn.left, vn.left) && near(cornerVn.width, 36),
		JSON.stringify(geo.corner)
	)
	check(
		'hour line starts at the grid edge',
		near(geo.lineEightLeft, geo.gridLeft),
		`${geo.lineEightLeft}/${geo.gridLeft}`
	)
	check(
		'hour label 08:00 is centred on its line',
		near(geo.rowEightCenter, geo.lineEightTop + 0.5, 1.5),
		`${geo.rowEightCenter}/${geo.lineEightTop}`
	)
	check(
		'first label sits under the top line',
		near(geo.rowZeroTop, geo.lineZeroTop, 1.5),
		`${geo.rowZeroTop}/${geo.lineZeroTop}`
	)
	check(
		'day header has a hairline in line with the body separators',
		near(geo.dayLeft, geo.gridLeft) && geo.dayBorderWidth === '1px' && geo.dayBorderColor === geo.expectedBorder,
		`${geo.dayLeft}/${geo.gridLeft} ${geo.dayBorderWidth} ${geo.dayBorderColor}`
	)
	const midnight = await page.evaluate(() =>
		Array.from(
			document
				.querySelectorAll<HTMLElement>('[data-slot="week-grid-gutter"] > div')[4]
				.querySelectorAll<HTMLElement>('span')
		).map((span) => span.textContent)
	)
	check('midnight row of the second zone shows the weekday', midnight.join(' ') === 'Mon 04:00', midnight.join(' '))
	await shot(page, 'sched-grid', 'gutter')

	await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'none'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	geo = await gutterGeometry(page)
	check(
		'no second zone: one column of 36px',
		geo.rowEight.length === 1 && near(geo.rowEight[0].width, 36),
		JSON.stringify(geo.rowEight)
	)
	check(
		'no second zone: the label is 08:00, 8px from the line',
		geo.rowEight[0].text === '08:00' && near(geo.gridLeft - geo.rowEight[0].right, 8),
		String(geo.gridLeft - geo.rowEight[0].right)
	)
	check(
		'no second zone: one caption VN',
		geo.corner.length === 1 && geo.corner[0].text === 'VN',
		JSON.stringify(geo.corner)
	)
	check('no second zone: the gutter is still 100px', near(geo.gutterWidth, 100), String(geo.gutterWidth))
	await shot(page, 'sched-grid', 'gutter-none')
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	console.log(failures() === 0 ? 'GRID_PART1_OK' : 'GRID_PART1_FAIL')
}

export async function gridPart2Toolbar(page: Page) {
	const toolbar = await toolbarFacts(page)
	for (const [name, item] of Object.entries(toolbar)) {
		check(
			`toolbar: ${name} is 28px and round`,
			Math.abs(item.height - 28) <= 0.6 && item.radius >= item.height / 2,
			JSON.stringify(item)
		)
	}
	await shot(page, 'sched-grid', 'toolbar')
}

export async function gridPart2Blocks(
	page: Page,
	fx: Awaited<ReturnType<typeof gridFixtures>>,
	nav: { monday: string }
) {
	await goToWeek(page, nav, core.mondayOf(fx.wednesday))
	const data = await readBlocks(page)
	const onThursday = data.blocks
		.filter((block) => block.date === fx.thursday && block.label!.startsWith(`${GRID_A}, `))
		.sort((left, right) => left.top - right.top)
	check('four lessons on the fixture Thursday', onThursday.length === 4, String(onThursday.length))
	const [thirty, forty, fortyFive, sixty] = onThursday
	check(
		'30 minutes: one line "Name, HH:MM"',
		thirty?.lines.length === 1 && thirty.lines[0] === `${GRID_A}, 09:00`,
		JSON.stringify(thirty?.lines)
	)
	check('30 minutes: not lower than 22px', thirty !== undefined && thirty.height >= 21.5, String(thirty?.height))
	check(
		'40 minutes: one line "Name, HH:MM"',
		forty?.lines.length === 1 && forty.lines[0] === `${GRID_A}, 11:00`,
		JSON.stringify(forty?.lines)
	)
	check(
		'45 minutes: name and range',
		fortyFive?.lines.length === 2 && fortyFive.lines[1] === '14:00–14:45',
		JSON.stringify(fortyFive?.lines)
	)
	check(
		'60 minutes: name and range',
		sixty?.lines.length === 2 && sixty.lines[1] === '16:00–17:00',
		JSON.stringify(sixty?.lines)
	)
	check('week summary counts the lessons', /^\d+ lessons with \d+ students?$/.test(data.description), data.description)
	await shot(page, 'sched-grid', 'blocks')
}

export async function gridPart2Tooltip(page: Page, fx: Awaited<ReturnType<typeof gridFixtures>>) {
	const block = blockLocator(page, GRID_A, fx.wednesday)
	await block.scrollIntoViewIfNeeded()
	await block.hover()
	await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-slot="event-tooltip"]') !== null, null, {
		timeout: 1500,
	})
	await page.waitForTimeout(250)
	const tip = await page.evaluate(() => {
		const content = document.querySelector<HTMLElement>('[data-slot="event-tooltip"]')
		const info = (element: Element) => {
			const style = getComputedStyle(element)
			return {
				cls: element.className,
				size: style.fontSize,
				line: style.lineHeight,
				weight: style.fontWeight,
				numeric: style.fontVariantNumeric,
			}
		}
		const kids = Array.from(content!.children)
		return {
			name: info(kids[0]),
			date: info(kids[1]),
			main: info(content!.querySelector<HTMLElement>('[data-slot="time-main"]')!),
			second: info(content!.querySelector<HTMLElement>('[data-slot="time-second"]')!),
			status: info(kids[kids.length - 1]),
		}
	})
	const has = (item: { cls: string }, ...names: string[]) => names.every((name) => item.cls.split(/\s+/).includes(name))
	check(
		'tooltip: name is body, semibold',
		has(tip.name, 'text-body', 'font-semibold') && tip.name.size === '13px' && tip.name.weight === '600',
		JSON.stringify(tip.name)
	)
	check(
		'tooltip: date is body and muted',
		has(tip.date, 'text-body', 'text-muted-foreground') && !has(tip.date, 'text-caption') && tip.date.size === '13px',
		JSON.stringify(tip.date)
	)
	check(
		'tooltip: Vietnam range is body and tabular',
		has(tip.main, 'text-body', 'tabular-nums') && !has(tip.main, 'text-caption') && tip.main.size === '13px',
		JSON.stringify(tip.main)
	)
	check(
		'tooltip: second zone is micro and muted',
		has(tip.second, 'text-micro', 'text-muted-foreground') && tip.second.size === '11px' && tip.second.line === '14px',
		JSON.stringify(tip.second)
	)
	check(
		'tooltip: status is body',
		has(tip.status, 'text-body') && !has(tip.status, 'text-caption') && tip.status.size === '13px',
		JSON.stringify(tip.status)
	)
	checkPair('tooltip', await pairOf(page.locator('[data-slot="event-tooltip"]')), '18:00–19:00 VN', '14:00–15:00 MSK')
	await shot(page, 'sched-grid', 'tooltip')
}

export async function gridPart2CancelledWeek(
	page: Page,
	fx: Awaited<ReturnType<typeof gridFixtures>>,
	nav: { monday: string }
) {
	await page.mouse.move(4, 4)
	await page.waitForTimeout(400)
	await goToWeek(page, nav, core.mondayOf(fx.cancelledWednesday))
	const far = await readBlocks(page)
	check(
		'far week: only the cancelled lesson is shown',
		far.blocks.length === 1 && far.blocks[0].label!.endsWith(', cancelled'),
		JSON.stringify(far.blocks.map((item) => item.label))
	)
	check(
		'far week: summary names the cancellation',
		far.description === 'No lessons this week · 1 cancelled',
		far.description
	)
	await shot(page, 'sched-grid', 'cancelled-week')
}

export async function gridPart2(page: Page, fx: Awaited<ReturnType<typeof gridFixtures>>, nav: { monday: string }) {
	await gridPart2Toolbar(page)
	await gridPart2Blocks(page, fx, nav)
	await gridPart2Tooltip(page, fx)
	await gridPart2CancelledWeek(page, fx, nav)
}

export async function grid() {
	cleanupFixtures('grid start', GRID_LIKE)

	await withBrowser(
		{ width: 1440, height: 900 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await gridFixtures(page)
			await gridPart1(page)
			const nav = { monday: core.mondayOf(core.zonedParts(new Date(), VN).date) }
			await gridPart2(page, fx, nav)
			const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		},
		() => cleanupFixtures('grid end', GRID_LIKE)
	)
	if (failures() === 0) console.log('SCHEDULE_WEB_GRID_OK')
}
