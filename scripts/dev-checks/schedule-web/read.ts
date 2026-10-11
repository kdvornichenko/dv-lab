import type { Page } from 'playwright-core'

import * as core from '../../../packages/core/src/index.ts'
import { check, shot, failures, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import { readBlocks, ofCard } from './block-probes.ts'
import { cleanupFixtures } from './fixtures.ts'
import { expectedRange, dayMonth } from './format.ts'
import { lessonCreation } from './lesson-creation.ts'
import { lessonPreview } from './lesson-preview.ts'
import { goToWeek, shotEvening, setTheme, openSchedule } from './navigation.ts'
import { readFixtures, NAME_A, NAME_B, READ_LIKE } from './read-fixtures.ts'

export async function readPartError(page: Page, fx: Awaited<ReturnType<typeof readFixtures>>, nav: { monday: string }) {
	await goToWeek(page, nav, fx.week0)
	await page.route('**/api/schedule/week*', (route) => route.abort())
	await page.keyboard.press('j')
	nav.monday = fx.week1
	await page.getByText('Could not load schedule').waitFor({ timeout: 15000 })
	const shown = await page.evaluate(() => ({
		h1: document.querySelector<HTMLElement>('h1')?.textContent,
		refresh: Array.from(document.querySelectorAll<HTMLButtonElement>('button')).some(
			(button) => button.textContent?.trim() === 'Refresh'
		),
		grid: document.querySelectorAll<HTMLElement>('[data-slot="week-grid"]').length,
	}))
	check(
		'read error: h1 is Schedule with a Refresh button and no grid',
		shown.h1 === 'Schedule' && shown.refresh && shown.grid === 0,
		JSON.stringify(shown)
	)
	await shot(page, 'sched-read', 'error')
	await page.unroute('**/api/schedule/week*')
	await page.getByRole('button', { name: 'Refresh' }).click()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 15000 })
	const back = await page.evaluate(() => document.querySelector<HTMLElement>('h1')?.textContent)
	check('read error: Refresh brings the grid back on the same week', back === expectedRange(fx.week1), back)
}

export async function readPart1Week0(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string }
) {
	await goToWeek(page, nav, fx.week0)
	const w0 = await readBlocks(page)
	const a0 = ofCard(w0, NAME_A).find((block) => block.date === fx.wednesday)
	const b0 = ofCard(w0, NAME_B).find((block) => block.date === fx.wednesday)
	const b1 = ofCard(w0, NAME_B).find((block) => block.date === fx.thursday)
	check('week 0: both Wednesday blocks drawn', Boolean(a0) && Boolean(b0))
	check(
		'week 0: overlapping blocks sit side by side',
		Boolean(a0 && b0) &&
			a0!.left !== b0!.left &&
			Math.abs(a0!.width - (w0.columnWidth / 2 - 6)) <= 1.5 &&
			Math.abs(b0!.width - (w0.columnWidth / 2 - 6)) <= 1.5,
		a0 && b0 ? `${a0.left}/${b0.left}/${a0.width}/${w0.columnWidth}` : ''
	)
	checkPlannedBlock(w0, a0)
	check(
		'week 0: no title attribute on blocks',
		w0.blocks.every((block) => block.title === null)
	)
	check(
		'week 0: 30 minute lesson is one line "Name, 09:00"',
		Boolean(b1) && b1!.text === `${NAME_B}, 09:00` && b1!.lines.length === 1,
		b1?.text
	)
	check(
		'week 0: 30 minute lesson is 22px high',
		Boolean(b1) && Math.abs(b1!.height - 22) <= 1.5 && Math.abs(b1!.top - 9 * 48) <= 1.5,
		b1 ? `${b1.top}/${b1.height}` : ''
	)
	check(
		'week 0: every fixture block carries data-key and data-slot to',
		[a0, b0, b1].every((block) => block && block.key && block.slot === 'to')
	)
	check(
		'week 0: summary line has the lessons-with-students shape',
		/^\d+ lessons? with \d+ students?( · \d+ cancelled)?$/.test(w0.description),
		w0.description
	)
	const counts = /^(\d+) lessons? with (\d+) students?/.exec(w0.description)
	check(
		'week 0: summary counts the fixture lessons',
		Boolean(counts) && Number(counts![1]) >= 3 && Number(counts![2]) >= 2,
		w0.description
	)
	check(
		'week 0: live line names the week and the lesson count',
		w0.live.startsWith('Week of ') && /, \d+ lessons?$/.test(w0.live),
		w0.live
	)
	await shot(page, 'sched-read', 'week0')
}

