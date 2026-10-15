import type { Locator, Page } from '@playwright/test'

import type {
	ErrorResponse,
	ScheduleLessonResponse,
	StudentLesson,
	StudentLessonsResponse,
	StudentResponse,
} from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { BASE, api, check, failures, shot, signIn, sql } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import { VN, setTheme } from './common.mjs'

const NAMES = ['Alex Example 2550', 'Alex Example 2551', 'Alex Example 2552'] as const
const TAB = '[data-slot="lessons-tab"]'
const LOADED = `${TAB}:not([data-state="loading"])`
const ROW = '[data-slot="lessons-row"]'
const BLOCK = '[data-slot="held-dates"]'

const today = core.scheduleToday(new Date(), VN)
const day = (shift: number) => core.addDays(today, shift)

const cutoffText = `(select history_cutover_at from google_connections where retired_at is null order by created_at desc limit 1)`

function pastAnchor() {
	const cutoff = exec(`select ${cutoffText} as at`)[0]?.at
	if (typeof cutoff !== 'string') return today
	const cutoffDay = core.scheduleDate(new Date(cutoff), VN)
	return core.addDays(cutoffDay < today ? cutoffDay : today, -1)
}

const anchor = pastAnchor()
const back = (shift: number) => core.addDays(anchor, shift)

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const parts = (date: string) => ({
	year: Number(date.slice(0, 4)),
	month: Number(date.slice(5, 7)) - 1,
	day: Number(date.slice(8, 10)),
})
const yearSuffix = (date: string) => (parts(date).year === parts(today).year ? '' : ` ${parts(date).year}`)

function withWeekday(date: string) {
	const { month, day: dayOfMonth } = parts(date)
	const weekday = WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
	return `${weekday} ${dayOfMonth} ${SHORT_MONTHS[month]}${yearSuffix(date)}`
}

function dayMonth(date: string) {
	const { month, day: dayOfMonth } = parts(date)
	return `${dayOfMonth} ${SHORT_MONTHS[month]}`
}

function period(from: string, to: string) {
	const start = parts(from)
	const end = parts(to)
	if (from === to) return `${start.day} ${SHORT_MONTHS[start.month]}${yearSuffix(from)}`
	if (start.year !== end.year)
		return `${start.day} ${SHORT_MONTHS[start.month]} ${start.year}–${end.day} ${SHORT_MONTHS[end.month]} ${end.year}`
	if (start.month === end.month) return `${start.day}–${end.day} ${SHORT_MONTHS[end.month]}${yearSuffix(from)}`
	return `${start.day} ${SHORT_MONTHS[start.month]}–${end.day} ${SHORT_MONTHS[end.month]}${yearSuffix(from)}`
}

function monthLines(dates: string[]) {
	const byMonth = new Map<string, number[]>()
	for (const date of [...new Set(dates)].sort()) {
		const key = date.slice(0, 7)
		byMonth.set(key, [...(byMonth.get(key) ?? []), parts(date).day])
	}
	return [...byMonth.entries()].map(([key, days]) => `${days.join(', ')} - ${LONG_MONTHS[Number(key.slice(5, 7)) - 1]}`)
}

function exec(text: string) {
	return sql(text).rows as unknown as Array<Record<string, unknown>>
}

function cleanup() {
	const where = `display_name in (${NAMES.map(quote).join(', ')}) and import_key is null`
	exec(`do $$ begin
delete from lesson_comments where student_id in (select id from students where ${where});
delete from student_terms where student_id in (select id from students where ${where});
delete from lesson_marks where lesson_id in (select id from lessons where student_id in (select id from students where ${where}));
delete from lessons where student_id in (select id from students where ${where});
delete from payments where student_id in (select id from students where ${where});
delete from student_sections where student_id in (select id from students where ${where});
delete from students where ${where};
end $$`)
	const left = Number(exec(`select count(*)::int as n from students where ${where}`)[0]?.n ?? -1)
	console.log(`profile fixture cards left ${left}`)
	return left
}

