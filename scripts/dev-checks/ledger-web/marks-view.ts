import type { Page } from 'playwright-core'

import type { ScheduleOccurrenceResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, failures, shot } from '../browser-context.ts'
import {
	VN,
	openSchedule,
	goToWeek,
	createCard,
	setOpening,
	createOnce,
	markApi,
	blockFacts,
	tooltipText,
} from './common.mjs'

export async function marksFixtures(page: Page) {
	const today = core.zonedParts(new Date(), VN).date
	const yesterday = core.addDays(today, -1)
	const opening = core.addDays(today, -2)
	const names = {
		done: 'Alex Example 2182 A',
		noShow: 'Alex Example 2182 B',
		none: 'Alex Example 2182 C',
		cancelled: 'Alex Example 2182 D',
	}
	const ids: Record<string, string> = {}
	const lessons: Record<string, string> = {}
	let hour = 9
	for (const [key, name] of Object.entries(names)) {
		ids[key] = await createCard(page, name)
		await setOpening(page, ids[key], opening)
		lessons[key] = await createOnce(page, ids[key], yesterday, `${String(hour).padStart(2, '0')}:00`)
		hour += 2
	}
	await markApi(page, lessons.done, 'done')
	await markApi(page, lessons.noShow, 'no_show')
	await markApi(page, lessons.cancelled, 'done')
	const cancel = await api<ScheduleOccurrenceResponse & Partial<ErrorResponse>>(
		page,
		'POST',
		`/schedule/lessons/${lessons.cancelled}/cancel`,
		{}
	)
	check('api cancel of the marked lesson', cancel.status === 200, String(cancel.status))
	return { today, yesterday, tomorrow: core.addDays(today, 1), opening, names, ids, lessons }
}

export async function marksPart1(
	page: Page,
	fx: Awaited<ReturnType<typeof marksFixtures>>,
	nav: { monday: string | null }
) {
	await openSchedule(page)
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.yesterday))

	const done = await blockFacts(page, fx.names.done, fx.yesterday)
	const noShow = await blockFacts(page, fx.names.noShow, fx.yesterday)
	const none = await blockFacts(page, fx.names.none, fx.yesterday)
	const cancelled = await blockFacts(page, fx.names.cancelled, fx.yesterday)
	await shot(page, 'ledger-marks', 'grid')

	check('C has the warning dot', none.signKind === 'dot' && none.signWidth === '8px', JSON.stringify(none))
	check('C aria-label says needs a mark', none.label.endsWith(', needs a mark'), none.label)
	check('C keeps full opacity', none.opacity === '1', none.opacity)
	check('A is dimmed to 0.6 with a check', done.opacity === '0.6' && done.signKind === 'check', JSON.stringify(done))
	check('A sign is 12px and hidden from assistive tech', done.signWidth === '12px' && done.signAria === 'true')
	check('A aria-label says done', done.label.endsWith(', done'), done.label)
	check(
		'B is dimmed to 0.6 with user-x',
		noShow.opacity === '0.6' && noShow.signKind === 'user-x',
		JSON.stringify(noShow)
	)
	check('B aria-label says no-show', noShow.label.endsWith(', no-show'), noShow.label)
	check(
		'D has a struck name and no sign although a mark is kept',
		cancelled.decoration.includes('line-through') && cancelled.signKind === null,
		JSON.stringify(cancelled)
	)
	check('D aria-label says cancelled', cancelled.label.endsWith(', cancelled'), cancelled.label)
	check('D is not dimmed', cancelled.opacity === '1', cancelled.opacity)
	check(
		'the title keeps 16px at the right of a sign',
		done.titlePadding === '16px' && none.titlePadding === '16px' && done.titleRight! - 16 <= done.signLeft! + 0.5,
		`${done.titlePadding} ${done.titleRight} ${done.signLeft}`
	)

	await markTooltips(page, fx)
	console.log(failures() === 0 ? 'MARKS_WEB_PART1_OK' : 'MARKS_WEB_PART1_FAIL')
}

async function markTooltips(page: Page, fx: Awaited<ReturnType<typeof marksFixtures>>) {
	const tipA = await tooltipText(page, fx.names.done, fx.yesterday)
	check(
		'tooltip A says Done and Deducts 1 lesson',
		tipA?.includes('Done') && tipA.includes('Deducts 1 lesson'),
		tipA ?? 'none'
	)
	await shot(page, 'ledger-marks', 'tooltip-done')
	const tipB = await tooltipText(page, fx.names.noShow, fx.yesterday)
	check(
		'tooltip B says No-show and Deducts 1 lesson',
		tipB?.includes('No-show') && tipB.includes('Deducts 1 lesson'),
		tipB ?? 'none'
	)
	const tipC = await tooltipText(page, fx.names.none, fx.yesterday)
	check(
		'tooltip C says Needs a mark and Click to mark it.',
		tipC?.includes('Needs a mark') && tipC.includes('Click to mark it.'),
		tipC ?? 'none'
	)
	await shot(page, 'ledger-marks', 'tooltip-needs-mark')
	const tipD = await tooltipText(page, fx.names.cancelled, fx.yesterday)
	check(
		'tooltip D says Cancelled and no deduction line',
		tipD?.includes('Cancelled') && !tipD.includes('Deducts') && !tipD.includes('Click to mark'),
		tipD ?? 'none'
	)
	const focusable = await page.evaluate(
		() =>
			document
				.querySelector<HTMLElement>('[data-slot="event-tooltip"]')
				?.parentElement?.querySelector<HTMLInputElement>('button, a, input, [tabindex]') !== null
	)
	check('tooltip stays not focusable', focusable === false)
	await page.mouse.move(2, 2)
	console.log(failures() === 0 ? 'MARKS_WEB_PART1_OK' : 'MARKS_WEB_PART1_FAIL')
}
