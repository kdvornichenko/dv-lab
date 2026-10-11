import type { Page, Locator } from '@playwright/test'

import type { StudentResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, failures, shot, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import {
	VN,
	cleanupFixtures,
	setTheme,
	createCard,
	setOpening,
	createOnce,
	markApi,
	setThreshold,
	withTeacherSettings,
	openStudentsList,
	openProfile,
} from './common.mjs'

export function balanceFacts(page: Page, name: string) {
	return page
		.locator('tbody tr', { hasText: name })
		.first()
		.evaluate((row) => {
			const heads = Array.from(row.closest<HTMLElement>('table')!.querySelectorAll<HTMLElement>('thead th'))
			const head = heads[3]
			const cell = row.querySelectorAll<HTMLElement>('td')[3]
			const line = cell.firstElementChild
			const text = line!.lastElementChild
			const dot = cell.querySelector<HTMLElement>('[role="img"]')
			const mark = dot?.querySelector<HTMLElement>('i')
			const link = row.querySelector<HTMLElement>('a')
			return {
				heading: head.textContent?.trim() ?? '',
				headingAlign: getComputedStyle(head).textAlign,
				headLeft: head.getBoundingClientRect().left + parseFloat(getComputedStyle(head).paddingLeft),
				text: text!.textContent ?? '',
				textClass: text!.className,
				textColor: getComputedStyle(text!).color,
				nameColor: link ? getComputedStyle(link).color : '',
				dotLabel: dot?.getAttribute('aria-label') ?? null,
				dotTone: mark ? Array.from(mark.classList).find((item) => item.startsWith('bg-')) : null,
				dotSlot: dot ? dot.getBoundingClientRect().width : null,
				dotLeft: mark ? mark.getBoundingClientRect().left : null,
				textLeft: text!.getBoundingClientRect().left,
				cellText: cell.textContent?.trim() ?? '',
			}
		})
}

const BALANCE_FIXTURES = [
	{ name: 'Alex Example 2160 A', text: '10 lessons left', label: 'Plenty left', tone: 'bg-success' },
	{ name: 'Alex Example 2160 B', text: '1 lesson left', label: 'Pays soon', tone: 'bg-info' },
	{ name: 'Alex Example 2160 C', text: '0 lessons left', label: 'No lessons left', tone: 'bg-warning' },
	{ name: 'Alex Example 2160 E', text: 'owes 1.5 lessons', label: 'Owes lessons', tone: 'bg-destructive' },
	{ name: 'Alex Example 2160 D', text: 'Not set', label: null, tone: null },
]

async function studentsFixtures(page: Page) {
	const today = core.zonedParts(new Date(), VN).date
	const yesterday = core.addDays(today, -1)
	const opening = core.addDays(today, -3)
	const ids: Record<string, string> = {}
	for (const item of BALANCE_FIXTURES) ids[item.name] = await createCard(page, item.name)
	await setOpening(page, ids['Alex Example 2160 A'], opening, 1000)
	await setOpening(page, ids['Alex Example 2160 B'], opening, 100)
	await setOpening(page, ids['Alex Example 2160 C'], opening, 0)
	await setOpening(page, ids['Alex Example 2160 E'], opening, 0)
	const debt = await createOnce(page, ids['Alex Example 2160 E'], yesterday, '09:00', 90)
	await markApi(page, debt, 'done')
	const flagged = await createCard(page, 'Alex Example 2161 A')
	await setOpening(page, flagged, opening, 0)
	const absence = await createOnce(page, flagged, yesterday, '08:00')
	await markApi(page, absence, 'no_show')
	ids['Alex Example 2161 A'] = flagged
	return { today, yesterday, opening, ids }
}

async function studentsPart1(page: Page) {
	await openStudentsList(page)
	let leftOfText: number | null = null
	for (const item of BALANCE_FIXTURES) {
		const facts = await balanceFacts(page, item.name)
		check(`${item.name}: cell says ${item.text}`, facts.text === item.text, facts.text)
		check(`${item.name}: dot label is ${item.label ?? 'absent'}`, facts.dotLabel === item.label, String(facts.dotLabel))
		check(`${item.name}: dot tone is ${item.tone ?? 'absent'}`, facts.dotTone === item.tone, String(facts.dotTone))
		check(`${item.name}: no minus sign in the cell`, !/[-\u2212]/.test(facts.cellText), facts.cellText)
		if (item.label === null) {
			check(`${item.name}: Not set is muted`, facts.textClass.includes('text-muted-foreground'), facts.textClass)
		} else {
			check(
				`${item.name}: the text is not coloured by the state`,
				!facts.textClass.includes('destructive') && facts.textColor === facts.nameColor,
				`${facts.textColor} / ${facts.nameColor}`
			)
			check(`${item.name}: the dot has a 24px hit area`, facts.dotSlot === 24, String(facts.dotSlot))
			check(
				`${item.name}: the dot starts where the heading text starts`,
				Math.abs(facts.dotLeft! - facts.headLeft) < 0.6,
				`${facts.dotLeft} / ${facts.headLeft}`
			)
		}
		check(`${item.name}: the text follows the dot slot by 16px`, Math.abs(facts.textLeft - facts.headLeft - 16) < 0.6)
		leftOfText ??= facts.textLeft
		check(`${item.name}: text column is aligned`, Math.abs(facts.textLeft - leftOfText) < 0.6)
		check(
			`${item.name}: heading is Balance and left aligned`,
			facts.heading === 'Balance' && /left|start/.test(facts.headingAlign)
		)
	}
	await shot(page, 'ledger-students', 'balance-column')
	const dot = page
		.locator('tbody tr', { hasText: 'Alex Example 2160 E' })
		.first()
		.locator('[role="img"][aria-label="Owes lessons"]')
	await dot.hover()
	await page.waitForTimeout(400)
	const tip = await page
		.getByText('Owes lessons', { exact: true })
		.first()
		.isVisible()
		.catch(() => false)
	check('the dot tooltip names the state', tip)
	await page.mouse.move(2, 2)
	console.log(failures() === 0 ? 'STUDENTS_WEB_PART1_OK' : 'STUDENTS_WEB_PART1_FAIL')
}

function profileFacts(page: Page) {
	return page.evaluate(() => {
		const panel = document.querySelector<HTMLElement>('#student-opening-balance')!.closest<HTMLElement>('section')
		const row = Array.from(panel!.querySelectorAll<HTMLElement>('div')).find(
			(item) => item.firstElementChild?.textContent === 'Balance now'
		)
		const value = row?.lastElementChild
		const dots = Array.from(document.querySelectorAll<HTMLElement>('main [role="img"]')).filter(
			(item) => !panel!.contains(item)
		)
		const summaryDot = dots.find(
			(item) => !['Active', 'Archived', 'Deactivated'].includes(item.getAttribute('aria-label')!)
		)
		const summary = summaryDot?.parentElement
		const noShow = Array.from(document.querySelectorAll<HTMLElement>('dt')).find(
			(item) => item.textContent === 'No-show'
		)
		const noShowValue = noShow?.nextElementSibling
		const parts = noShowValue?.firstElementChild
		return {
			summaryText: summary?.lastElementChild?.textContent ?? null,
			summaryLabel: summaryDot?.getAttribute('aria-label') ?? null,
			summaryColor: summary?.lastElementChild ? getComputedStyle(summary.lastElementChild).color : null,
			nowText: value?.textContent ?? null,
			nowDots: panel!.querySelectorAll<HTMLElement>('[role="img"]').length,
			noShowText: noShowValue?.textContent ?? null,
			noShowMuted: parts ? parts.className.includes('text-muted-foreground') : false,
			noShowLabelWidth: noShow ? noShow.getBoundingClientRect().width : null,
			noShowOrder: Array.from(document.querySelectorAll<HTMLElement>('dt')).map((item) => item.textContent),
			setButton: Array.from(document.querySelectorAll<HTMLButtonElement>('button')).some(
				(item) => item.textContent?.trim() === 'Set opening balance'
			),
		}
	})
}

async function openEdit(page: Page) {
	await page.getByRole('button', { name: 'Edit details' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	return dialog
}

function noShowSwitch(dialog: Locator) {
	return dialog.getByRole('switch', { name: 'No-show deducts a lesson' })
}

async function saveEdit(page: Page, dialog: Locator) {
	const [request] = await Promise.all([
		page.waitForRequest((item) => item.method() === 'PATCH' && /\/api\/students\/[^/]+$/.test(item.url())),
		dialog.getByRole('button', { name: 'Save changes' }).click(),
	])
	await dialog.waitFor({ state: 'detached', timeout: 15000 })
	await page.waitForTimeout(600)
	return request.postData() ?? ''
}

async function studentsPart2(page: Page, fx: Awaited<ReturnType<typeof studentsFixtures>>) {
	const debtId = fx.ids['Alex Example 2160 E']
	await openProfile(page, debtId)
	let facts = await profileFacts(page)
	check(
		'profile E: the summary says owes 1.5 lessons',
		facts.summaryText === 'owes 1.5 lessons',
		String(facts.summaryText)
	)
	check(
		'profile E: the summary dot says Owes lessons',
		facts.summaryLabel === 'Owes lessons',
		String(facts.summaryLabel)
	)
	check(
		'profile E: Balance now says owes 1.5 lessons without a dot',
		facts.nowText === 'owes 1.5 lessons' && facts.nowDots === 0,
		`${facts.nowText} ${facts.nowDots}`
	)
	check('profile E: no Set opening balance button for a set balance', facts.setButton === false)
	check(
		'profile E: Details has No-show between Lesson length and Parent',
		JSON.stringify(facts.noShowOrder.slice(0, 4)) === JSON.stringify(['Rate', 'Lesson length', 'No-show', 'Parent']),
		facts.noShowOrder.join('|')
	)
	check(
		'profile E: Details says Deducts a lesson in foreground',
		facts.noShowText === 'Deducts a lesson' && facts.noShowMuted === false,
		String(facts.noShowText)
	)
	check('profile E: the No-show label is 128px', facts.noShowLabelWidth === 128, String(facts.noShowLabelWidth))
	await shot(page, 'ledger-students', 'profile-debt')

	await openProfile(page, fx.ids['Alex Example 2160 D'])
	facts = await profileFacts(page)
	check(
		'profile D: Balance now says Not set and the button stays',
		facts.nowText === 'Not set' && facts.setButton === true && facts.summaryText === null,
		`${facts.nowText} ${facts.setButton}`
	)

	const flagged = fx.ids['Alex Example 2161 A']
	await openProfile(page, flagged)
	facts = await profileFacts(page)
	check(
		'profile F: owes 1 lesson while the no-show deducts',
		facts.summaryText === 'owes 1 lesson' && facts.summaryLabel === 'Owes lessons',
		String(facts.summaryText)
	)
	let dialog = await openEdit(page)
	const toggle = noShowSwitch(dialog)
	check('form: the switch is on', (await toggle.getAttribute('aria-checked')) === 'true')
	const geometry = await dialog.evaluate((element) => {
		const lesson = element.querySelector<HTMLElement>('#student-form-lesson')!.getBoundingClientRect()
		const control = element.querySelector<HTMLElement>('[role="switch"]')!.getBoundingClientRect()
		const helper = element.querySelector<HTMLElement>('#student-form-no-show-helper')
		const row = control.top
		return {
			lessonBottom: lesson.bottom,
			switchTop: row,
			helperTop: helper!.getBoundingClientRect().top,
			helperText: helper!.textContent,
			switchRight: control.right,
			dialogRight: element.getBoundingClientRect().right,
		}
	})
	check(
		'form: the switch row sits under Lesson length',
		geometry.switchTop > geometry.lessonBottom - 1,
		`${geometry.lessonBottom} / ${geometry.switchTop}`
	)
	check(
		'form: the helper is under the label',
		geometry.helperTop > geometry.switchTop,
		`${geometry.switchTop} / ${geometry.helperTop}`
	)
	check(
		'form: the helper text is the spec text',
		geometry.helperText ===
			"A no-show takes the lesson's length from the balance. Turn this off to deduct nothing for any no-show of this student, past ones too; the balance is recalculated.",
		String(geometry.helperText)
	)
	check(
		'form: the switch is at the right edge',
		geometry.dialogRight - geometry.switchRight < 60,
		`${geometry.dialogRight - geometry.switchRight}`
	)
	await shot(page, 'ledger-students', 'form-on')
	await dialog.getByText('No-show deducts a lesson', { exact: true }).click()
	check('form: a click on the label turns the switch off', (await toggle.getAttribute('aria-checked')) === 'false')
	check('form: the dialog stays open after the toggle', await dialog.isVisible())
	const before = await api<StudentResponse & Partial<ErrorResponse>>(page, 'GET', `/students/${flagged}`)
	check(
		'form: nothing is saved by the switch itself',
		before.json?.student?.noShowDeducts === true,
		String(before.json?.student?.noShowDeducts)
	)
	await shot(page, 'ledger-students', 'form-off')
	let body = await saveEdit(page, dialog)
	check('form: Save changes sends noShowDeducts false', body.includes('"noShowDeducts":false'), body.slice(0, 200))
	facts = await profileFacts(page)
	check(
		'profile F: Details says Deducts nothing in muted',
		facts.noShowText === 'Deducts nothing' && facts.noShowMuted === true,
		String(facts.noShowText)
	)
	check(
		'profile F: the balance is recalculated to 0 lessons left',
		facts.summaryText === '0 lessons left' &&
			facts.summaryLabel === 'No lessons left' &&
			facts.nowText === '0 lessons left',
		`${facts.summaryText} ${facts.nowText}`
	)
	await shot(page, 'ledger-students', 'profile-flag-off')
	await openStudentsList(page)
	let table = await balanceFacts(page, 'Alex Example 2161 A')
	check(
		'table F: the balance grew to 0 lessons left',
		table.text === '0 lessons left' && table.dotLabel === 'No lessons left',
		table.text
	)

	await openProfile(page, flagged)
	dialog = await openEdit(page)
	const again = noShowSwitch(dialog)
	check(
		'form: the switch is off for a student with the flag off',
		(await again.getAttribute('aria-checked')) === 'false'
	)
	await again.focus()
	await page.keyboard.press('Space')
	check('form: Space turns the switch on', (await again.getAttribute('aria-checked')) === 'true')
	body = await saveEdit(page, dialog)
	check('form: Save changes sends noShowDeducts true', body.includes('"noShowDeducts":true'), body.slice(0, 200))
	facts = await profileFacts(page)
	check(
		'profile F: Deducts a lesson and owes 1 lesson again',
		facts.noShowText === 'Deducts a lesson' && facts.summaryText === 'owes 1 lesson',
		`${facts.noShowText} ${facts.summaryText}`
	)

	await openStudentsList(page)
	await page.getByRole('button', { name: 'New student' }).click()
	dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	check(
		'new student: the switch is on by default',
		(await noShowSwitch(dialog).getAttribute('aria-checked')) === 'true'
	)
	await shot(page, 'ledger-students', 'form-new')
	await dialog.getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	console.log(failures() === 0 ? 'STUDENTS_WEB_PART2_OK' : 'STUDENTS_WEB_PART2_FAIL')
}

export async function students() {
	cleanupFixtures('students start')
	await withTeacherSettings(async () => {
		await withBrowser(
			{ width: 1440, height: 900 },
			async ({ page, problems }) => {
				await setTheme(page)
				await signIn(page)
				await setThreshold(page, 2)
				const fx = await studentsFixtures(page)
				await studentsPart1(page)
				await studentsPart2(page, fx)
				const real = problems.filter(
					(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409|500)/.test(problem)
				)
				check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
			},
			() => cleanupFixtures('students end')
		)
	})
	if (failures() === 0) console.log('LEDGER_WEB_STUDENTS_OK')
}