async function card(page: Page, name: string) {
	const created = await api<StudentResponse & Partial<ErrorResponse>>(page, 'POST', '/students', {
		displayName: name,
		rateMinor: 100000,
		currency: 'RUB',
		defaultLessonMinutes: 60,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
	})
	check(`${name} card created`, created.status === 201, String(created.status))
	return created.json!.student.id
}

async function opening(page: Page, id: string, on: string) {
	const result = await api(page, 'PUT', `/students/${id}/opening-balance`, {
		lessonsHundredths: 0,
		on,
		expectedDefaultTimeZone: VN,
	})
	check('opening balance set', result.status === 200, String(result.status))
}

async function pay(page: Page, id: string, paidOn: string, hundredths: number) {
	const result = await api<{ payment: { id: string } }>(page, 'POST', '/payments', {
		studentId: id,
		paidOn,
		expectedDefaultTimeZone: VN,
		amountMinor: 100000,
		currency: 'RUB',
		lessonsHundredths: hundredths,
		note: null,
	})
	check(
		`payment ${paidOn} recorded`,
		result.status === 201,
		`${result.status} ${JSON.stringify(result.json).slice(0, 160)}`
	)
	return result.json!.payment.id
}

function lessonAt(id: string, date: string, status = 'scheduled', time = '10:00') {
	const startsAt = core.zonedInstant(date, time, VN)
	const created = startsAt.getTime() < Date.now() ? `coalesce(${cutoffText} - interval '1 minute', now())` : 'now()'
	return String(
		exec(
			`insert into lessons (student_id, starts_at, duration_minutes, status, created_at) values (${quote(id)}, ${quote(startsAt.toISOString())}, 60, ${quote(status)}, ${created}) returning id`
		)[0]?.id
	)
}

async function mark(page: Page, lessonId: string, kind: 'done' | 'no_show') {
	const result = await api<ScheduleLessonResponse & Partial<ErrorResponse>>(
		page,
		'POST',
		`/schedule/lessons/${lessonId}/mark`,
		{ kind }
	)
	check(`lesson marked ${kind}`, result.status === 200, `${result.status} ${JSON.stringify(result.json).slice(0, 160)}`)
}

async function fixtures(page: Page) {
	const main = await card(page, NAMES[0])
	await opening(page, main, back(-30))
	const l1 = lessonAt(main, back(-20))
	const l2 = lessonAt(main, back(-14))
	await mark(page, l1, 'done')
	await mark(page, l2, 'done')
	await pay(page, main, back(-12), 300)
	const l3 = lessonAt(main, back(-9))
	const l4 = lessonAt(main, back(-7))
	await mark(page, l3, 'done')
	await mark(page, l4, 'no_show')
	await pay(page, main, back(-4), 200)
	const l6 = lessonAt(main, back(-3))
	await mark(page, l6, 'done')
	lessonAt(main, back(-2), 'cancelled')
	lessonAt(main, back(-1))
	lessonAt(main, today, 'scheduled', '23:50')
	lessonAt(main, day(2))
	lessonAt(main, day(4))
	exec(
		`insert into lesson_comments (lesson_id, student_id, body) values (${quote(l6)}, ${quote(main)}, 'Worked on linking words.')`
	)
	exec(
		`insert into student_sections (student_id, kind, body) values (${quote(main)}, 'general_info', 'Prefers short tasks.') on conflict (student_id, kind) do update set body = excluded.body`
	)
	exec(`insert into student_terms (student_id, term, note, added_by) values (${quote(main)}, 'cohesion', null, 'chat')`)

	const bare = await card(page, NAMES[1])
	lessonAt(bare, back(-1))
	lessonAt(bare, day(1))

	const empty = await card(page, NAMES[2])
	await opening(page, empty, back(-30))
	await pay(page, empty, back(-3), 200)
	return { main, bare, empty }
}

