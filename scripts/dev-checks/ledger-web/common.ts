import type { Page } from '@playwright/test'

import type {
	StudentResponse,
	ErrorResponse,
	ScheduleLessonResponse,
	ScheduleMarkResponse,
	SettingsResponse,
	TodayResponse,
} from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { BASE, api, check, sql } from '../browser-context.ts'

export { withTeacherSettings } from '../teacher-settings.ts'

const dark = process.argv.includes('dark')

export const VN = core.SCHEDULE_TIME_ZONE

const fixtureWhere = `(display_name like 'Alex Example 215%' or display_name like 'Alex Example 216%' or display_name like 'Alex Example 217%' or display_name like 'Alex Example 218%') and import_key is null`

const cleanupText = (where: string) => `do $$ begin
if to_regclass('lesson_marks') is not null then
delete from lesson_marks where lesson_id in (select id from lessons where student_id in (select id from students where ${where}))
or series_id in (select id from lesson_series where student_id in (select id from students where ${where}));
end if;
if to_regclass('lesson_exceptions') is not null then
delete from lesson_exceptions where series_id in (select id from lesson_series where student_id in (select id from students where ${where}));
end if;
if to_regclass('lessons') is not null then
delete from lessons where student_id in (select id from students where ${where});
end if;
if to_regclass('lesson_series') is not null then
delete from lesson_series where student_id in (select id from students where ${where});
end if;
delete from payments where student_id in (select id from students where ${where});
delete from student_sections where student_id in (select id from students where ${where});
delete from students where ${where};
end $$`

export function cleanupFixtures(label: string) {
	if (ownedCards.size === 0) return 0
	const where = `${fixtureWhere} and id in (${[...ownedCards].map((id) => `'${id}'`).join(',')})`
	const before = sql<{ n: number }>(`select count(*)::int as n from students where ${where}`)
	const found = before.rows?.[0]?.n ?? 0
	sql(cleanupText(where))
	check('fixture cleanup succeeded', true)
	console.log(`${label}: fixture cards removed ${found}`)
	ownedCards.clear()
	return found
}

export function setTheme(page: Page) {
	return page.addInitScript(
		(value) => {
			try {
				localStorage.setItem('theme', value)
			} catch {}
		},
		dark ? 'dark' : 'light'
	)
}

function weeksFrom(from: string, to: string) {
	return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86400000))
}

export async function openSchedule(page: Page) {
	await page.goto(`${BASE}/schedule`)
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
}

export async function goToWeek(page: Page, nav: { monday: string | null }, target: string) {
	const diff = weeksFrom(nav.monday!, target)
	for (let step = 0; step < Math.abs(diff); step += 1) await page.keyboard.press(diff > 0 ? 'j' : 'k')
	nav.monday = target
	await page.waitForFunction(
		(expected) => document.querySelector<HTMLElement>('[data-slot="week-grid-day"]')?.dataset.date === expected,
		target,
		{ timeout: 30000 }
	)
	await page.waitForTimeout(250)
}

const ownedCards = new Set<string>()

export async function createCard(page: Page, name: string, minutes: number = 60, fields = {}) {
	const result = await api<StudentResponse & Partial<ErrorResponse>>(page, 'POST', '/students', {
		displayName: name,
		rateMinor: null,
		currency: null,
		defaultLessonMinutes: minutes,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
		...fields,
	})
	check(`${name} card created`, result.status === 201, String(result.status))
	ownedCards.add(result.json!.student.id)
	return result.json!.student.id
}

export async function setOpening(page: Page, studentId: string, on: string, hundredths = 0) {
	const result = await api<StudentResponse & Partial<ErrorResponse>>(
		page,
		'PUT',
		`/students/${studentId}/opening-balance`,
		{ lessonsHundredths: hundredths, on, expectedDefaultTimeZone: VN }
	)
	check(`opening balance set for ${studentId.slice(0, 4)}`, result.status === 200, String(result.status))
}

