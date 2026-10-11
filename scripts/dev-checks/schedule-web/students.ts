import type { Page, Locator } from '@playwright/test'

import type {
	ScheduleSeriesResponse,
	ErrorResponse,
	StudentResponse,
	StudentsResponse,
} from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { BASE, api, check, shot, failures, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import { cleanupFixtures } from './fixtures.ts'
import { whenText, expectedWhen, shortDay, expectedSecond } from './format.ts'
import { VN, setTheme } from './navigation.ts'
import { createCard } from './read-fixtures.ts'
import { studentsPart3 } from './students-forms.ts'
import { studentsPart2 } from './students-list.ts'

export const STUDENTS_LIKE = 'Alex Example 2009%'

export const ST_A = 'Alex Example 2009 A'

export const ST_B = 'Alex Example 2009 B'

export const ST_C = 'Alex Example 2009 C'

export async function studentsFixtures(page: Page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const a = await createCard(page, ST_A, 60, null)
	const b = await createCard(page, ST_B, 60, null)
	const c = await createCard(page, ST_C, 60, null)
	const series = await api<ScheduleSeriesResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		studentId: a,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	check('series A created', series.status === 201, String(series.status))
	const archived = await api<StudentResponse & Partial<ErrorResponse>>(page, 'POST', `/students/${c}/archive`)
	check('card C archived', archived.status === 200, String(archived.status))
	return { today, wednesday, a, b, c }
}

export const studentRow = (page: Page, name: string) => page.locator('tbody tr', { hasText: name })

export async function openStudentsList(page: Page) {
	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('tab', { name: 'Active', exact: true }).waitFor({ timeout: 15000 })
	await studentRow(page, ST_A).first().waitFor({ timeout: 15000 })
}

export async function setSecondZone(page: Page, zone: string | null) {
	await page.evaluate((value) => {
		if (value === null) localStorage.removeItem('dv-lab.schedule.second-zone')
		else localStorage.setItem('dv-lab.schedule.second-zone', value)
	}, zone)
}

export async function secondLineOf(cell: Locator) {
	const spans = cell.locator('span')
	if ((await spans.count()) < 2) return null
	return (await spans.nth(1).textContent())?.trim() ?? null
}

export const searchField = (page: Page) => page.getByRole('searchbox', { name: 'Search students' })

export const headerCounts = (page: Page) => page.getByText(/^\d+ active, \d+ archived$/).first()

export async function fixtureRows(page: Page) {
	return page.locator('tbody tr', { hasText: 'Alex Example 2009' }).count()
}

export async function studentsNarrowFinish(page: Page) {
	await page.setViewportSize({ width: 360, height: 800 })
	await openStudentsList(page)
	await page.waitForTimeout(500)
	const facts = await readNarrowFacts(page)
	check('narrow: facts read', facts !== null)
	checkNarrowTabs(facts)
	check('narrow: table container has scroll-fade-x', facts?.containerFade === true)
	check('narrow: table container fade is 24px', facts?.containerSize === '24px', facts?.containerSize)
	check('narrow: search field fills the row', facts !== null && facts.inputWidth >= 300, String(facts?.inputWidth))
	check('narrow: the page itself does not scroll sideways', facts?.pageOverflow === false)
	console.log(`INFO narrow tab strip ${facts?.listScroll}/${facts?.listClient}`)
}

export async function studentsNarrowNarrow(page: Page) {
	await shot(page, 'sched-students', 'narrow')
}

export async function studentsNarrowFinishAgain(page: Page) {
	await page.setViewportSize({ width: 1440, height: 900 })
}

export async function studentsNarrow(page: Page) {
	await studentsNarrowFinish(page)
	await studentsNarrowNarrow(page)
	await studentsNarrowFinishAgain(page)
}

async function readNarrowFacts(page: Page) {
	return await page.evaluate(() => {
		const list = document.querySelector<HTMLElement>('[role="tablist"]')
		const container = document.querySelector<HTMLElement>('[data-slot="table-container"]')
		const input = document.querySelector<HTMLInputElement>('input[type="search"]')
		if (!list || !container || !input) return null
		const listStyle = getComputedStyle(list)
		const containerStyle = getComputedStyle(container)
		const wrapper = list.parentElement
		return {
			listFade: list.classList.contains('scroll-fade-x'),
			listSize: listStyle.getPropertyValue('--scroll-fade-size').trim(),
			listMask: listStyle.maskImage || listStyle.webkitMaskImage,
			listOverflow: listStyle.overflowX,
			listScroll: list.scrollWidth,
			listClient: list.clientWidth,
			listBackground: listStyle.backgroundColor,
			wrapperBackground: wrapper ? getComputedStyle(wrapper).backgroundColor : '',
			containerFade: container.classList.contains('scroll-fade-x'),
			containerSize: containerStyle.getPropertyValue('--scroll-fade-size').trim(),
			inputWidth: Math.round(input.getBoundingClientRect().width),
			pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
		}
	})
}

function checkNarrowTabs(facts: Awaited<ReturnType<typeof readNarrowFacts>>) {
	check('narrow: tab strip has scroll-fade-x', facts?.listFade === true)
	check('narrow: tab strip fade is 24px', facts?.listSize === '24px', facts?.listSize)
	check(
		'narrow: tab strip mask-image is set',
		Boolean(facts?.listMask) && facts!.listMask !== 'none',
		facts?.listMask?.slice(0, 40)
	)
	check('narrow: tab strip scrolls sideways', facts?.listOverflow === 'auto', facts?.listOverflow)
	check(
		'narrow: background is on the wrapper, not on the masked strip',
		facts?.listBackground === 'rgba(0, 0, 0, 0)' && facts?.wrapperBackground !== 'rgba(0, 0, 0, 0)',
		`${facts?.listBackground} / ${facts?.wrapperBackground}`
	)
}

export async function studentsPart1(page: Page, fx: Awaited<ReturnType<typeof studentsFixtures>>) {
	const list = await api<StudentsResponse & Partial<ErrorResponse>>(page, 'GET', '/students')
	const rowA = list.json!.students.find((student) => student.id === fx.a)
	const rowB = list.json!.students.find((student) => student.id === fx.b)
	check(
		'api: nextLessonAt of A is the first Wednesday 18:00 Vietnam',
		rowA?.nextLessonAt === whenText(fx.wednesday, '18:00')
	)
	check('api: nextLessonAt of B is null', rowB?.nextLessonAt === null)
	await openStudentsList(page)
	const heads = await page.locator('thead th').allTextContents()
	check(
		'columns are Student, Status, Rate, Balance, Next lesson',
		heads.map((text) => text.trim()).join('|') === 'Student|Status|Rate|Balance|Next lesson',
		heads.join('|')
	)
	const currentYear = Number(core.zonedParts(new Date(), VN).date.slice(0, 4))
	const cellA = studentRow(page, ST_A).first().locator('td').nth(4)
	const cellB = studentRow(page, ST_B).first().locator('td').nth(4)
	const lessonsLeftA = await studentRow(page, ST_A).first().locator('td').nth(3).textContent()
	const mainA = (await cellA.locator('span').first().textContent())?.trim()
	const wantA = expectedWhen(rowA!.nextLessonAt!, currentYear)
	check('row A: main line is formatted from the api value', mainA === wantA, `${mainA} / ${wantA}`)
	const handMade = `${shortDay(fx.wednesday)}${fx.wednesday.slice(0, 4) === String(currentYear) ? '' : ` ${fx.wednesday.slice(0, 4)}`}, 18:00`
	check('row A: main line equals the first Wednesday 18:00', mainA === handMade, handMade)
	check('row A: main line has no zone label and no relative words', !/VN|MSK|UTC|today|tomorrow/i.test(mainA ?? ''))
	const secondA = await secondLineOf(cellA)
	const wantSecond = expectedSecond(rowA!.nextLessonAt!, 'Europe/Moscow')
	check('row A: second line is the default Moscow zone', secondA === wantSecond, `${secondA} / ${wantSecond}`)
	check('row A: Moscow second line is 14:00 MSK', secondA === '14:00 MSK', String(secondA))
	const secondStyle = await cellA
		.locator('span')
		.nth(1)
		.evaluate((element) => {
			const style = getComputedStyle(element)
			return {
				size: style.fontSize,
				line: style.lineHeight,
				muted: (element as HTMLElement).className.includes('text-muted-foreground'),
				numeric: getComputedStyle(element.closest<HTMLElement>('td')!).fontVariantNumeric,
			}
		})
	check(
		'row A: second line is 11px over 14px',
		secondStyle.size === '11px' && secondStyle.line === '14px',
		`${secondStyle.size}/${secondStyle.line}`
	)
	check(
		'row A: second line is muted and tabular',
		secondStyle.muted && secondStyle.numeric.includes('tabular-nums'),
		secondStyle.numeric
	)
	const cellsB = await cellB.textContent()
	check('row B: Next lesson is None with no second line', cellsB?.trim() === 'None', cellsB?.trim())
	const noneMuted = await cellB
		.locator('span')
		.evaluate((element) => (element as HTMLElement).className.includes('text-muted-foreground'))
	check('row B: None is muted', noneMuted)
	check('row A: Balance cell says Not set', lessonsLeftA?.trim() === 'Not set', lessonsLeftA?.trim())
	const heightA = await studentRow(page, ST_A)
		.first()
		.evaluate((row) => row.getBoundingClientRect().height)
	const heightB = await studentRow(page, ST_B)
		.first()
		.evaluate((row) => row.getBoundingClientRect().height)
	check('row heights match with and without a second line', heightA === heightB, `${heightA}/${heightB}`)
	await shot(page, 'sched-students', 'next-lesson')

	await setSecondZone(page, 'Pacific/Auckland')
	await openStudentsList(page)
	const nextDay = await secondLineOf(cellA)
	const wantNextDay = expectedSecond(rowA!.nextLessonAt!, 'Pacific/Auckland')
	check('another zone: the second line follows the stored zone', nextDay === wantNextDay, `${nextDay} / ${wantNextDay}`)
	check(
		'another zone: a different date starts with the weekday',
		/^[A-Z][a-z]{2} \d\d:\d\d NZ(ST|DT)$/.test(nextDay ?? ''),
		String(nextDay)
	)
	check('another zone: main line is unchanged', (await cellA.locator('span').first().textContent())?.trim() === wantA)
	await shot(page, 'sched-students', 'next-day')

	await setSecondZone(page, 'none')
	await openStudentsList(page)
	check(
		'no second zone: only the main line',
		(await cellA.locator('span').count()) === 1,
		String(await cellA.locator('span').count())
	)
	const heightNone = await studentRow(page, ST_A)
		.first()
		.evaluate((row) => row.getBoundingClientRect().height)
	check('no second zone: row height is unchanged', heightNone === heightA, `${heightNone}/${heightA}`)
	await setSecondZone(page, null)
}

export async function students() {
	cleanupFixtures('students start', STUDENTS_LIKE)

	await withBrowser(
		{ width: 1440, height: 900 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await studentsFixtures(page)
			await studentsPart1(page, fx)
			console.log('STUDENTS_PART1_OK')
			await studentsPart2(page, fx)
			await studentsNarrow(page)
			console.log('STUDENTS_PART2_OK')
			await studentsPart3(page)
			console.log('STUDENTS_PART3_OK')
			const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		},
		() => cleanupFixtures('students end', STUDENTS_LIKE)
	)
	if (failures() === 0) console.log('SCHEDULE_WEB_STUDENTS_OK')
}