async function readLessons(page: Page, id: string, query: string) {
	const result = await api<StudentLessonsResponse>(page, 'GET', `/students/${id}/lessons?${query}`)
	check(`api ${query.slice(0, 24)} answers 200`, result.status === 200, String(result.status))
	return result.json!
}

async function openTab(page: Page, id: string, name: string) {
	await page.goto(`${BASE}/students/${id}?tab=lessons`)
	await page.getByRole('heading', { name, level: 1 }).waitFor({ timeout: 30000 })
	await page.locator(LOADED).waitFor({ timeout: 30000 })
	await page.waitForTimeout(300)
}

const text = async (locator: Locator) => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim()

const rowKeys = (page: Page) =>
	page.locator(ROW).evaluateAll((list) => list.map((node) => node.getAttribute('data-key')))

const blockLines = (page: Page) =>
	page
		.locator(`${BLOCK} [data-slot="held-dates-month"]`)
		.evaluateAll((list) => list.map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim()))

function newestFirst(lessons: StudentLesson[]) {
	return [...lessons].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)).map((lesson) => lesson.key)
}

function heldSince(body: StudentLessonsResponse) {
	return body.lessons.filter((lesson) => lesson.held && lesson.sinceLastPayment)
}

function rangeButton(page: Page) {
	return page.locator('[data-slot="lessons-range"]')
}

async function openRange(page: Page) {
	await rangeButton(page).click()
	const popover = page.locator('[data-slot="lessons-range-popover"]')
	await popover.waitFor({ timeout: 10000 })
	await page.waitForTimeout(250)
	return popover
}

