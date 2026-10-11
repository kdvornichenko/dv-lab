import * as core from '../../../packages/core/src/index.ts'
import { BASE, api, check, failures, shot } from '../web.mjs'
import {
	cleanupFixtures,
	createCard,
	setOpening,
	createOnce,
	markApi,
	openToday,
	readTodayApi,
	plural,
} from './common.mjs'

const DUE_NAMES = {
	debt: 'Alex Example 2185 A',
	zero: 'Alex Example 2185 B',
	one: 'Alex Example 2185 C',
	ten: 'Alex Example 2185 D',
	notSet: 'Alex Example 2185 E',
}

async function dueFixtures(page, today) {
	const opening = core.addDays(today, -3)
	const ids = {}
	for (const [key, name] of Object.entries(DUE_NAMES)) ids[key] = await createCard(page, name)
	await setOpening(page, ids.debt, opening, 0)
	await setOpening(page, ids.zero, opening, 0)
	await setOpening(page, ids.one, opening, 100)
	await setOpening(page, ids.ten, opening, 1000)
	const lesson = await createOnce(page, ids.debt, core.addDays(today, -1), '08:00', 90)
	await markApi(page, lesson, 'done')
	return ids
}

function dueRowFacts(page, studentId) {
	return page
		.locator(`section[aria-labelledby="today-pays-soon"] [data-slot="due-row"][data-student-id="${studentId}"]`)
		.first()
		.evaluate((row) => {
			const name = row.querySelector('[data-slot="due-name"]')
			const text = row.querySelector('[data-slot="due-balance"]')
			const dot = row.querySelector('[role="img"]')
			const mark = dot?.querySelector('i')
			return {
				height: row.getBoundingClientRect().height,
				nameWidth: name.getBoundingClientRect().width,
				nameHref: name.getAttribute('href'),
				text: text.textContent,
				textClass: text.className,
				label: dot?.getAttribute('aria-label') ?? null,
				tone: mark ? Array.from(mark.classList).find((item) => item.startsWith('bg-')) : null,
				dotBox: dot ? dot.getBoundingClientRect().width : null,
				dotTab: dot?.getAttribute('tabindex') ?? null,
				rowRight: row.getBoundingClientRect().right,
				dotRight: dot ? dot.getBoundingClientRect().right : null,
			}
		})
}

