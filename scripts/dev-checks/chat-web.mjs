import { randomUUID } from 'node:crypto'

import * as core from '../../packages/core/src/index.ts'
import { BASE, api, check, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'
import { VN, createCard, openStudentsList, setOpening } from './ledger-web/common.mjs'
import { balanceFacts } from './ledger-web/students.mjs'

const PREFIX = 'Alex Example 221'
const PAYS_SOON = { name: 'Alex Example 2211', hundredths: 100 }
const NOT_SET = { name: 'Alex Example 2212', hundredths: null }
const READ_ERROR = "Could not read the student's records."
const EXPECTED_NOISE = /status of 500|Failed to load resource/

const sections = { records: sectionRecords }

function removeFixtures() {
	const result = sql(`delete from students where display_name like '${PREFIX}%' and import_key is null`)
	console.log(`fixture cards removed ${result.rowCount}`)
}

function setTheme(page) {
	return page.addInitScript((value) => {
		try {
			localStorage.setItem('theme', value)
		} catch {}
	}, theme)
}

async function openChat(page, studentId) {
	await page.goto(studentId === null ? `${BASE}/chat` : `${BASE}/chat?student=${studentId}`)
	await page.getByRole('heading', { name: 'Chat', level: 1 }).waitFor({ timeout: 30000 })
}

function factsGroup(page, name) {
	return page.getByRole('group', { name: `Facts: ${name}` })
}

async function sectionRecords() {
	removeFixtures()
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const today = core.zonedParts(new Date(), VN).date
			const opening = core.addDays(today, -3)
			const ids = {}
			for (const item of [PAYS_SOON, NOT_SET]) {
				ids[item.name] = await createCard(page, item.name)
				if (item.hundredths !== null) await setOpening(page, ids[item.name], opening, item.hundredths)
			}

			await openStudentsList(page)
			const students = {}
			for (const item of [PAYS_SOON, NOT_SET]) students[item.name] = await balanceFacts(page, item.name)

			const recordReads = []
			page.on('request', (request) => {
				if (request.url().includes('/api/chat/records')) recordReads.push(request.url())
			})
			await openChat(page, null)
			await page.getByText('What do you want to ask?').waitFor({ timeout: 15000 })
			await page.waitForTimeout(500)
			check('no student selected makes no records request', recordReads.length === 0, String(recordReads.length))

			for (const item of [PAYS_SOON, NOT_SET]) {
				await openChat(page, ids[item.name])
				const group = factsGroup(page, item.name)
				await group.waitFor({ timeout: 30000 })
				const text = await group.innerText()
				const row = students[item.name]
				check(`${item.name}: chat balance text equals Students (${row.text})`, text.includes(row.text), text)
				if (row.dotLabel !== null) {
					check(`${item.name}: chat shows the Students state ${row.dotLabel}`, text.includes(row.dotLabel), text)
				} else {
					check(
						`${item.name}: not set is not shown as zero`,
						text.includes('No opening balance yet.') && !/0 lessons/.test(text),
						text
					)
				}
				check(`${item.name}: next lesson block is present`, text.includes('Next lesson'), text)
				check(
					`${item.name}: the name opens the profile`,
					(await group.getByRole('link', { name: item.name }).getAttribute('href')) === `/students/${ids[item.name]}`
				)
				await shot(page, 'chat-records', item.name.slice(-4))
			}

			await openChat(page, ids[PAYS_SOON.name])
			await factsGroup(page, PAYS_SOON.name).waitFor({ timeout: 30000 })
			await page.route('**/api/chat/records*', async (route) => {
				const response = await route.fetch()
				const body = await response.json()
				await route.fulfill({
					response,
					json: { ...body, nextLesson: { ...body.nextLesson, result: 'unknown', startsAt: null } },
				})
			})
			await page.reload()
			const unavailable = factsGroup(page, PAYS_SOON.name)
			await unavailable.waitFor({ timeout: 30000 })
			const unavailableText = await unavailable.innerText()
			check(
				'an unknown next lesson is Unavailable, never No lesson ahead',
				unavailableText.includes('Unavailable') &&
					unavailableText.includes('The calendar view is not current.') &&
					!unavailableText.includes('No lesson ahead'),
				unavailableText
			)
			await shot(page, 'chat-records', 'unavailable')
			await page.unroute('**/api/chat/records*')

			await page.route('**/api/chat/records*', (route) =>
				route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
			)
			await openChat(page, ids[PAYS_SOON.name])
			await page.getByText(READ_ERROR).waitFor({ timeout: 30000 })
			check(
				'a failed read shows the read error block',
				(await page.getByRole('alert').filter({ hasText: READ_ERROR }).count()) === 1
			)
			check('a failed read shows no facts', (await factsGroup(page, PAYS_SOON.name).count()) === 0)
			await shot(page, 'chat-records', 'error')
			await page.getByRole('button', { name: 'Refresh records' }).click()
			await page.getByRole('button', { name: 'Refresh records' }).waitFor({ timeout: 15000 })
			check('refresh with a failing read keeps the error', (await page.getByText(READ_ERROR).count()) === 1)
			await page.unroute('**/api/chat/records*')
			await page.getByRole('button', { name: 'Refresh records' }).click()
			await factsGroup(page, PAYS_SOON.name).waitFor({ timeout: 30000 })
			check('refresh after the failure shows the facts', (await page.getByText(READ_ERROR).count()) === 0)

			await openChat(page, randomUUID())
			await page.getByText('This student is no longer available.').waitFor({ timeout: 30000 })
			check('an unknown student is shown as no longer available', true)
			await shot(page, 'chat-records', 'missing')

			await page.setViewportSize({ width: 390, height: 800 })
			await openChat(page, ids[PAYS_SOON.name])
			await factsGroup(page, PAYS_SOON.name).waitFor({ timeout: 30000 })
			const columns = await factsGroup(page, PAYS_SOON.name).evaluate((group) => {
				const grid = group.querySelector('.grid')
				return grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0
			})
			check('on a phone the facts are one column', columns === 1, String(columns))
			await shot(page, 'chat-records', 'phone')

			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		removeFixtures
	)
}

const section = process.argv[2]
const run = sections[section]
if (!run) {
	console.log(`usage: node scripts/dev-checks/chat-web.mjs ${Object.keys(sections).join('|')} [light|dark]`)
	process.exit(2)
}

try {
	await run()
} catch (error) {
	check('section completed', false, String(error).slice(0, 1500))
}
if (failures() === 0) console.log(`CHAT_WEB_${section.toUpperCase()}_OK`)
process.exit(failures())