async function sincePart(page: Page, id: string, name: string) {
	await openTab(page, id, name)
	const body = await readLessons(page, id, 'range=since_payment')
	const held = heldSince(body)
	const dates = held.map((lesson) => lesson.date)
	const minutes = held.reduce((sum, lesson) => sum + lesson.durationMinutes, 0)
	check(
		'since payment: the fixture has a late payment and two held lessons since it',
		held.length === 2,
		String(held.length)
	)
	check(
		'since payment: the tab opens on Since last payment',
		(await rangeButton(page).getAttribute('aria-label')) === 'Date range: Since last payment'
	)
	check(
		'since payment: the block title and scope line follow the api',
		(await text(page.locator(`${BLOCK} p`).first())) === 'Held lessons since the last payment' &&
			(await text(page.locator('[data-slot="held-dates-scope"]'))) ===
				`Payment of ${withWeekday(body.lastPayment!.paidOn)} · ${dates.length} dates · ${minutes} min`,
		await text(page.locator('[data-slot="held-dates-scope"]'))
	)
	const lines = await blockLines(page)
	check(
		'since payment: the dates of the block are held && sinceLastPayment of the api',
		JSON.stringify(lines) === JSON.stringify(monthLines(dates)),
		lines.join(' | ')
	)
	const keys = await rowKeys(page)
	check(
		'since payment: the list holds every lesson of the api, newest first',
		JSON.stringify(keys) === JSON.stringify(newestFirst(body.lessons)),
		`${keys.length} / ${body.lessons.length}`
	)
	const lastHeld = [...body.lessons]
		.filter((lesson) => lesson.held)
		.sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))[0]!
	const balance = await text(page.locator(`${ROW}[data-key="${lastHeld.key}"] [data-slot="lessons-balance-after"]`))
	check(
		'since payment: Balance after of the last held lesson is the api value',
		balance === core.balancePhrase(lastHeld.balanceAfterMinutes!, body.defaultLessonMinutes, { short: true }),
		balance
	)
	check(
		'since payment: a lesson held before the payment says Paid after the lesson',
		(await page.locator(`${ROW} >> text=Paid after the lesson`).count()) ===
			body.lessons.filter((lesson) => lesson.payment?.paidAfter).length
	)
	const note = await text(page.locator('[data-slot="held-dates-note"]'))
	const before = dates.filter((date) => date < body.lastPayment!.paidOn)
	check(
		'since payment: the note about lessons held before the payment shows only when there are such',
		before.length === 0 ? note === '' : note.includes('held before the payment on'),
		note
	)
	const future = body.lessons.filter((lesson) => Date.parse(lesson.startsAt) > Date.now()).length
	check(
		'since payment: the Now line sits between the lessons ahead and the past ones',
		(await page.locator('[data-slot="lessons-now"]').count()) === (future > 0 ? 1 : 0)
	)
	const showing = await text(page.locator('[data-slot="lessons-showing"]'))
	check(
		'since payment: Showing N of M and the totals follow the api',
		showing.startsWith(`Showing ${body.lessons.length} of ${body.lessons.length} lessons`) &&
			showing.includes(`${body.totals.heldCount} lessons, ${body.totals.heldMinutes} min`),
		showing
	)
	await shot(page, 'ledger-profile', 'since')

	const first = dates[0]!
	const last = dates[dates.length - 1]!
	const expected = [
		`Lessons of ${NAMES[0]}, ${period(first, last)}`,
		`Held lessons since the last payment (${withWeekday(body.lastPayment!.paidOn)})`,
		...monthLines(dates),
	].join('\n')
	await page.getByRole('button', { name: 'Copy dates' }).click()
	await page.waitForTimeout(250)
	const copied = await page.evaluate(() => navigator.clipboard.readText())
	check(
		'copy: Copy dates puts the title, the scope line and the month lines on the clipboard',
		copied === expected,
		copied.replaceAll('\n', ' / ')
	)

	const done = body.lessons.filter((lesson) => lesson.outcome === 'done')
	await page.locator('[data-slot="lessons-outcome-filter"]').click()
	await page.getByRole('button', { name: /^Done/, pressed: false }).click()
	await page.keyboard.press('Escape')
	await page.waitForTimeout(300)
	const filtered = await rowKeys(page)
	check(
		'filter: Done narrows the list to the done lessons of the api',
		JSON.stringify(filtered) === JSON.stringify(newestFirst(done)),
		`${filtered.length} / ${done.length}`
	)
	check(
		'filter: Showing follows the filter and the block does not change',
		(await text(page.locator('[data-slot="lessons-showing"]'))).startsWith(
			`Showing ${done.length} of ${body.lessons.length} lessons`
		) && JSON.stringify(await blockLines(page)) === JSON.stringify(lines)
	)
	check(
		'filter: a chip and Reset filter appear',
		(await page.getByRole('button', { name: 'Reset filter' }).count()) === 1
	)
	await shot(page, 'ledger-profile', 'filtered')
	await page.locator('[data-slot="lessons-outcome-filter"]').click()
	await page.getByRole('button', { name: /^Done/, pressed: true }).click()
	await page.getByRole('button', { name: /^Cancelled/ }).click()
	await page.getByRole('button', { name: /^Done/, pressed: false }).click()
	await page.keyboard.press('Escape')
	await page.waitForTimeout(300)
	check(
		'filter: two outcomes show the union',
		(await rowKeys(page)).length ===
			body.lessons.filter((lesson) => lesson.outcome === 'done' || lesson.outcome === 'cancelled').length
	)
	await page.getByRole('button', { name: 'Reset filter' }).click()
	await page.waitForTimeout(300)
	check('filter: Reset filter brings every lesson back', (await rowKeys(page)).length === body.lessons.length)
	return body
}