export async function createOnce(
	page: Page,
	studentId: string,
	date: string,
	startTime: string,
	durationMinutes: number = 60
) {
	const result = await api<ScheduleLessonResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		expectedDefaultTimeZone: VN,
		studentId,
		date,
		startTime,
		durationMinutes,
		repeats: 'once',
	})
	check(`lesson created ${date} ${startTime}`, result.status === 201, String(result.status))
	return result.json!.lesson.id
}

export async function markApi(page: Page, lessonId: string, kind: 'done' | 'no_show' | 'none') {
	const result = await api<ScheduleMarkResponse & Partial<ErrorResponse>>(
		page,
		'POST',
		`/schedule/lessons/${lessonId}/mark`,
		{ kind }
	)
	check(`api mark ${kind}`, result.status === 200, String(result.status))
}

function blockLocator(page: Page, name: string, date: string) {
	return page.locator(`[data-slot="week-grid-column"][data-date="${date}"] button[data-key][aria-label^="${name}, "]`)
}

export async function blockFacts(page: Page, name: string, date: string) {
	const locator = blockLocator(page, name, date).first()
	await locator.waitFor({ timeout: 15000 })
	return locator.evaluate((element) => {
		const title = element.querySelector<HTMLElement>('span')
		const sign = element.querySelector<HTMLElement>('[data-slot="block-sign"]')
		const signStyle = sign ? getComputedStyle(sign) : null
		return {
			label: element.getAttribute('aria-label') ?? '',
			opacity: getComputedStyle(element).opacity,
			decoration: title ? getComputedStyle(title).textDecorationLine : '',
			outline: getComputedStyle(element).outlineStyle,
			signKind: sign ? (sign.getAttribute('data-sign') ?? 'dot') : null,
			signWidth: signStyle ? signStyle.width : null,
			signAria: sign ? sign.getAttribute('aria-hidden') : null,
			titlePadding: title ? getComputedStyle(title).paddingRight : null,
			titleRight: title ? title.getBoundingClientRect().right : null,
			signLeft: sign ? sign.getBoundingClientRect().left : null,
		}
	})
}

export async function tooltipText(page: Page, name: string, date: string) {
	await page.mouse.move(2, 2)
	await page.waitForTimeout(500)
	await blockLocator(page, name, date).first().hover()
	await page
		.locator('[data-slot="event-tooltip"]')
		.waitFor({ timeout: 8000 })
		.catch(() => {})
	await page.waitForTimeout(300)
	const text = await page
		.locator('[data-slot="event-tooltip"]')
		.first()
		.textContent()
		.catch(() => null)
	return text
}

export const HELP_UNMARKED = 'Not marked yet. Nothing is deducted until you mark it.'

export const HELP_DEDUCTS = 'Deducts 1 lesson (60 min).'

export const HELP_NO_SHOW_OFF = 'Deducts nothing: No-show deducts a lesson is off for this student.'

export const HELP_NOT_STARTED = 'You can mark a lesson once it has started.'

export const HELP_CANCELLED =
	'Cancelled lessons deduct nothing. The mark is kept and counts again if you return the lesson to the schedule.'

export async function openBlockDialog(page: Page, name: string, date: string) {
	await blockLocator(page, name, date).first().click()
	await page.getByRole('dialog').waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
}

export async function closeDialog(page: Page) {
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
}

