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

const sections = { records: sectionRecords, conversations: sectionConversations }

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

const TITLE_A = 'Chat check Alpha'
const TITLE_B = 'Chat check Beta'
const LIST_ERROR = 'Could not load conversations.'
const RENAME_ERROR = 'Could not rename this conversation. Try again.'
const DELETE_ERROR = 'Could not delete this conversation. Try again.'
const SERVER_ERROR = { error: { code: 'internal_error', message: 'Internal Server Error' } }

function removeConversations(ids) {
	if (ids.length === 0) return
	const list = ids.map((id) => `'${id}'`).join(', ')
	const result = sql(`delete from chat_conversations where id in (${list})`)
	console.log(`fixture conversations removed ${result.rowCount}`)
}

function rowOf(page, id) {
	return page.locator('li').filter({ has: page.locator(`[data-row-id="${id}"]`) })
}

async function openList(page) {
	const button = page.getByRole('button', { name: 'All chats', exact: true })
	if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click()
	await page.locator('[data-all-chats][aria-expanded="true"]:visible').waitFor({ timeout: 15000 })
}

async function openRowMenu(page, id, item) {
	const row = rowOf(page, id)
	await row.hover()
	await row.getByRole('button', { name: /^More:/ }).click()
	await page.getByRole('menuitem', { name: item }).click()
}

async function readNewConversation(page) {
	const created = page.waitForResponse(
		(response) => response.url().endsWith('/api/chat/conversations') && response.request().method() === 'POST'
	)
	await page.getByRole('button', { name: 'New chat', exact: true }).click()
	const response = await created
	const body = await response.json()
	return { status: response.status(), id: body.conversation?.id ?? null, title: body.conversation?.title ?? null }
}