async function rangePart(page: Page, id: string) {
	let popover = await openRange(page)
	const group = popover.getByRole('group', { name: 'Date range' })
	check(
		'range: the presets run Since last payment, This month, Last 30 days, Custom range',
		(await group.getByRole('button').allInnerTexts()).map((name) => name.split('\n')[0]).join(',') ===
			'Since last payment,This month,Last 30 days,Custom range'
	)
	check(
		'range: Since last payment is the chosen preset',
		(await group.getByRole('button', { name: /^Since last payment/ }).getAttribute('aria-pressed')) === 'true'
	)
	await shot(page, 'ledger-profile', 'range-popover')
	await page.keyboard.press('Escape')
	await popover.waitFor({ state: 'detached', timeout: 10000 })
	check(
		'range: Esc closes the popover and keeps the range',
		(await rangeButton(page).getAttribute('aria-label')) === 'Date range: Since last payment'
	)

	popover = await openRange(page)
	await popover.getByRole('button', { name: /^This month/ }).click()
	await popover.waitFor({ state: 'detached', timeout: 10000 })
	await page.locator(LOADED).waitFor({ timeout: 15000 })
	await page.waitForTimeout(400)
	const monthFrom = `${today.slice(0, 7)}-01`
	const monthTo = new Date(Date.UTC(parts(today).year, parts(today).month + 1, 0)).toISOString().slice(0, 10)
	const month = await readLessons(page, id, `from=${monthFrom}&to=${monthTo}`)
	check(
		'range: This month lists the whole month, lessons ahead too',
		JSON.stringify(await rowKeys(page)) === JSON.stringify(newestFirst(month.lessons)) &&
			(await text(page.locator(`${BLOCK} p`).first())) === `Held lessons, ${period(monthFrom, monthTo)}`,
		`${(await rowKeys(page)).length} / ${month.lessons.length}`
	)

	popover = await openRange(page)
	await popover.getByRole('button', { name: /^Last 30 days/ }).click()
	await popover.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(500)
	const last30 = await readLessons(page, id, `from=${day(-29)}&to=${today}`)
	check(
		'range: Last 30 days lists the 30 days ending today',
		JSON.stringify(await rowKeys(page)) === JSON.stringify(newestFirst(last30.lessons)),
		`${(await rowKeys(page)).length} / ${last30.lessons.length}`
	)

	popover = await openRange(page)
	await popover.getByRole('button', { name: /^Custom range/ }).click()
	const days = popover.locator('button[data-day]')
	await days.first().waitFor({ timeout: 10000 })
	const firstDay = days.filter({ hasText: /^14$/ })
	const secondDay = days.filter({ hasText: /^5$/ })
	const label = (value: string | null) => {
		const [month, dayOfMonth, year] = (value ?? '').split('/').map(Number)
		return `${year}-${String(month).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`
	}
	const firstAttr = await firstDay.getAttribute('data-day')
	const secondAttr = await secondDay.getAttribute('data-day')
	await firstDay.click()
	check(
		'range: the first click of Custom range asks for the last day',
		(await text(popover)).includes('Choose the last day')
	)
	await secondDay.click()
	await popover.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(500)
	const [from, to] = [label(firstAttr), label(secondAttr)].sort() as [string, string]
	check(
		'range: reversed days swap and the button names the two dates',
		(await rangeButton(page).getAttribute('aria-label')) === `Date range: ${period(from, to)}`,
		String(await rangeButton(page).getAttribute('aria-label'))
	)
	const custom = await readLessons(page, id, `from=${from}&to=${to}`)
	check(
		'range: the custom range lists the lessons of the api',
		JSON.stringify(await rowKeys(page)) === JSON.stringify(newestFirst(custom.lessons)),
		`${(await rowKeys(page)).length} / ${custom.lessons.length}`
	)
	popover = await openRange(page)
	await popover.getByRole('button', { name: /^Since last payment/ }).click()
	await popover.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)
}