export async function dialogMark(page: Page) {
	return page.getByRole('dialog').evaluate((dialog) => {
		const row = dialog.querySelector<HTMLElement>('[data-slot="lesson-mark-row"]')
		if (!row) return null
		const group = row.querySelector<HTMLElement>('[role="radiogroup"]')
		const radios = Array.from(row.querySelectorAll<HTMLElement>('[role="radio"]'))
		return {
			groupName: group?.getAttribute('aria-labelledby')
				? document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent
				: null,
			labels: radios.map((radio) => radio.textContent?.trim()),
			checked: radios.find((radio) => radio.getAttribute('aria-checked') === 'true')?.textContent?.trim() ?? null,
			disabled: radios.map((radio) => radio.hasAttribute('data-disabled')),
			height: radios[0]?.getBoundingClientRect().height ?? 0,
			opacity: group ? getComputedStyle(group).opacity : null,
			help: row.querySelector<HTMLElement>('[data-slot="lesson-mark-help"]')?.textContent ?? '',
			failed: dialog.querySelector<HTMLElement>('[data-slot="lesson-mark-failed"]')?.textContent ?? null,
			stale: dialog.querySelector<HTMLElement>('[data-slot="lesson-stale"]')?.textContent ?? null,
			status:
				dialog.querySelector<HTMLElement>('[data-slot="lesson-mark-row"]')?.previousElementSibling?.textContent ?? '',
			text: dialog.textContent ?? '',
			buttons: Array.from(dialog.querySelectorAll<HTMLButtonElement>('button')).map((button) =>
				button.textContent?.trim()
			),
		}
	})
}

export async function waitHelp(page: Page, text: string) {
	return page
		.waitForFunction(
			(expected) => document.querySelector<HTMLElement>('[data-slot="lesson-mark-help"]')?.textContent === expected,
			text,
			{ timeout: 15000 }
		)
		.then(() => true)
		.catch(() => false)
}

export function markRow(id: string) {
	return (
		sql<{ kind: 'done' | 'no_show' | 'none' }>(`select kind from lesson_marks where lesson_id = '${id}'`).rows ?? []
	)
}

export async function pill(page: Page, label: string) {
	return page.getByRole('dialog').getByRole('radio', { name: label, exact: true })
}

export async function setThreshold(page: Page, value: number) {
	const result = await api<SettingsResponse & Partial<ErrorResponse>>(page, 'PATCH', '/settings', {
		paysSoonLessons: value,
	})
	check(`api threshold set to ${value}`, result.status === 200, String(result.status))
}

export async function openStudentsList(page: Page) {
	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('tab', { name: 'Active', exact: true }).waitFor({ timeout: 15000 })
	await page.locator('tbody tr').first().waitFor({ timeout: 15000 })
}

export async function openProfile(page: Page, id: string) {
	await page.goto(`${BASE}/students/${id}`)
	await page.waitForFunction(() => document.querySelectorAll('#student-opening-balance').length === 1, undefined, {
		timeout: 30000,
	})
	await page.waitForTimeout(300)
}

export const hhmm = (minutes: number) =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export async function openToday(page: Page) {
	await page.goto(`${BASE}/`)
	await page.locator('[data-slot="stat"]').first().waitFor({ timeout: 30000 })
	await page.waitForTimeout(400)
}

export function expectedTitle(date: string) {
	const at = new Date(`${date}T12:00:00Z`)
	const part = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(at)
	return `${part({ weekday: 'long' })}, ${Number(date.slice(8, 10))} ${part({ month: 'long' })}`
}

export function minuteNow() {
	return new Date(Math.floor(Date.now() / 60000) * 60000)
}

export async function readTodayApi(page: Page) {
	const result = await api<TodayResponse & Partial<ErrorResponse>>(page, 'GET', '/today')
	return result.json
}

export function countsOf(data: TodayResponse, now: Date) {
	return core.todayCounts(
		{
			lessons: data.lessons.map((block) => ({
				key: block.key,
				startsAt: new Date(block.startsAt),
				outcome: block.outcome,
				studentStatus: block.studentStatus,
				openingOn: block.ledger.openingOn,
			})),
			earlier: data.earlier.length,
			paysSoon: data.paysSoon.length,
		},
		now,
		VN
	)
}

export function plural(count: number) {
	return count === 1 ? '1 lesson' : `${count} lessons`
}

