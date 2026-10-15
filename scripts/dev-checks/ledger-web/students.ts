import type { Page } from '@playwright/test'

import * as core from '../../../packages/core/src/index.ts'
import { check, failures, shot, signIn, sql } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import {
	VN,
	cleanupFixtures,
	setTheme,
	createCard,
	setOpening,
	setThreshold,
	withTeacherSettings,
	openStudentsList,
} from './common.mjs'

export function balanceFacts(page: Page, name: string) {
	return page
		.locator('tbody tr', { hasText: name })
		.first()
		.evaluate((row) => {
			const heads = Array.from(row.closest<HTMLElement>('table')!.querySelectorAll<HTMLElement>('thead th'))
			const head = heads[2]
			const headText = head.querySelector<HTMLElement>('span')!
			const cell = row.querySelectorAll<HTMLElement>('td')[2]
			const line = cell.firstElementChild
			const text = line!.lastElementChild
			const dot = cell.querySelector<HTMLElement>('[role="img"]')
			const mark = dot?.querySelector<HTMLElement>('i:not([data-attention])')
			const ring = dot?.querySelector<HTMLElement>('i[data-attention]')
			const link = row.querySelector<HTMLElement>('a')
			return {
				heading: headText.textContent?.trim() ?? '',
				headingAlign: getComputedStyle(head.querySelector('button')!).textAlign,
				headLeft: headText.getBoundingClientRect().left,
				ringKind: ring?.dataset.attention ?? null,
				ringMode: ring?.dataset.attentionMode ?? null,
				dotClass: mark?.className ?? '',
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
	{ name: 'Alex Example 2160 A', text: '10 left', label: null, tone: null, ring: null, muted: false },
	{
		name: 'Alex Example 2160 B',
		text: '1 left',
		label: 'Pays soon',
		tone: 'bg-warning',
		ring: 'pays_soon',
		muted: false,
	},
	{
		name: 'Alex Example 2160 C',
		text: '0 left',
		label: 'No lessons left',
		tone: 'color-mix',
		ring: 'none_left',
		muted: false,
	},
	{
		name: 'Alex Example 2160 E',
		text: 'owes 1.5',
		label: 'Owes lessons',
		tone: 'bg-destructive',
		ring: 'owes',
		muted: false,
	},
	{ name: 'Alex Example 2160 D', text: 'Not set', label: 'Balance not set', tone: 'inset', ring: null, muted: true },
]

function insertMarkedLesson(studentId: string, date: string, time: string, minutes: number, mark: 'done' | 'no_show') {
	const result = sql<{ id: string }>(
		`with made as (insert into lessons (student_id, starts_at, time_zone, duration_minutes) values ('${studentId}', '${date}T${time}:00+07:00', '${VN}', ${minutes}) returning id)
insert into lesson_marks (lesson_id, kind) select id, '${mark}' from made returning lesson_id as id`
	)
	return result.rows[0].id
}

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
	insertMarkedLesson(ids['Alex Example 2160 E'], yesterday, '09:00', 90, 'done')
}

async function studentsPart1(page: Page) {
	await openStudentsList(page)
	let leftOfText: number | null = null
	for (const item of BALANCE_FIXTURES) {
		const facts = await balanceFacts(page, item.name)
		check(`${item.name}: cell says ${item.text}`, facts.text === item.text, facts.text)
		check(`${item.name}: dot label is ${item.label ?? 'absent'}`, facts.dotLabel === item.label, String(facts.dotLabel))
		check(
			`${item.name}: dot shape is ${item.tone ?? 'absent'}`,
			item.tone === null
				? facts.dotClass === ''
				: facts.dotClass.includes(item.tone) && !facts.dotClass.includes('bg-info'),
			facts.dotClass
		)
		check(
			`${item.name}: ring is ${item.ring ?? 'absent'} and loops`,
			facts.ringKind === item.ring && (item.ring === null || facts.ringMode === 'loop'),
			`${facts.ringKind} ${facts.ringMode}`
		)
		check(`${item.name}: no minus sign in the cell`, !/[-\u2212]/.test(facts.cellText), facts.cellText)
		if (item.muted) {
			check(`${item.name}: Not set is muted`, facts.textClass.includes('text-muted-foreground'), facts.textClass)
		}
		if (!item.muted) {
			check(
				`${item.name}: the text is not coloured by the state`,
				!facts.textClass.includes('destructive') && facts.textColor === facts.nameColor,
				`${facts.textColor} / ${facts.nameColor}`
			)
		}
		if (item.label !== null) {
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
			`${item.name}: heading is Balance in lessons and left aligned`,
			facts.heading === 'Balance in lessons' && /left|start/.test(facts.headingAlign)
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
	await page
		.locator('tbody tr', { hasText: 'Alex Example 2160 B' })
		.first()
		.locator('[role="img"][aria-label="Pays soon"]')
		.hover()
	await page.waitForTimeout(400)
	const rule = await page
		.getByText('Pays soon: 2 lessons or fewer', { exact: true })
		.first()
		.isVisible()
		.catch(() => false)
	check('the Pays soon tooltip names the rule', rule)
	await page.mouse.move(2, 2)
	console.log(failures() === 0 ? 'STUDENTS_WEB_PART1_OK' : 'STUDENTS_WEB_PART1_FAIL')
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
				await studentsFixtures(page)
				await studentsPart1(page)
				const real = problems.filter(
					(problem) =>
						!problem.includes('net::ERR_FAILED') &&
						!/status of (400|404|409|500|503)/.test(problem) &&
						!problem.includes('encountered URL data during prerendering')
				)
				check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
			},
			() => cleanupFixtures('students end')
		)
	})
	if (failures() === 0) console.log('LEDGER_WEB_STUDENTS_OK')
}