export async function readPart1Week1(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string }
) {
	await goToWeek(page, nav, fx.week1)
	const w1 = await readBlocks(page)
	const from1 = ofCard(w1, NAME_A).find((block) => block.slot === 'from')
	const to1 = ofCard(w1, NAME_A).find((block) => block.slot === 'to' && block.date === fx.movedTo)
	check('week +1: moved original is drawn on Wednesday', Boolean(from1) && from1!.date === fx.movedFrom)
	check(
		'week +1: moved original has a dashed outline and no fill',
		Boolean(from1) &&
			from1!.outlineStyle === 'dashed' &&
			from1!.outlineWidth === '2px' &&
			from1!.background === w1.transparent,
		from1 ? `${from1.outlineStyle}/${from1.outlineWidth}/${from1.background}` : ''
	)
	check(
		'week +1: moved original names the new day',
		Boolean(from1) &&
			from1!.lines[1] === `→ ${dayMonth(fx.movedTo)}` &&
			from1!.label!.endsWith(`moved to ${dayMonth(fx.movedTo)}`),
		from1 ? `${from1.lines.join('|')} / ${from1.label}` : ''
	)
	check(
		'week +1: destination is planned on Friday at 10:00',
		Boolean(to1) && Math.abs(to1!.top - 10 * 48) <= 1.5 && to1!.background === w1.selected && to1!.key === from1?.key,
		to1 ? `${to1.top}` : ''
	)
	await shot(page, 'sched-read', 'week1')
}

export async function readPart1Far(page: Page, fx: Awaited<ReturnType<typeof readFixtures>>, nav: { monday: string }) {
	await shotEvening(page, 'week1-evening')
	await goToWeek(page, nav, fx.week2)
	const w2 = await readBlocks(page)
	const cancelled = ofCard(w2, NAME_A).find((block) => block.date === fx.cancelledOn)
	check('week +2: cancelled block is drawn', Boolean(cancelled))
	check(
		'week +2: cancelled block is struck through and has no fill',
		Boolean(cancelled) && cancelled!.decoration.includes('line-through') && cancelled!.background === w2.transparent,
		cancelled ? `${cancelled.decoration}/${cancelled.background}` : ''
	)
	check(
		'week +2: aria-label says cancelled',
		Boolean(cancelled) && cancelled!.label!.endsWith(', cancelled'),
		cancelled?.label
	)
	check('week +2: summary shows the cancellation', / · \d+ cancelled$/.test(w2.description), w2.description)
	await shotEvening(page, 'week2-evening')
	const empty = core.addDays(fx.week0, -40 * 7)
	await goToWeek(page, nav, empty)
	const w3 = await readBlocks(page)
	check(
		'far week: no fixture blocks',
		w3.blocks.every((block) => !block.label!.includes('Alex Example 2007'))
	)
	check(
		'far week: summary is empty or in shape',
		w3.description === 'No lessons this week' || /^\d+ lessons? with \d+ students?/.test(w3.description),
		w3.description
	)
	await shot(page, 'sched-read', 'far')
}

export async function readPart1(page: Page, fx: Awaited<ReturnType<typeof readFixtures>>, nav: { monday: string }) {
	await readPart1Week0(page, fx, nav)
	await readPart1Week1(page, fx, nav)
	await readPart1Far(page, fx, nav)
}