export function expectedTiles(counts: ReturnType<typeof core.todayCounts>, threshold: number) {
	const quiet = counts.lessons === 0
	return {
		Today: {
			value: String(counts.lessons),
			hint: quiet ? null : counts.toCome === 0 ? 'All started' : `${counts.toCome} still to come`,
		},
		Done: { value: String(counts.done), hint: quiet ? null : `of ${counts.started} started` },
		'To mark': {
			value: String(counts.toMark),
			hint: counts.toMark === 0 ? null : `${counts.toMarkToday} today, ${counts.toMarkEarlier} earlier`,
		},
		'Pays soon': { value: String(counts.paysSoon), hint: `${plural(threshold)} or fewer left` },
	}
}

export function tileFacts(page: Page) {
	return page.evaluate(() =>
		Array.from(document.querySelectorAll<HTMLElement>('[data-slot="stat"]')).map((tile) => {
			const box = tile.getBoundingClientRect()
			return {
				label: tile.querySelector<HTMLElement>('[data-slot="stat-label"]')?.textContent ?? '',
				value: tile.querySelector<HTMLElement>('[data-slot="stat-value"]')?.textContent ?? '',
				hint: tile.querySelector<HTMLElement>('[data-slot="stat-hint"]')?.textContent ?? null,
				top: Math.round(box.top),
				left: Math.round(box.left),
				width: Math.round(box.width),
			}
		})
	)
}

export async function titleOf(page: Page) {
	return page.getByRole('heading', { level: 1 }).first().textContent()
}

export function shortDay(date: string, withWeekday: boolean, currentYear: number) {
	const at = new Date(`${date}T12:00:00Z`)
	const part = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(at)
	const year = Number(date.slice(0, 4)) === currentYear ? '' : ` ${date.slice(0, 4)}`
	const day = `${Number(date.slice(8, 10))} ${part({ month: 'short' })}${year}`
	return withWeekday ? `${part({ weekday: 'short' })} ${day}` : day
}

export function rowLocator(page: Page, panel: string, studentId: string) {
	return page
		.locator(`section[aria-labelledby="${panel}"] [data-slot="today-row"][data-student-id="${studentId}"]`)
		.first()
}

export async function rowFacts(page: Page, panel: string, studentId: string) {
	const row = rowLocator(page, panel, studentId)
	if ((await row.count()) === 0) return null
	return row.evaluate((element) => {
		const name = element.querySelector<HTMLElement>('[data-slot="today-row-name"]')
		const note = element.querySelector<HTMLElement>('[data-slot="today-row-note"]')
		const date = element.querySelector<HTMLElement>('[data-slot="today-row-date"]')
		const time = element.querySelector<HTMLElement>('[data-slot="time-pair"]')
		return {
			status: element.dataset.status,
			next: element.dataset.next,
			height: element.getBoundingClientRect().height,
			weight: getComputedStyle(name!).fontWeight,
			background: getComputedStyle(element).backgroundColor,
			muted: element.classList.contains('text-muted-foreground'),
			struck: getComputedStyle(name!).textDecorationLine.includes('line-through'),
			note: note?.textContent ?? null,
			date: date?.textContent ?? null,
			dateWidth: date ? date.getBoundingClientRect().width : null,
			time: time!.querySelector<HTMLElement>('[data-slot="time-main"]')!.textContent,
			second: time!.querySelector<HTMLElement>('[data-slot="time-second"]')?.textContent ?? null,
			timeWidth: time!.getBoundingClientRect().width,
			tabular: getComputedStyle(element).fontVariantNumeric.includes('tabular-nums'),
		}
	})
}

export function panelKeys(page: Page, panel: string) {
	return page.evaluate(
		(id) =>
			Array.from(
				document.querySelectorAll<HTMLElement>(`section[aria-labelledby="${id}"] [data-slot="today-row"]`)
			).map((element) => element.dataset.key),
		panel
	)
}