export async function todayPart3(page, fx) {
	cleanupFixtures('today part 3 start')
	const ids = await dueFixtures(page, fx.today)
	await openToday(page)
	const data = await readTodayApi(page)
	const order = data.paysSoon.map((student) => student.id)
	const index = Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, order.indexOf(id)]))
	check(
		'the answer holds the debt, the zero and the one-lesson fixtures in this order',
		index.debt >= 0 && index.zero > index.debt && index.one > index.zero,
		'order of fixtures only'
	)
	check('the answer holds neither the 10-lessons nor the not-set fixture', index.ten === -1 && index.notSet === -1)

	const keys = await page.evaluate(() =>
		Array.from(document.querySelectorAll('section[aria-labelledby="today-pays-soon"] [data-slot="due-row"]')).map(
			(row) => row.dataset.studentId
		)
	)
	check('Pays soon shows the answer order, at most 8 rows', JSON.stringify(keys) === JSON.stringify(order.slice(0, 8)))
	check(
		'neither the 10-lessons nor the not-set fixture is drawn',
		!keys.includes(ids.ten) && !keys.includes(ids.notSet)
	)
	const more = page.locator('section[aria-labelledby="today-pays-soon"] [data-slot="more-row"]')
	if (order.length > 8) {
		check(
			'Pays soon ends with +N more to /students',
			(await more.textContent()) === `+${order.length - 8} more` && (await more.getAttribute('href')) === '/students'
		)
	} else {
		check('Pays soon has no +N more with 8 rows or fewer', (await more.count()) === 0)
	}
	const caption = await page.locator('section[aria-labelledby="today-pays-soon"] p').first().textContent()
	check(
		'the caption names the current N and owing',
		caption === `${plural(data.paysSoonLessons)} or fewer left, or owing`,
		`N ${data.paysSoonLessons}`
	)
	const texts = await page.evaluate(() =>
		Array.from(document.querySelectorAll('section[aria-labelledby="today-pays-soon"] [data-slot="due-balance"]')).map(
			(item) => item.textContent
		)
	)
	check(
		'every balance text is a number of lessons: no date, urgency word or amount',
		texts.length > 0 && texts.every((text) => /^(owes )?\d+(\.\d+)? lessons?( left)?$/.test(text))
	)
	await shot(page, 'ledger-today', 'pays-soon-real')

	const students = (await api(page, 'GET', '/students')).json.students
	const rowOf = (id) => students.find((student) => student.id === id)
	const staged = [ids.debt, ids.zero, ids.one].map(rowOf)
	await page.route('**/api/today', async (route) => {
		const response = await route.fetch()
		const json = await response.json()
		await route.fulfill({ response, json: { ...json, paysSoon: staged, paysSoonLessons: 2 } })
	})
	await openToday(page)
	const expected = [
		['debt', 'owes 1.5 lessons', 'Owes lessons', 'bg-destructive'],
		['zero', '0 lessons left', 'No lessons left', 'bg-warning'],
		['one', '1 lesson left', 'Pays soon', 'bg-info'],
	]
	for (const [key, text, label, tone] of expected) {
		const facts = await dueRowFacts(page, ids[key])
		check(`${key}: the row says ${text}`, facts.text === text, facts.text)
		check(
			`${key}: the dot is ${tone} and says ${label}`,
			facts.label === label && facts.tone === tone,
			`${facts.label} ${facts.tone}`
		)
		check(
			`${key}: the row is 32px and the name column 112px`,
			facts.height === 32 && facts.nameWidth === 112,
			`${facts.height} ${facts.nameWidth}`
		)
		check(
			`${key}: the balance text is caption muted`,
			facts.textClass.includes('text-caption') && facts.textClass.includes('text-muted-foreground')
		)
		check(`${key}: the dot is a 24px focus target`, facts.dotBox === 24 && facts.dotTab === '0')
		check(
			`${key}: the dot ends 12px inside the row, as in the design`,
			Math.abs(facts.rowRight - facts.dotRight - 12) < 0.6,
			String(facts.rowRight - facts.dotRight)
		)
	}
	const rowsOrder = await page.evaluate(() =>
		Array.from(document.querySelectorAll('section[aria-labelledby="today-pays-soon"] [data-slot="due-row"]')).map(
			(row) => row.dataset.studentId
		)
	)
	check(
		'the staged rows keep the order debt, zero, one',
		JSON.stringify(rowsOrder) === JSON.stringify([ids.debt, ids.zero, ids.one])
	)
	await shot(page, 'ledger-today', 'pays-soon')

	const row = page.locator(
		`section[aria-labelledby="today-pays-soon"] [data-slot="due-row"][data-student-id="${ids.zero}"]`
	)
	const dot = row.locator('[role="img"]')
	await dot.click()
	check('a click on the dot does not open the profile', new URL(page.url()).pathname === '/')
	await dot.focus()
	check(
		'the dot takes focus apart from the name link',
		await dot.evaluate((element) => document.activeElement === element)
	)
	const box = await row.boundingBox()
	await page.mouse.click(box.x + box.width * 0.55, box.y + box.height / 2)
	await page.waitForURL(`${BASE}/students/${ids.zero}`, { timeout: 20000 }).catch(() => {})
	check('a click on the row opens the profile of the fixture', page.url() === `${BASE}/students/${ids.zero}`)
	await page.unroute('**/api/today')

	await page.route('**/api/today', async (route) => {
		const response = await route.fetch()
		const json = await response.json()
		await route.fulfill({ response, json: { ...json, paysSoon: [], paysSoonLessons: 1 } })
	})
	await openToday(page)
	const empty = await page.locator('section[aria-labelledby="today-pays-soon"]').textContent()
	check(
		'nobody to pay: the empty state names N = 1 in both lines',
		empty.includes('Nobody needs to pay soon') &&
			empty.includes('Students appear here when they have 1 lesson left or fewer, or owe lessons.') &&
			empty.includes('1 lesson or fewer left, or owing')
	)
	check(
		'nobody to pay: the empty state has no action',
		(await page
			.locator('section[aria-labelledby="today-pays-soon"] a, section[aria-labelledby="today-pays-soon"] button')
			.count()) === 0
	)
	await shot(page, 'ledger-today', 'pays-soon-empty')
	await page.unroute('**/api/today')
	console.log(failures() === 0 ? 'TODAY_WEB_PART3_OK' : 'TODAY_WEB_PART3_FAIL')
}