function checkPlannedBlock(
	w0: Awaited<ReturnType<typeof readBlocks>>,
	a0: Awaited<ReturnType<typeof readBlocks>>['blocks'][number] | undefined
) {
	check(
		'week 0: block starts at 18:00 with 48px hours',
		Boolean(a0) && Math.abs(a0!.top - 18 * 48) <= 1.5 && Math.abs(a0!.height - 46) <= 1.5,
		a0 ? `${a0.top}/${a0.height}` : ''
	)
	check(
		'week 0: planned block is filled with --selected',
		Boolean(a0) && a0!.background === w0.selected && w0.selected !== w0.transparent,
		a0 ? `${a0.background} / ${w0.selected}` : ''
	)
	check('week 0: block text is not painted in the fill colour', Boolean(a0) && a0!.color !== a0!.background)
	check(
		'week 0: aria-label says planned',
		Boolean(a0) && a0!.label!.endsWith(', planned') && a0!.label!.includes('18:00–19:00 VN'),
		a0?.label
	)
	check(
		'week 0: second zone is in brackets in the label',
		Boolean(a0) && a0!.label!.includes('18:00–19:00 VN (14:00–15:00 MSK), planned'),
		a0?.label
	)
	check(
		'week 0: name line and range line',
		Boolean(a0) && a0!.lines.join('|') === `${NAME_A}|18:00–19:00`,
		a0?.lines.join('|')
	)
}

export async function readPart1Loading(
	page: Page,
	fx: Awaited<ReturnType<typeof readFixtures>>,
	nav: { monday: string }
) {
	await goToWeek(page, nav, fx.week1)
	const w1 = await readBlocks(page)
	await goToWeek(page, nav, core.addDays(fx.week0, -7))
	let release: (() => void) | undefined
	const held = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/api/schedule/week*', async (route) => {
		if (route.request().url().includes(`start=${fx.week0}`)) await held
		await route.continue()
	})
	await page.keyboard.press('j')
	nav.monday = fx.week0
	await page.waitForTimeout(150)
	const loading = await page.evaluate(() => ({
		h1: document.querySelector<HTMLElement>('h1')?.textContent,
		grid: document.querySelectorAll<HTMLElement>('[data-slot="week-grid"]').length,
		skeleton: document.querySelectorAll<HTMLElement>('[data-slot="skeleton"]').length,
		next: document.querySelector<HTMLButtonElement>('button[aria-label="Next week"]')?.disabled,
	}))
	check(
		'loading: real header and a skeleton instead of the grid',
		loading.h1 === expectedRange(fx.week0) && loading.grid === 0 && loading.skeleton > 0,
		JSON.stringify(loading)
	)
	check('loading: week navigation stays enabled', loading.next === false)
	await page.keyboard.press('j')
	nav.monday = fx.week1
	await page.waitForFunction(
		(expected) => document.querySelector<HTMLElement>('[data-slot="week-grid-day"]')?.dataset.date === expected,
		fx.week1,
		{ timeout: 30000 }
	)
	release!()
	await page.waitForTimeout(800)
	const after = await readBlocks(page)
	check(
		'stale week response is ignored',
		after.h1 === expectedRange(fx.week1) && after.description === w1.description && after.live === w1.live,
		`${after.description} / ${w1.description}`
	)
	await page.unroute('**/api/schedule/week*')
}

export async function read() {
	cleanupFixtures('read start', READ_LIKE)

	await withBrowser(
		{ width: 1440, height: 900 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await readFixtures(page)
			await openSchedule(page)
			const nav = { monday: core.mondayOf(fx.today) }
			await readPart1(page, fx, nav)
			await readPart1Loading(page, fx, nav)
			await readPartError(page, fx, nav)
			await lessonPreview(page, fx, nav)
			await lessonCreation(page, fx, nav)
			const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		},
		() => cleanupFixtures('read end', READ_LIKE)
	)
	if (failures() === 0) console.log('SCHEDULE_WEB_READ_OK')
}