async function actionsPart(page: Page, main: StudentLessonsResponse) {
	const menuFor = async (key: string) => {
		await page.locator(`${ROW}[data-key="${key}"] [data-slot="lessons-row-menu"]`).click()
		await page.getByRole('menuitem', { name: 'Open lesson' }).waitFor({ timeout: 10000 })
		return (await page.getByRole('menuitem').allInnerTexts()).map((item) => item.trim())
	}
	const ahead = main.lessons.find((lesson) => lesson.outcome === 'planned' && Date.parse(lesson.startsAt) > Date.now())!
	check(
		'menu: a lesson ahead offers Open lesson, Open in calendar, Move lesson, Cancel lesson',
		(await menuFor(ahead.key)).join(',') === 'Open lesson,Open in calendar,Move lesson,Cancel lesson'
	)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(250)
	const doneLesson = main.lessons.find((lesson) => lesson.outcome === 'done')!
	const doneItems = await menuFor(doneLesson.key)
	check('menu: a Done lesson has no Move or Cancel', doneItems.join(',') === 'Open lesson,Open in calendar')
	check(
		'menu: a Done lesson explains why in one line',
		(await text(page.locator('[data-slot="lessons-done-line"]'))) ===
			'Marked Done: this lesson stays where it is. To move or cancel it, set the mark to Scheduled first.'
	)
	await shot(page, 'ledger-profile', 'menu-done')
	await page.keyboard.press('Escape')
	await page.waitForTimeout(250)
	const cancelled = main.lessons.find((lesson) => lesson.outcome === 'cancelled')!
	check(
		'menu: a cancelled lesson offers Return to schedule instead of Move and Cancel',
		(await menuFor(cancelled.key)).join(',') === 'Open lesson,Open in calendar,Return to schedule'
	)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(250)

	await menuFor(ahead.key)
	await page.getByRole('menuitem', { name: 'Open lesson' }).click()
	await page.getByRole('dialog').waitFor({ timeout: 15000 })
	check(
		'dialog: Open lesson opens the lesson window of the Schedule',
		(await page.getByRole('dialog').innerText()).includes(NAMES[0])
	)
	await shot(page, 'ledger-profile', 'dialog')
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)
	check(
		'dialog: focus returns to the row menu button',
		await page.evaluate(
			(key) =>
				document.activeElement ===
				document.querySelector(`[data-slot="lessons-row"][data-key="${key}"] [data-slot="lessons-row-menu"]`),
			ahead.key
		)
	)

	const unmarked = main.lessons.find(
		(lesson) =>
			lesson.actions.mark &&
			lesson.mark === null &&
			Date.parse(lesson.startsAt) < Date.now() &&
			lesson.outcome === 'planned'
	)!
	const unmarkedRow = page.locator(`${ROW}[data-key="${unmarked.key}"]`)
	check(
		'outcome: a started lesson with no mark has Done and No-show buttons',
		(await unmarkedRow.getByRole('button', { name: /^Mark .*, as (done|no-show)$/ }).count()) === 2
	)
	check(
		'outcome: a lesson ahead says Planned and a cancelled one Cancelled',
		(await text(page.locator(`${ROW}[data-key="${ahead.key}"] [data-slot="lessons-outcome-word"]`))) === 'Planned' &&
			(await text(page.locator(`${ROW}[data-key="${cancelled.key}"] [data-slot="lessons-outcome-word"]`))) ===
				'Cancelled'
	)
	await unmarkedRow.getByRole('button', { name: /as done$/ }).click()
	await page.waitForFunction(
		(key) => !document.querySelector(`[data-slot="lessons-row"][data-key="${key}"] button[aria-label$="as done"]`),
		unmarked.key,
		{ timeout: 15000 }
	)
	await page.waitForTimeout(500)
	const after = await readLessons(page, main.studentId, 'range=since_payment')
	const markedRow = after.lessons.find((lesson) => lesson.key === unmarked.key)!
	check('outcome: one click saves Done through the api', markedRow.outcome === 'done' && markedRow.held)
	check(
		'outcome: the marked row shows the Done control and the block gained the date',
		(await text(unmarkedRow.locator('[data-slot="lessons-outcome"]'))).startsWith('Done') &&
			JSON.stringify(await blockLines(page)) ===
				JSON.stringify(monthLines(heldSince(after).map((lesson) => lesson.date)))
	)
	const balance = await text(unmarkedRow.locator('[data-slot="lessons-balance-after"]'))
	check(
		'outcome: Balance after of the marked row follows the api',
		balance === core.balancePhrase(markedRow.balanceAfterMinutes!, after.defaultLessonMinutes, { short: true }),
		balance
	)

	const link = page.locator(`${ROW} [data-slot="lessons-payment-link"]`).first()
	await link.click()
	const paymentsTab = page.locator('[role="tab"]').filter({ hasText: 'Payments' })
	await paymentsTab.waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	check(
		'payment link: the Payment cell opens the Payments tab',
		(await paymentsTab.getAttribute('aria-selected')) === 'true'
	)
	await page.keyboard.press('Escape')
	await page.getByRole('tab', { name: 'Lessons' }).click()
	await page.locator(LOADED).waitFor({ timeout: 15000 })
}