async function sectionConversations() {
	const createdIds = []
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const requested = []
			page.on('request', (request) => {
				if (request.url().includes('/api/')) requested.push(request.url())
			})
			await openChat(page, null)
			await page.getByRole('button', { name: 'All chats', exact: true }).waitFor({ timeout: 30000 })

			const first = await readNewConversation(page)
			if (first.id) createdIds.push(first.id)
			check('New chat creates a conversation with New chat title', first.status === 201 && first.title === 'New chat')
			await page.getByRole('heading', { name: 'New chat', level: 1 }).waitFor({ timeout: 15000 })
			check('the new conversation is selected in the address', page.url().includes(`c=${first.id}`), page.url())
			check(
				'creating asked only the conversations endpoint',
				requested.filter((url) => url.includes('/api/chat/') && !url.includes('/api/chat/conversations')).length === 0
			)
			await shot(page, 'chat-conversations', 'created')

			await page.reload()
			await page.getByRole('heading', { name: 'New chat', level: 1 }).waitFor({ timeout: 30000 })
			check('a reload keeps the selected conversation', page.url().includes(`c=${first.id}`))

			await openList(page)
			const row = rowOf(page, first.id)
			await row.waitFor({ timeout: 15000 })
			check('the list shows the conversation as Empty chat', (await row.innerText()).includes('Empty chat'))
			await shot(page, 'chat-conversations', 'list')

			await openRowMenu(page, first.id, 'Rename conversation')
			const dialog = page.getByRole('dialog', { name: 'Rename conversation' })
			await dialog.waitFor({ timeout: 15000 })
			const field = dialog.getByLabel('Conversation title')
			check('rename starts focused on the title field', await field.evaluate((node) => node === document.activeElement))
			await field.fill('')
			await dialog.getByRole('button', { name: 'Save title' }).click()
			check('an empty title says so at the field', (await dialog.getByText('Enter a title.').count()) === 1)
			await field.fill('x'.repeat(161))
			check(
				'a title over 160 characters is reported, not cut',
				(await dialog.getByText('Use 160 characters or fewer.').count()) === 1 &&
					(await field.inputValue()).length === 161
			)
			check(
				'Save title is off while the title is too long',
				await dialog.getByRole('button', { name: 'Save title' }).isDisabled()
			)
			await field.fill(TITLE_A)
			await page.route('**/api/chat/conversations/*', (route) =>
				route.request().method() === 'PATCH' ? route.fulfill({ status: 500, json: SERVER_ERROR }) : route.fallback()
			)
			await dialog.getByRole('button', { name: 'Save title' }).click()
			await dialog.getByText(RENAME_ERROR).waitFor({ timeout: 15000 })
			check('a failed rename keeps the dialog and the draft', (await field.inputValue()) === TITLE_A)
			await shot(page, 'chat-conversations', 'rename-error')
			await page.unroute('**/api/chat/conversations/*')
			await dialog.getByRole('button', { name: 'Save title' }).click()
			await dialog.waitFor({ state: 'detached', timeout: 15000 })
			await page.getByRole('heading', { name: TITLE_A, level: 1 }).waitFor({ timeout: 15000 })
			check('the renamed title is in the header', true)
			check(
				'the renamed conversation is first in the list',
				(await page.locator('[data-row-id]').first().getAttribute('data-row-id')) === first.id
			)

			await openRowMenu(page, first.id, 'Rename conversation')
			const again = page.getByRole('dialog', { name: 'Rename conversation' })
			await again.waitFor({ timeout: 15000 })
			await again.getByLabel('Conversation title').fill('Chat check Discarded')
			await again.getByRole('button', { name: 'Keep title' }).click()
			await again.waitFor({ state: 'detached', timeout: 15000 })
			check('Keep title leaves the saved title', (await rowOf(page, first.id).innerText()).includes(TITLE_A))

			await rowOf(page, first.id).locator('[data-row-id]').focus()
			await page.keyboard.press('Escape')
			await page.waitForTimeout(400)
			check(
				'Escape closes the list',
				(await page.getByRole('button', { name: 'All chats', exact: true }).getAttribute('aria-expanded')) === 'false'
			)

			const second = await readNewConversation(page)
			if (second.id) createdIds.push(second.id)
			await openList(page)
			await openRowMenu(page, second.id, 'Rename conversation')
			const secondDialog = page.getByRole('dialog', { name: 'Rename conversation' })
			await secondDialog.getByLabel('Conversation title').fill(TITLE_B)
			await secondDialog.getByRole('button', { name: 'Save title' }).click()
			await secondDialog.waitFor({ state: 'detached', timeout: 15000 })
			const order = await page.locator('[data-row-id]').evaluateAll((nodes) => nodes.map((node) => node.dataset.rowId))
			check(
				'the list is ordered by last change',
				order[0] === second.id && order[1] === first.id,
				order.slice(0, 3).join()
			)

			await openRowMenu(page, second.id, 'Delete conversation')
			const confirm = page.getByRole('dialog', { name: 'Delete this conversation?' })
			await confirm.waitFor({ timeout: 15000 })
			check(
				'delete starts focused on Keep conversation',
				await confirm
					.getByRole('button', { name: 'Keep conversation' })
					.evaluate((node) => node === document.activeElement)
			)
			check(
				'delete says lesson records, notes and calendar stay',
				(await confirm.innerText()).includes('Lesson records, student notes and calendar changes stay.')
			)
			await shot(page, 'chat-conversations', 'delete')
			await page.route('**/api/chat/conversations/*', (route) =>
				route.request().method() === 'DELETE' ? route.fulfill({ status: 500, json: SERVER_ERROR }) : route.fallback()
			)
			await confirm.getByRole('button', { name: 'Delete conversation' }).click()
			await confirm.getByText(DELETE_ERROR).waitFor({ timeout: 15000 })
			check('a failed delete keeps the dialog and the conversation', (await rowOf(page, second.id).count()) === 1)
			await page.unroute('**/api/chat/conversations/*')
			await confirm.getByRole('button', { name: 'Keep conversation' }).click()
			await confirm.waitFor({ state: 'detached', timeout: 15000 })
			check('Keep conversation keeps the chat', (await rowOf(page, second.id).count()) === 1)

			await openRowMenu(page, second.id, 'Delete conversation')
			await confirm.waitFor({ timeout: 15000 })
			await confirm.getByRole('button', { name: 'Delete conversation' }).click()
			await confirm.waitFor({ state: 'detached', timeout: 15000 })
			await page.waitForTimeout(300)
			check('the deleted conversation leaves the list', (await rowOf(page, second.id).count()) === 0)
			const tomb = sql(
				`select title, deleted_at is not null as deleted from chat_conversations where id = '${second.id}'`
			)
			check(
				'the row stays as a tombstone with no old title',
				tomb.rowCount === 1 && tomb.rows[0].deleted === true && tomb.rows[0].title === 'Deleted chat',
				JSON.stringify(tomb.rows)
			)
			const focused = await page.evaluate(() => {
				const node = document.activeElement
				return node instanceof HTMLElement && node.hasAttribute('data-all-chats') && node.offsetParent !== null
			})
			check('after a delete the focus is on All chats', focused)
			await shot(page, 'chat-conversations', 'after-delete')

			await page.route('**/api/chat/conversations', (route) =>
				route.request().method() === 'GET' ? route.fulfill({ status: 500, json: SERVER_ERROR }) : route.fallback()
			)
			await page.reload()
			await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 30000 })
			await openList(page)
			await page.getByText(LIST_ERROR).waitFor({ timeout: 15000 })
			check(
				'a failed list read shows the error with Refresh',
				(await page.getByRole('alert').filter({ hasText: LIST_ERROR }).count()) === 1
			)
			check('a failed list read creates no empty chat', (await page.locator('[data-row-id]').count()) === 0)
			await shot(page, 'chat-conversations', 'list-error')
			await page.getByRole('button', { name: 'Refresh', exact: true }).click()
			await page.getByText(LIST_ERROR).waitFor({ timeout: 15000 })
			check('Refresh with a failing read keeps the error', (await page.getByText(LIST_ERROR).count()) === 1)
			await page.unroute('**/api/chat/conversations')
			await page.getByRole('button', { name: 'Refresh', exact: true }).click()
			await rowOf(page, first.id).waitFor({ timeout: 15000 })
			check('Refresh after the failure shows the list', (await page.getByText(LIST_ERROR).count()) === 0)

			await page.setViewportSize({ width: 390, height: 800 })
			await page.reload()
			await page.getByRole('button', { name: 'All chats', exact: true }).waitFor({ timeout: 30000 })
			check(
				'on a phone New chat is an icon button',
				(await page.getByRole('button', { name: 'New chat', exact: true }).count()) === 1
			)
			await openList(page)
			await rowOf(page, first.id).waitFor({ timeout: 15000 })
			check(
				'on a phone the page does not scroll sideways',
				await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
			)
			await shot(page, 'chat-conversations', 'phone')

			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		() => removeConversations(createdIds)
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