async function statesPart(page: Page, ids: { main: string; bare: string; empty: string }) {
	await openTab(page, ids.bare, NAMES[1])
	check(
		'no payment: the tab opens on This month',
		(await rangeButton(page).getAttribute('aria-label')) === 'Date range: This month'
	)
	const popover = await openRange(page)
	const preset = popover.getByRole('button', { name: /^Since last payment/ })
	check(
		'no payment: Since last payment is off with No payment yet',
		(await preset.isDisabled()) && (await text(preset)).includes('No payment yet')
	)
	await shot(page, 'ledger-profile', 'range-no-payment')
	await page.keyboard.press('Escape')
	await popover.waitFor({ state: 'detached', timeout: 10000 })
	const info = page.locator('[data-slot="lessons-not-counted"]')
	check(
		'no payment: the info row says lessons are not counted yet with Go to Payments',
		(await text(info)).includes('Lessons are not counted yet: this student has no payment and no opening balance.') &&
			(await info.getByRole('button', { name: 'Go to Payments' }).count()) === 1
	)
	const dashes = await page
		.locator(`${ROW} [data-slot="lessons-balance-after"]`)
		.evaluateAll((list) => list.map((node) => node.textContent ?? ''))
	check(
		'no payment: Balance after is a dash for every lesson that is not counted',
		dashes.length === 0,
		dashes.join(',')
	)
	await shot(page, 'ledger-profile', 'no-payment')
	await info.getByRole('button', { name: 'Go to Payments' }).click()
	await page.waitForTimeout(500)
	check(
		'no payment: Go to Payments opens the Payments tab',
		(await page.getByRole('tab', { name: 'Payments' }).getAttribute('aria-selected')) === 'true'
	)

	await openTab(page, ids.empty, NAMES[2])
	check(
		'empty period: the block and the list say so and Copy dates is off',
		(await text(page.locator(BLOCK))).includes('No held lessons in this range.') &&
			(await text(page.locator(TAB))).includes('No lessons in this range') &&
			(await page.getByRole('button', { name: 'Copy dates' }).isDisabled())
	)
	await shot(page, 'ledger-profile', 'empty')

	const url = `**/api/students/${ids.main}/lessons?*`
	const patched = async (coverage: 'partial' | 'unread') => {
		await page.route(url, async (route) => {
			const response = await route.fetch()
			const json = await response.json()
			await route.fulfill({ response, json: { ...json, coverage } })
		})
		await openTab(page, ids.main, NAMES[0])
	}
	await page.unroute(url).catch(() => undefined)
	await patched('partial')
	check(
		'partial: the warning row shows, Copy dates is off and the block says so',
		(await page.locator('[data-slot="lessons-partial"]').count()) === 1 &&
			(await page.getByRole('button', { name: 'Copy dates' }).isDisabled()) &&
			(await text(page.locator(BLOCK))).includes('Not checked in full. Counted from the part that was read.')
	)
	check(
		'partial: the rows are for reading only (no mark buttons)',
		(await page.locator(`${ROW} button[aria-label^="Mark "]`).count()) === 0 && (await page.locator(ROW).count()) > 0
	)
	await shot(page, 'ledger-profile', 'partial')
	await page.unroute(url)
	await patched('unread')
	check(
		'unread: one panel with Refresh records, the controls stay and no list is drawn',
		(await text(page.locator('[data-slot="lessons-unread"]'))).includes(
			'Could not read these records.Refresh before continuing.'
		) &&
			(await page.getByRole('button', { name: 'Refresh records' }).count()) === 1 &&
			(await rangeButton(page).count()) === 1 &&
			(await page.locator(ROW).count()) === 0
	)
	await shot(page, 'ledger-profile', 'unread')
	await page.unroute(url)
	await page.getByRole('button', { name: 'Refresh records' }).click()
	await page.locator(`${TAB}[data-state="ready"]`).waitFor({ timeout: 15000 })
	check('unread: Refresh records reads the range again', (await page.locator(ROW).count()) > 0)
}

async function phonePart(page: Page, id: string) {
	await page.setViewportSize({ width: 375, height: 800 })
	await openTab(page, id, NAMES[0])
	const metrics = await page.evaluate(() => ({
		page: document.documentElement.scrollWidth - window.innerWidth,
		rows: Array.from(document.querySelectorAll<HTMLElement>('[data-slot="lessons-row"]')).map((row) => ({
			columns: getComputedStyle(row).gridTemplateColumns.split(' ').length,
			menu: row.querySelector<HTMLElement>('[data-slot="lessons-row-menu"]')?.getBoundingClientRect().top ?? 0,
			top: row.getBoundingClientRect().top,
			outcome: row.querySelector<HTMLElement>('[data-slot="lessons-outcome"]')?.getBoundingClientRect().top ?? 0,
		})),
	}))
	check('375 px: the page has no sideways scroll', metrics.page <= 0, String(metrics.page))
	check(
		'375 px: a lesson is a card with three columns, the menu on the first line and the outcome under it',
		metrics.rows.length > 0 && metrics.rows.every((row) => row.columns === 3 && row.outcome > row.menu)
	)
	await shot(page, 'ledger-profile', 'phone')
	await page.setViewportSize({ width: 768, height: 900 })
	await page.waitForTimeout(300)
	const tablet = await page.evaluate(() => ({
		page: document.documentElement.scrollWidth - window.innerWidth,
		head: getComputedStyle(document.querySelector('[data-slot="lessons-head"]')!).display,
		duration: Array.from(document.querySelectorAll<HTMLElement>('[data-slot="lessons-head"] span')).some(
			(node) => node.textContent === 'Duration' && getComputedStyle(node).display !== 'none'
		),
	}))
	check(
		'768 px: no sideways scroll, the header is a grid and Duration is not a column',
		tablet.page <= 0 && tablet.head === 'grid' && !tablet.duration,
		JSON.stringify(tablet)
	)
	await shot(page, 'ledger-profile', 'tablet')
	await page.setViewportSize({ width: 1280, height: 900 })
}

export async function profile() {
	cleanup()
	await withBrowser(
		{ width: 1280, height: 900 },
		async ({ page, context, problems }) => {
			await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
			await setTheme(page)
			await signIn(page)
			const ids = await fixtures(page)
			const main = await sincePart(page, ids.main, NAMES[0])
			await rangePart(page, ids.main)
			await openTab(page, ids.main, NAMES[0])
			await actionsPart(page, main)
			await statesPart(page, ids)
			await phonePart(page, ids.main)
			const real = problems.filter(
				(problem) =>
					!problem.includes('net::ERR_FAILED') &&
					!problem.includes('server caches disabled') &&
					!/status of (400|404|409|500|503)/.test(problem) &&
					!problem.includes('encountered URL data during prerendering')
			)
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		},
		() => {
			check('fixture cleanup left no cards', cleanup() === 0)
		}
	)
	if (failures() === 0) console.log('LEDGER_WEB_PROFILE_OK')
}
