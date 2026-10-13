import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createConnection } from 'node:net'

import * as core from '../../packages/core/src/index.ts'
import { BASE, ROOT, api, check, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'
import { VN, createCard, openStudentsList, setOpening } from './ledger-web/common.mjs'
import { balanceFacts } from './ledger-web/students.mjs'

const PREFIX = 'Alex Example 221'
const PAYS_SOON = { name: 'Alex Example 2211', hundredths: 100 }
const NOT_SET = { name: 'Alex Example 2212', hundredths: null }
const READ_ERROR = "Could not read the student's records."
const EXPECTED_NOISE = /status of 500|Failed to load resource|server caches disabled/

const sections = {
	records: sectionRecords,
	conversations: sectionConversations,
	notes: sectionNotes,
	comments: sectionComments,
	composer: sectionComposer,
	actions: sectionActions,
	calendar: sectionCalendar,
	budget: sectionBudget,
	stream: sectionStream,
	answers: sectionAnswers,
	models: sectionModels,
	delete: sectionDelete,
}

function removeFixtures() {
	const cards = `select id from students where display_name like '${PREFIX}%' and import_key is null`
	sql(`delete from lesson_comments where student_id in (${cards})`)
	sql(`delete from lesson_marks where lesson_id in (select id from lessons where student_id in (${cards}))`)
	sql(`delete from lessons where student_id in (${cards})`)
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from student_sections where student_id in (${cards})`)
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
				if (row.dotLabel === 'Plenty left') {
					check(
						`${item.name}: chat shows no state label for Plenty left`,
						!/Pays soon|No lessons left|Owes lessons|Plenty left/.test(text),
						text
					)
				} else if (row.dotLabel !== null) {
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
	sql(`delete from chat_actions where conversation_id in (${list})`)
	sql(`delete from chat_usage_attempts where conversation_id in (${list})`)
	sql(`delete from chat_turns where conversation_id in (${list})`)
	sql(`delete from chat_messages where reply_to is not null and conversation_id in (${list})`)
	sql(`delete from chat_messages where conversation_id in (${list})`)
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
	const posts = []
	const listen = (request) => {
		if (request.method() === 'POST' && request.url().endsWith('/api/chat/conversations')) posts.push(request.url())
	}
	page.on('request', listen)
	await page.getByRole('button', { name: 'New chat', exact: true }).click()
	const field = page.locator(FIELD)
	await field.waitFor({ timeout: 15000 })
	await field.fill('Chat check message')
	await page.waitForTimeout(300)
	const savedBySelf = posts.length
	const created = page.waitForResponse(
		(response) => response.url().endsWith('/api/chat/conversations') && response.request().method() === 'POST'
	)
	const sent = page.waitForResponse(
		(response) => response.url().endsWith('/messages') && response.request().method() === 'POST'
	)
	await page.locator(SEND).click()
	const response = await created
	const body = await response.json()
	const message = await sent
	page.off('request', listen)
	return {
		status: response.status(),
		id: body.conversation?.id ?? null,
		title: body.conversation?.title ?? null,
		savedBySelf,
		messageStatus: message.status(),
	}
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
			check('New chat alone saves no conversation', first.savedBySelf === 0)
			check(
				'the first message creates the conversation with New chat title and is sent to it',
				first.status === 201 && first.title === 'New chat' && first.messageStatus === 201
			)
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
			check('the list shows the conversation', (await row.count()) === 1)
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

const NOTES_CARD = 'Alex Example 2214'
const NOTES_READ_ERROR = 'Could not load the added notes.'
const sectionPanel = (page, kind) => page.locator(`section[aria-labelledby="section-${kind}"]`)
const noteState = (id) =>
	sql(`select revision, retracted_at is not null as retracted, body from student_notes where id = '${id}'`).rows[0]

async function openNotesTab(page, id) {
	await page.goto(`${BASE}/students/${id}`)
	await page.getByRole('tab', { name: 'Notes', exact: true }).click()
	await sectionPanel(page, 'goals').waitFor({ timeout: 30000 })
}

async function sectionNotes() {
	removeFixtures()
	const noteIds = {}
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const id = await createCard(page, NOTES_CARD)
			const base = 'Goals base text'
			const put = await api(page, 'PUT', `/students/${id}/sections/goals`, { body: base })
			check('the goals section text is saved', put.status === 200, String(put.status))
			const insert = (kind, body, ago) =>
				sql(
					`insert into student_notes (student_id, section_kind, body, created_at) values ('${id}', '${kind}', '${body}', now() - interval '${ago}') returning id`
				).rows[0].id
			noteIds.alpha = insert('goals', 'Note alpha text', '2 days')
			noteIds.beta = insert('goals', 'Note beta text', '1 minute')
			noteIds.gamma = insert('interests', 'Note gamma text', '1 hour')

			await openNotesTab(page, id)
			const goals = sectionPanel(page, 'goals')
			const interests = sectionPanel(page, 'interests')
			await goals.getByText('Note beta text').waitFor({ timeout: 15000 })
			check(
				'goals lists both added notes, newest first, under the section text',
				(await goals.innerText()).indexOf(base) < (await goals.innerText()).indexOf('Note beta text') &&
					(await goals.innerText()).indexOf('Note beta text') < (await goals.innerText()).indexOf('Note alpha text')
			)
			check(
				'each entry says it was added in chat and has a named Remove button',
				(await goals.getByText('Added in chat').count()) >= 2 &&
					(await goals.getByRole('button', { name: /^Remove note from \d{1,2} [A-Z][a-z]{2}/ }).count()) === 2
			)
			check(
				'only sections with entries draw the Added notes heading',
				(await page.getByText('Added notes', { exact: true }).count()) === 2 &&
					(await interests.getByText('Note gamma text').count()) === 1 &&
					(await sectionPanel(page, 'general_info').getByText('Added notes').count()) === 0
			)
			const list = goals.getByRole('list')
			check('the entries are a list', (await list.count()) >= 1)
			const firstRemove = goals.getByRole('button', { name: /^Remove note from / }).first()
			await page.mouse.move(0, 0)
			check(
				'Remove keeps its place and is hidden until hover on a pointer screen',
				(await firstRemove.evaluate((node) => getComputedStyle(node).opacity)) === '0'
			)
			await goals.getByText('Note beta text').hover()
			await page.waitForTimeout(300)
			check(
				'hovering the row shows Remove',
				(await firstRemove.evaluate((node) => getComputedStyle(node).opacity)) === '1'
			)
			await shot(page, 'chat-notes', 'list')

			await goals.getByRole('button', { name: 'Edit' }).click()
			const area = goals.getByRole('textbox', { name: 'Goals' })
			check(
				'the editor holds only the section text',
				(await area.inputValue()) === base && !(await area.inputValue()).includes('Note ')
			)
			check(
				'the editor says later notes are not part of the text',
				(await goals
					.getByText('Notes added later are listed under the section. They are not part of this text.')
					.count()) === 1
			)
			check('the entries stay under the editor', (await goals.getByText('Note beta text').count()) === 1)
			await area.fill(`${base} edited`)
			const saving = page.waitForRequest(
				(request) => request.method() === 'PUT' && request.url().includes('/sections/goals')
			)
			await goals.getByRole('button', { name: 'Save section' }).click()
			const request = await saving
			check(
				'saving sends only the section text',
				request.postData() === JSON.stringify({ body: `${base} edited` }),
				request.postData()
			)
			await page.getByText('Section saved').waitFor({ timeout: 15000 })
			const savedBody = sql(`select body from student_sections where student_id = '${id}' and kind = 'goals'`).rows[0]
				.body
			check('the saved section text has no note in it', savedBody === `${base} edited`)
			check(
				'saving the section changed no note',
				['alpha', 'beta', 'gamma'].every((key) => {
					const row = noteState(noteIds[key])
					return row.revision === 1 && row.retracted === false
				})
			)
			check(
				'both goals entries are still listed after the save',
				(await goals.getByText(/^Note (alpha|beta) text$/).count()) === 2
			)

			const removeButton = goals.getByRole('button', { name: /^Remove note from / }).first()
			await goals.getByText('Note beta text').hover()
			await removeButton.click()
			const dialog = page.getByRole('dialog', { name: 'Remove this note?' })
			await dialog.waitFor({ timeout: 15000 })
			check(
				'the confirm explains the removal and focuses Keep note',
				(await dialog
					.getByText("The note is deleted from the student's notes. The text of the section is not changed.")
					.count()) === 1 && (await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Keep note'
			)
			await shot(page, 'chat-notes', 'confirm')
			await dialog.getByRole('button', { name: 'Keep note' }).click()
			await dialog.waitFor({ state: 'detached', timeout: 15000 })
			check(
				'Keep note changes nothing',
				noteState(noteIds.beta).retracted === false && noteState(noteIds.beta).revision === 1
			)

			await page.route('**/api/students/*/notes/*/retract', (route) =>
				route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
			)
			await goals.getByText('Note beta text').hover()
			await removeButton.click()
			await dialog.waitFor({ timeout: 15000 })
			await dialog.getByRole('button', { name: 'Remove note' }).click()
			await dialog.getByText('Could not remove the note. Try again.').waitFor({ timeout: 15000 })
			check(
				'a failed removal keeps the dialog and the row',
				(await goals.getByText('Note beta text').count()) === 1 && noteState(noteIds.beta).retracted === false
			)
			await shot(page, 'chat-notes', 'failed')
			await page.unroute('**/api/students/*/notes/*/retract')

			const delayed = page.route('**/api/students/*/notes/*/retract', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 1200))
				await route.continue()
			})
			await delayed
			await dialog.getByRole('button', { name: 'Remove note' }).click()
			await goals.getByText('Removing…').first().waitFor({ timeout: 5000 })
			check(
				'during the request the row is dimmed and says Removing',
				(await goals.getByText('Note beta text').count()) === 1
			)
			await shot(page, 'chat-notes', 'removing')
			await dialog.waitFor({ state: 'detached', timeout: 15000 })
			await page.unroute('**/api/students/*/notes/*/retract')
			await page.getByText('Note removed').waitFor({ timeout: 15000 })
			const beta = noteState(noteIds.beta)
			check(
				'removal leaves the row, marks it retracted and raises the revision',
				beta.retracted === true && beta.revision === 2 && beta.body === 'Note beta text'
			)
			check(
				'the removed entry left the list and the other stayed',
				(await goals.getByText('Note beta text').count()) === 0 &&
					(await goals.getByText('Note alpha text').count()) === 1
			)
			check(
				'the section text was not changed by the removal',
				sql(`select body from student_sections where student_id = '${id}' and kind = 'goals'`).rows[0].body ===
					`${base} edited`
			)
			check(
				'focus moved to the next entry',
				(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')).startsWith(
					'Remove note from'
				)
			)

			sql(`update student_notes set revision = revision + 1 where id = '${noteIds.alpha}'`)
			await goals.getByText('Note alpha text').hover()
			await goals
				.getByRole('button', { name: /^Remove note from / })
				.first()
				.click()
			await dialog.waitFor({ timeout: 15000 })
			await dialog.getByRole('button', { name: 'Remove note' }).click()
			await dialog.waitFor({ state: 'detached', timeout: 15000 })
			await goals.getByText('This note changed after it was added. The list is updated.').waitFor({ timeout: 15000 })
			check(
				'a stale revision closes the dialog, says so and keeps the note',
				(await goals.getByText('Note alpha text').count()) === 1 &&
					noteState(noteIds.alpha).retracted === false &&
					noteState(noteIds.alpha).revision === 2
			)
			await shot(page, 'chat-notes', 'conflict')
			await goals.getByText('Note alpha text').hover()
			await goals
				.getByRole('button', { name: /^Remove note from / })
				.first()
				.click()
			await dialog.getByRole('button', { name: 'Remove note' }).click()
			await dialog.waitFor({ state: 'detached', timeout: 15000 })
			await page.waitForTimeout(300)
			check(
				'the second try with the fresh revision removes the note',
				noteState(noteIds.alpha).retracted === true &&
					noteState(noteIds.alpha).revision === 3 &&
					(await goals.getByText('Added notes').count()) === 0
			)

			await page.route('**/api/students/*/notes', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 1500))
				await route.continue().catch(() => {})
			})
			await page.reload()
			await page.getByRole('tab', { name: 'Notes', exact: true }).click()
			await goals.getByText('Goals base text edited').waitFor({ timeout: 30000 })
			check(
				'while the entries load the section text is there and two skeleton lines wait under it',
				(await goals.getByRole('status', { name: 'Loading added notes' }).count()) === 1
			)
			await shot(page, 'chat-notes', 'loading')
			await page.unroute('**/api/students/*/notes')

			await page.route('**/api/students/*/notes', (route) =>
				route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
			)
			await page.reload()
			await page.getByRole('tab', { name: 'Notes', exact: true }).click()
			await goals.getByText(NOTES_READ_ERROR).waitFor({ timeout: 30000 })
			check(
				'a failed read keeps the section text and shows one line with Refresh under each section',
				(await goals.getByText('Goals base text edited').count()) === 1 &&
					(await goals.getByRole('button', { name: 'Refresh' }).count()) === 1
			)
			await shot(page, 'chat-notes', 'read-error')
			await goals.getByRole('button', { name: 'Refresh' }).click()
			await page.waitForTimeout(800)
			check('Refresh with a failing read keeps the line', (await goals.getByText(NOTES_READ_ERROR).count()) === 1)
			await page.unroute('**/api/students/*/notes')
			await goals.getByRole('button', { name: 'Refresh' }).click()
			await interests.getByText('Note gamma text').waitFor({ timeout: 15000 })
			check('Refresh after the failure shows the entries', (await goals.getByText(NOTES_READ_ERROR).count()) === 0)

			await page.setViewportSize({ width: 390, height: 800 })
			await page.reload()
			await page.getByRole('tab', { name: 'Notes', exact: true }).click()
			await interests.getByText('Note gamma text').waitFor({ timeout: 30000 })
			const phoneRemove = interests.getByRole('button', { name: /^Remove note from / })
			check(
				'on a phone Remove is visible without hover',
				(await phoneRemove.evaluate((node) => getComputedStyle(node).opacity)) === '1'
			)
			check(
				'on a phone the page does not scroll sideways',
				await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
			)
			await shot(page, 'chat-notes', 'phone')

			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		() => removeFixtures()
	)
}

const COMMENTS_CARD = 'Alex Example 2215'
const COMMENT_READ_ERROR = 'Could not load the comments.'
const NO_COMMENTS = 'No comments yet. Ask in the chat to add one.'
const EVENT_BLOCK = '[data-slot="week-grid-body"] [data-slot="calendar-event"]'
const commentState = (id) =>
	sql(`select revision, retracted_at is not null as retracted from lesson_comments where id = '${id}'`).rows[0]
const markRows = () => sql('select count(*)::int as n from lesson_marks').rows[0].n
const commentsIn = (dialog) => dialog.locator('section[aria-labelledby="lesson-comments-title"]')

function insertLesson(cardId, minutes) {
	return sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values ('${cardId}', now() + interval '${minutes} minutes', 60, 'scheduled') returning id`
	).rows[0].id
}

function insertComment(cardId, lessonId, body, ago) {
	return sql(
		`insert into lesson_comments (lesson_id, student_id, body, created_at) values ('${lessonId}', '${cardId}', '${body}', now() - interval '${ago}') returning id`
	).rows[0].id
}

async function removeOne(page, dialog, body, ids) {
	const section = commentsIn(dialog)
	const row = section.getByRole('listitem').filter({ hasText: body })
	await row.hover()
	await row.getByRole('button', { name: /^Remove comment from / }).click()
	const confirm = page.getByRole('dialog', { name: 'Remove this comment?' })
	await confirm.waitFor({ timeout: 15000 })
	check(
		'the confirm explains the removal and focuses Keep comment',
		(await confirm.getByText('The comment is deleted. The lesson and its mark do not change.').count()) === 1 &&
			(await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Keep comment'
	)
	await confirm.getByRole('button', { name: 'Keep comment' }).click()
	await confirm.waitFor({ state: 'detached', timeout: 15000 })
	check('Keep comment changes nothing', commentState(ids[body]).retracted === false)
	const marksBefore = markRows()
	await row.hover()
	await row.getByRole('button', { name: /^Remove comment from / }).click()
	await confirm.waitFor({ timeout: 15000 })
	await confirm.getByRole('button', { name: 'Remove comment' }).click()
	await confirm.waitFor({ state: 'detached', timeout: 15000 })
	await page.getByText('Comment removed').first().waitFor({ timeout: 15000 })
	check(
		`removing "${body}" retracts the row, keeps it in the table and changes no mark`,
		commentState(ids[body]).retracted === true &&
			commentState(ids[body]).revision === 2 &&
			markRows() === marksBefore &&
			(await section.getByText(body).count()) === 0
	)
}

async function sectionComments() {
	removeFixtures()
	const ids = {}
	let lessonId = null
	let futureId = null
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const card = await createCard(page, COMMENTS_CARD)
			lessonId = insertLesson(card, -20)
			const local = core.zonedParts(new Date(), VN).time
			const canFuture = Number(local.slice(0, 2)) < 21
			futureId = canFuture ? insertLesson(card, 120) : null
			ids['Comment alpha text'] = insertComment(card, lessonId, 'Comment alpha text', '2 hours')
			ids['Comment beta text'] = insertComment(card, lessonId, 'Comment beta text', '1 minute')
			insertComment(card, lessonId, 'Comment retracted text', '3 hours')
			sql(
				`update lesson_comments set retracted_at = now(), revision = 2 where body = 'Comment retracted text' and student_id = '${card}'`
			)

			await page.route('**/api/schedule/lessons/*/comments', (route) =>
				route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
			)
			await page.goto(`${BASE}/`)
			const open = (name) => page.locator('[data-slot="today-row-open"]').filter({ hasText: name }).first()
			await open(COMMENTS_CARD).waitFor({ timeout: 60000 })
			await open(COMMENTS_CARD).click()
			let dialog = page.getByRole('dialog').last()
			await dialog.getByText(COMMENT_READ_ERROR).waitFor({ timeout: 30000 })
			check(
				'a failed read is a line with Refresh, never an empty list',
				(await commentsIn(dialog).getByText(NO_COMMENTS).count()) === 0 &&
					(await commentsIn(dialog).getByRole('button', { name: 'Refresh' }).count()) === 1
			)
			await shot(page, 'chat-comments', 'error')
			await commentsIn(dialog).getByRole('button', { name: 'Refresh' }).click()
			await commentsIn(dialog).getByRole('button', { name: 'Refresh' }).waitFor({ timeout: 15000 })
			check('Refresh with a failing read keeps the line', (await dialog.getByText(COMMENT_READ_ERROR).count()) === 1)
			await page.unroute('**/api/schedule/lessons/*/comments')
			await commentsIn(dialog).getByRole('button', { name: 'Refresh' }).click()
			await dialog.getByText('Comment beta text').waitFor({ timeout: 15000 })

			const section = commentsIn(dialog)
			const text = await section.innerText()
			check(
				'the Today dialog of a started lesson lists two comments, newest first, and not the retracted one',
				text.indexOf('Comment beta text') >= 0 &&
					text.indexOf('Comment beta text') < text.indexOf('Comment alpha text') &&
					!text.includes('Comment retracted text')
			)
			check(
				'each comment has a time with the zone label and a named Remove button',
				(await section
					.getByRole('button', { name: /^Remove comment from \d{1,2} [A-Z][a-z]{2}, \d{2}:\d{2}$/ })
					.count()) === 2 && /\d{2}:\d{2} [A-Z]{2,}/.test(text)
			)
			check('the window has no field to write a comment', (await dialog.getByRole('textbox').count()) === 0)
			check(
				'the comments are not part of the move form',
				(await dialog.getByRole('group', { name: 'Move lesson' }).locator('text=Comment').count()) === 0
			)
			await shot(page, 'chat-comments', 'today')
			await removeOne(page, dialog, 'Comment beta text', ids)
			await removeOne(page, dialog, 'Comment alpha text', ids)
			await section.getByText(NO_COMMENTS).waitFor({ timeout: 15000 })
			check('with none left the section says to ask in the chat', true)
			await shot(page, 'chat-comments', 'empty')
			await page.keyboard.press('Escape')

			if (futureId !== null) {
				await page.reload()
				await open(COMMENTS_CARD).waitFor({ timeout: 60000 })
				const rows = page.locator('[data-slot="today-row-open"]').filter({ hasText: COMMENTS_CARD })
				await rows.last().click()
				dialog = page.getByRole('dialog').last()
				await dialog
					.getByRole('button', { name: /Move lesson|Cancel lesson/ })
					.first()
					.waitFor({ timeout: 30000 })
				check(
					'a lesson that has not started shows no Comments section',
					(await dialog.getByText('Comments', { exact: true }).count()) === 0
				)
				await page.keyboard.press('Escape')
			}

			ids['Schedule first text'] = insertComment(card, lessonId, 'Schedule first text', '30 minutes')
			ids['Schedule second text'] = insertComment(card, lessonId, 'Schedule second text', '10 minutes')
			await page.route(/\/api\/schedule\/week/, async (route) => {
				const response = await route.fetch()
				let json
				try {
					json = await response.json()
				} catch {
					return route.fulfill({ response })
				}
				const target = json?.events?.find(
					(event) => event.when?.kind === 'timed' && Date.parse(event.when.endsAt) < Date.now()
				)
				if (json?.read?.state === 'fresh' && target) {
					target.binding = {
						kind: 'lesson',
						ref: { kind: 'single', lessonId },
						studentId: card,
						version: target.version,
						mark: null,
					}
					target.title = null
					target.suggestion = null
				}
				return route.fulfill({ response, json })
			})
			await page.goto(`${BASE}/schedule`)
			await page.locator(EVENT_BLOCK).first().waitFor({ timeout: 120000 })
			const block = page.locator(EVENT_BLOCK).filter({ hasText: COMMENTS_CARD }).first()
			await block.waitFor({ timeout: 30000 })
			await block.click()
			dialog = page.getByRole('dialog').last()
			await dialog.getByText('Schedule second text').waitFor({ timeout: 30000 })
			check(
				'the Schedule dialog of a started lesson lists the same comments',
				(await commentsIn(dialog).getByRole('listitem').count()) === 2
			)
			await shot(page, 'chat-comments', 'schedule')
			await removeOne(page, dialog, 'Schedule first text', ids)
			check(
				'one comment is left in the Schedule dialog',
				(await commentsIn(dialog).getByRole('listitem').count()) === 1
			)
			await page.keyboard.press('Escape')

			await page.setViewportSize({ width: 390, height: 800 })
			await page.goto(`${BASE}/`)
			await open(COMMENTS_CARD).waitFor({ timeout: 60000 })
			await open(COMMENTS_CARD).click()
			dialog = page.getByRole('dialog').last()
			await dialog.getByText('Schedule second text').waitFor({ timeout: 30000 })
			const phoneRemove = commentsIn(dialog).getByRole('button', { name: /^Remove comment from / })
			check(
				'on a phone Remove is visible without hover',
				(await phoneRemove.evaluate((node) => getComputedStyle(node).opacity)) === '1'
			)
			check(
				'on a phone the page does not scroll sideways',
				await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
			)
			await shot(page, 'chat-comments', 'phone')

			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		() => removeFixtures()
	)
}

const COMPOSER_CARD = 'Alex Example 2216'
const COMPOSER_TWIN = 'Alex Example 2217'
const FIELD = '[data-slot="chat-composer-field"]'
const POPUP = '[data-slot="mention-popup"]'
const QUICK_ROW = '[data-slot="chat-quick-actions"]'
const STALE = 'This student is no longer available. Choose a student again.'

async function bindings(page) {
	return JSON.parse((await page.locator(FIELD).getAttribute('data-mentions')) ?? '[]')
}

async function value(page) {
	return page.locator(FIELD).inputValue()
}

async function retype(page, text) {
	const field = page.locator(FIELD)
	await field.fill('')
	await field.click()
	await page.keyboard.type(text)
}

async function sectionComposer() {
	removeFixtures()
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const ids = {
				single: await createCard(page, COMPOSER_CARD),
				twinA: await createCard(page, COMPOSER_TWIN),
				twinB: await createCard(page, COMPOSER_TWIN),
			}
			const twins = [ids.twinA, ids.twinB].sort()
			const reads = []
			const writes = []
			page.on('request', (request) => {
				const url = request.url()
				if (!url.includes('/api/')) return
				if (url.includes('/api/students/options')) reads.push(url)
				else if (request.method() !== 'GET') writes.push(`${request.method()} ${url}`)
			})
			await openChat(page, null)
			const field = page.locator(FIELD)
			await field.waitFor({ timeout: 30000 })
			await page.waitForTimeout(500)
			const readsOnOpen = reads.length
			check(
				'the screen reads /students/options on open, at most twice under StrictMode in next dev',
				readsOnOpen >= 1 && readsOnOpen <= 2,
				String(readsOnOpen)
			)

			await retype(page, `@${COMPOSER_TWIN}`)
			const popup = page.locator(POPUP)
			await popup.waitFor({ timeout: 15000 })
			const options = popup.getByRole('option')
			check('@ opens the list with the two students of one name', (await options.count()) === 2)
			const details = await options.evaluateAll((rows) => rows.map((row) => row.innerText))
			check(
				'two students with one name each have a second line',
				details.every((text) => text.includes(COMPOSER_TWIN) && text.includes('Usual lesson')),
				details.join(' | ')
			)
			check('the field keeps the focus', await field.evaluate((node) => node === document.activeElement))
			await shot(page, 'chat-composer', 'list')
			await page.keyboard.press('ArrowDown')
			check(
				'arrow down moves the active row',
				(await options.nth(1).getAttribute('aria-selected')) === 'true' &&
					(await field.getAttribute('aria-activedescendant')) === (await options.nth(1).getAttribute('id'))
			)
			await page.keyboard.press('Enter')
			await popup.waitFor({ state: 'detached', timeout: 5000 })
			const chosen = await bindings(page)
			check(
				'Enter inserts the name and binds the chosen id without sending',
				(await value(page)) === `@${COMPOSER_TWIN} ` &&
					chosen.length === 1 &&
					chosen[0].studentId === twins[1] &&
					chosen[0].start === 1 &&
					chosen[0].end === 1 + COMPOSER_TWIN.length &&
					writes.length === 0,
				JSON.stringify(chosen)
			)
			check('choosing a student makes no request', reads.length === readsOnOpen)

			const quick = page.locator(QUICK_ROW)
			await quick.waitFor({ timeout: 5000 })
			check(
				'four quick buttons appear with a bound student',
				(await quick.getByRole('button').allInnerTexts()).join('|') === "Was|Didn't happen|No-show|Moved to…"
			)
			await quick.getByRole('button', { name: 'Was' }).click()
			const afterWas = await value(page)
			await quick.getByRole('button', { name: 'No-show' }).click()
			const afterNoShow = await value(page)
			await quick.getByRole('button', { name: 'Moved to…' }).click()
			const afterMoved = await value(page)
			check(
				'quick buttons put an editable command after the name and send nothing',
				afterWas === `@${COMPOSER_TWIN} was at the lesson today` &&
					afterNoShow === `@${COMPOSER_TWIN} didn't come` &&
					afterMoved === `@${COMPOSER_TWIN} moved to ` &&
					writes.length === 0 &&
					(await bindings(page)).length === 1,
				JSON.stringify([afterWas, afterNoShow, afterMoved])
			)
			await shot(page, 'chat-composer', 'quick')

			check('Send is on with a bound command in the field', await page.locator(SEND).isEnabled())
			await page.keyboard.press('Shift+Enter')
			check('Shift+Enter adds a line', (await value(page)).endsWith('\n'))

			await page.keyboard.type('@Alex')
			await popup.waitFor({ timeout: 5000 })
			await page.keyboard.press('Escape')
			await popup.waitFor({ state: 'detached', timeout: 5000 })
			check(
				'Esc closes only the list, the text stays',
				(await value(page)).endsWith('@Alex') && (await page.getByRole('button', { name: 'All chats' }).count()) > 0
			)

			await retype(page, `@${COMPOSER_CARD}`)
			await popup.waitFor({ timeout: 5000 })
			await page.keyboard.press('Tab')
			await popup.waitFor({ state: 'detached', timeout: 5000 })
			check('Tab chooses the student too', (await bindings(page)).length === 1)
			await field.evaluate((node) => node.setSelectionRange(5, 5))
			await page.keyboard.type('x')
			check(
				'editing the name breaks the binding and says so',
				(await bindings(page)).length === 0 && (await page.getByText(STALE).count()) === 1
			)
			await page.keyboard.press('Enter')
			check(
				'with a broken binding Send is off and Enter sends nothing',
				(await page.locator(SEND).isDisabled()) && writes.length === 0 && !(await value(page)).includes('\n')
			)
			await shot(page, 'chat-composer', 'stale')

			await retype(page, `@${COMPOSER_CARD}`)
			await popup.waitFor({ timeout: 5000 })
			await page.keyboard.press('Enter')
			await page.keyboard.press('Backspace')
			await page.keyboard.press('Backspace')
			check(
				'one Backspace at the end of the name removes the whole name',
				(await value(page)) === '' && (await bindings(page)).length === 0 && (await page.getByText(STALE).count()) === 0
			)

			await retype(page, '/')
			await popup.waitFor({ timeout: 5000 })
			const commands = await popup.getByRole('option').allInnerTexts()
			check(
				'/ offers only the phase 22 commands',
				commands.length === 5 &&
					['/today', '/tomorrow', '/payments', '/note', '/recap'].every((name) =>
						commands.some((text) => text.startsWith(name))
					) &&
					!commands.some((text) => text.startsWith('/pay ') || text.startsWith('/feedback')),
				commands.join(' | ')
			)
			await popup.getByRole('option').filter({ hasText: '/note' }).click()
			await popup.getByRole('option').first().waitFor({ timeout: 5000 })
			check('/note inserts the command and opens the student list', (await value(page)) === '/note @')
			await shot(page, 'chat-composer', 'commands')

			await retype(page, '@Zzzz')
			await popup.getByText('No students found').waitFor({ timeout: 5000 })
			check('no match says No students found', (await popup.getByText('Try a student name.').count()) === 1)
			await page.keyboard.press('Enter')
			await page.waitForTimeout(400)
			check(
				'Enter with the open empty list sends nothing and keeps the list and the text',
				writes.length === 0 && (await popup.count()) === 1 && (await value(page)) === '@Zzzz'
			)

			await page.route('**/api/students/options', async (route) => {
				await new Promise((resolve) => setTimeout(resolve, 4000))
				await route.continue()
			})
			await page.reload()
			await field.waitFor({ timeout: 30000 })
			await retype(page, '@Alex Ex')
			await popup.waitFor({ timeout: 3000 })
			await page.keyboard.press('Enter')
			await page.waitForTimeout(400)
			check(
				'Enter while the student rows are still loading sends nothing, even with a space in the name',
				writes.length === 0 && (await popup.count()) === 1 && (await value(page)) === '@Alex Ex'
			)
			await page.unroute('**/api/students/options')

			await page.route('**/api/students/options', (route) =>
				route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
			)
			await page.reload()
			await field.waitFor({ timeout: 30000 })
			await retype(page, '@Alex')
			await popup.getByText('Could not load students. Try again.').waitFor({ timeout: 15000 })
			check(
				'a failed read is an error with Try again, not an empty list',
				(await popup.getByRole('option').count()) === 0
			)
			await shot(page, 'chat-composer', 'error')
			await page.unroute('**/api/students/options')
			await popup.getByRole('button', { name: 'Try again' }).click()
			await popup.getByRole('option').first().waitFor({ timeout: 15000 })
			check('Try again loads the list and keeps the text', (await value(page)) === '@Alex')

			await page.setViewportSize({ width: 375, height: 760 })
			await retype(page, `@${COMPOSER_TWIN}`)
			await popup.waitFor({ timeout: 5000 })
			const box = await popup.boundingBox()
			check(
				'on 375px the list fits the screen',
				box !== null && box.x >= 0 && box.x + box.width <= 375,
				JSON.stringify(box)
			)
			await page.keyboard.press('Enter')
			await quick.waitFor({ timeout: 5000 })
			const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
			const quickBox = await quick.boundingBox()
			check(
				'on 375px the quick buttons fit without horizontal scroll',
				overflow <= 0 && quickBox !== null && quickBox.x + quickBox.width <= 375,
				`${overflow} ${JSON.stringify(quickBox)}`
			)
			await shot(page, 'chat-composer', 'phone')

			check('nothing was sent from the composer', writes.length === 0, writes.join(' | '))
			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		removeFixtures
	)
}

const ACTIONS_CARD = 'Alex Example 2218'
const SEND = '[data-slot="chat-send"]'
const RESULT = '[data-slot="chat-action-result"]'
const SEND_ERROR = 'Could not send the message. Try again.'

const isPost = (response, suffix) => response.request().method() === 'POST' && response.url().endsWith(suffix)
const isToday = (response) => response.request().method() === 'GET' && response.url().endsWith('/api/today')
const lessonMark = (lessonId) =>
	sql(`select kind, revision from lesson_marks where lesson_id = '${lessonId}'`).rows[0] ?? null

async function sectionActions() {
	removeFixtures()
	const conversationIds = []
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, context, problems }) => {
			await setTheme(page)
			await signIn(page)
			const card = await createCard(page, ACTIONS_CARD)
			await setOpening(page, card, core.addDays(core.scheduleToday(new Date(), VN), -30), 600)
			const lessonId = insertLesson(card, -20)

			const today = await context.newPage()
			await setTheme(today)
			await today.goto(`${BASE}/`)
			const row = (status) =>
				today.locator(`[data-slot="today-row"][data-student-id="${card}"]${status ? `[data-status="${status}"]` : ''}`)
			await row(null).waitFor({ timeout: 30000 })
			check('Today in the second tab waits for a mark', (await row(null).getAttribute('data-status')) === 'needs_mark')

			await openChat(page, null)
			const field = page.locator(FIELD)
			await field.waitFor({ timeout: 30000 })
			await field.click()
			await page.keyboard.type(`@${ACTIONS_CARD}`)
			await page.locator(POPUP).waitFor({ timeout: 15000 })
			await page.keyboard.press('Enter')
			await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
			await page.locator(QUICK_ROW).getByRole('button', { name: 'Was' }).click()
			const draftText = `@${ACTIONS_CARD} was at the lesson today`
			check('the quick button puts the command in the field', (await value(page)) === draftText)

			const bodies = []
			const conversationPosts = []
			page.on('request', (request) => {
				if (request.method() === 'POST' && request.url().endsWith('/api/chat/conversations'))
					conversationPosts.push(request.url())
			})
			await page.route('**/api/chat/conversations/*/messages', (route) => {
				bodies.push(route.request().postDataJSON())
				if (bodies.length === 1) return route.fulfill({ status: 500, json: SERVER_ERROR })
				return route.fallback()
			})
			const created = page.waitForResponse((response) => isPost(response, '/api/chat/conversations'))
			await page.locator(SEND).click()
			const conversation = await (await created).json()
			if (conversation.conversation?.id) conversationIds.push(conversation.conversation.id)
			await page.getByText(SEND_ERROR).waitFor({ timeout: 15000 })
			check(
				'a failed send keeps the draft and its binding',
				(await value(page)) === draftText && (await bindings(page)).length === 1
			)
			check('the failed send changed no mark', lessonMark(lessonId) === null)
			await shot(page, 'chat-actions', 'send-error')

			const todayRead = today.waitForResponse(isToday, { timeout: 30000 })
			const sent = page.waitForResponse((response) => isPost(response, '/messages') && response.status() === 201)
			await page.locator(SEND).click()
			await sent
			check(
				'the retry goes out with the same requestId to the same conversation',
				bodies.length === 2 &&
					bodies[0].requestId === bodies[1].requestId &&
					bodies[1].text === draftText &&
					conversationPosts.length === 1,
				JSON.stringify(bodies.map((body) => body.requestId))
			)
			const result = page.locator(RESULT).last()
			await result.waitFor({ timeout: 15000 })
			check(
				'the reply shows Lesson marked Done with the lesson and Undo',
				(await result.innerText()).includes('Lesson marked Done.') &&
					(await result.innerText()).includes(ACTIONS_CARD) &&
					(await result.getByRole('button', { name: 'Undo: Lesson marked Done' }).count()) === 1
			)
			check('the draft is cleared after the answer', (await value(page)) === '')
			check('the mark is Done', lessonMark(lessonId)?.kind === 'done')
			check(
				'the teacher message is on the right with the student token',
				(await page.locator('[data-role="teacher"]').last().innerText()).includes(`@${ACTIONS_CARD}`)
			)
			await shot(page, 'chat-actions', 'result')

			await today.bringToFront()
			await todayRead
			await row('done').waitFor({ timeout: 15000 })
			check('Today in the other tab shows Done without a reload', true)
			await shot(today, 'chat-actions', 'today-done')

			await page.bringToFront()
			const todayBack = today.waitForResponse(isToday, { timeout: 30000 })
			const undone = page.waitForResponse((response) => isPost(response, '/undo'))
			await result.getByRole('button', { name: 'Undo: Lesson marked Done' }).click()
			await undone
			await page.locator(`${RESULT}[data-undo="done"]`).waitFor({ timeout: 15000 })
			check(
				'Undo turns the block into Change undone with no second Undo',
				(await result.innerText()).includes('Change undone.') &&
					(await result.innerText()).includes('back to Scheduled') &&
					(await result.getByRole('button', { name: /^Undo/ }).count()) === 0
			)
			check('the mark is back to none', lessonMark(lessonId)?.kind === 'none')
			await today.bringToFront()
			await todayBack
			await row('needs_mark').waitFor({ timeout: 15000 })
			check('Today in the other tab is back without a reload', true)

			await page.bringToFront()
			await page.reload()
			await page.locator(`${RESULT}[data-undo="done"]`).waitFor({ timeout: 30000 })
			check('a reload shows the same undone result', (await page.locator(RESULT).count()) === 1)
			await shot(page, 'chat-actions', 'undone')

			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		() => removeConversations(conversationIds),
		removeFixtures
	)
}

const CALENDAR_CARD = 'Alex Example 2219'
const CHANGE = '[data-slot="chat-calendar-change"]'
const WAITING = 'Waiting for Google Calendar to confirm this change…'
const ACCEPTED = 'Google Calendar accepted the change. Updating the schedule…'
const UNKNOWN = 'This calendar change has not been confirmed. Check its status before trying another change.'
const REFUSED = 'Google Calendar did not accept the change. Nothing was changed.'
const PENDING_LINE = 'Earlier calendar requests need recovery before you can make new changes.'

function proposal(actionId) {
	const tomorrow = core.addDays(core.scheduleToday(new Date(), VN), 1)
	return {
		type: 'calendar_proposal',
		actionId,
		operation: 'move',
		studentName: CALENDAR_CARD,
		timeZone: VN,
		lesson: {
			key: `l:${randomUUID()}`,
			startsAt: core.zonedInstant(tomorrow, '10:00', VN).toISOString(),
			durationMinutes: 60,
		},
		target: { kind: 'lesson', startsAt: core.zonedInstant(tomorrow, '18:00', VN).toISOString(), durationMinutes: 60 },
		clearsNoShow: false,
		state: 'proposed',
		undo: null,
	}
}

async function proposeIn(page, text) {
	const field = page.locator(FIELD)
	await field.click()
	await page.keyboard.type(`@${CALENDAR_CARD}`)
	await page.locator(POPUP).getByText(CALENDAR_CARD).first().waitFor({ timeout: 15000 })
	await page.keyboard.press('Enter')
	await page.locator(POPUP).waitFor({ state: 'detached', timeout: 5000 })
	await page.keyboard.type(text)
	const sent = page.waitForResponse((response) => isPost(response, '/messages'))
	await page.locator(SEND).click()
	await sent
	return page.locator(CHANGE).last()
}

async function sectionCalendar() {
	removeFixtures()
	const conversationIds = []
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			await createCard(page, CALENDAR_CARD)
			const writes = []
			page.on('request', (request) => {
				if (request.method() !== 'GET' && /\/api\/(schedule|google)\//.test(request.url())) writes.push(request.url())
			})
			let conversation = null
			const blocks = []
			const created = page.waitForResponse((response) => isPost(response, '/api/chat/conversations'))
			await page.route('**/api/chat/conversations/*/messages', async (route) => {
				conversation ??= (await (await created).json()).conversation
				if (conversation?.id && !conversationIds.includes(conversation.id)) conversationIds.push(conversation.id)
				const body = route.request().postDataJSON()
				const block = proposal(randomUUID())
				blocks.push(block)
				const now = new Date().toISOString()
				return route.fulfill({
					status: 201,
					json: {
						conversation,
						messages: [
							{
								id: randomUUID(),
								role: 'teacher',
								body: body.text,
								mentions: body.mentions,
								blocks: [],
								createdAt: now,
							},
							{ id: randomUUID(), role: 'assistant', body: '', mentions: [], blocks: [block], createdAt: now },
						],
					},
				})
			})
			const confirms = []
			const checks = []
			const answers = { confirm: [], check: [] }
			await page.route('**/api/chat/actions/*/confirm', (route) => {
				confirms.push(route.request().url())
				const next = answers.confirm.shift()
				return route.fulfill({ status: 202, json: { block: next } })
			})
			await page.route('**/api/chat/actions/*/check', (route) => {
				checks.push(route.request().url())
				const next = answers.check.shift() ?? answers.last
				return route.fulfill({ status: 200, json: { block: next } })
			})

			await openChat(page, null)
			await page.locator(FIELD).waitFor({ timeout: 30000 })
			const first = await proposeIn(page, ' moved to tomorrow 18:00')
			await first.waitFor({ timeout: 15000 })
			const shownFirst = await first.innerText()
			check(
				'the proposal shows Move, Was and Now with Confirm and Keep and nothing is written',
				shownFirst.includes(`Move ${CALENDAR_CARD}'s lesson?`) &&
					shownFirst.includes('Was') &&
					shownFirst.includes('Now') &&
					(await first.getByRole('button', { name: 'Confirm' }).count()) === 1 &&
					(await first.getByRole('button', { name: 'Keep' }).count()) === 1 &&
					confirms.length === 0,
				shownFirst
			)
			await shot(page, 'chat-calendar', 'proposed')

			const block = blocks[0]
			answers.confirm.push({ ...block, state: 'pending' })
			answers.check.push({ ...block, state: 'pending', accepted: true })
			answers.last = { ...block, state: 'applied', undo: 'available' }
			await first.getByRole('button', { name: 'Confirm' }).click()
			await first.getByText(WAITING).waitFor({ timeout: 15000 })
			check('Confirm waits for Google without Saved', !(await first.innerText()).includes('Saved.'))
			await shot(page, 'chat-calendar', 'pending')
			await first.getByText(ACCEPTED).waitFor({ timeout: 15000 })
			check('accepted by Google is not Saved yet', !(await first.innerText()).includes('Saved.'))
			await first.getByText('Saved.', { exact: true }).waitFor({ timeout: 15000 })
			check(
				'applied shows Saved, the saved line and Undo',
				(await first.innerText()).includes('Calendar change saved.') &&
					(await first.getByRole('button', { name: 'Undo: Calendar change saved' }).count()) === 1 &&
					checks.length >= 2
			)
			await shot(page, 'chat-calendar', 'saved')

			const second = await proposeIn(page, ' moved to tomorrow 18:00')
			await second.waitFor({ timeout: 15000 })
			const unknown = blocks[1]
			answers.confirm.push({ ...unknown, state: 'unknown' })
			answers.check.push({ ...unknown, state: 'applied', undo: 'available' })
			answers.last = { ...unknown, state: 'applied', undo: 'available' }
			const checksBefore = checks.length
			await second.getByRole('button', { name: 'Confirm' }).click()
			await second.getByText(UNKNOWN).waitFor({ timeout: 15000 })
			await page.waitForTimeout(2500)
			check('an unknown result asks for Check status and sends nothing by itself', checks.length === checksBefore)
			await second.getByRole('button', { name: 'Check status' }).click()
			await second.getByText('Saved.', { exact: true }).waitFor({ timeout: 15000 })
			check('Check status turns into Saved only when the block is applied', checks.length === checksBefore + 1)
			await shot(page, 'chat-calendar', 'unknown-checked')

			const third = await proposeIn(page, ' moved to tomorrow 18:00')
			await third.waitFor({ timeout: 15000 })
			answers.confirm.push({ ...blocks[2], state: 'failed', issue: 'command_pending' })
			await third.getByRole('button', { name: 'Confirm' }).click()
			const refused = page.locator(`${CHANGE}[data-state="failed"]`).last()
			await refused.waitFor({ timeout: 15000 })
			const refusedText = await refused.innerText()
			check(
				'failed command_pending says nothing was changed and why',
				refusedText.includes(REFUSED) && refusedText.includes(PENDING_LINE),
				refusedText
			)
			await shot(page, 'chat-calendar', 'failed')

			const fourth = await proposeIn(page, ' moved to tomorrow 18:00')
			await fourth.waitFor({ timeout: 15000 })
			await fourth.getByRole('button', { name: 'Keep' }).click()
			await page.locator(`${CHANGE}[data-state="kept"]`).waitFor({ timeout: 15000 })
			check('Keep collapses the proposal and sends nothing', confirms.length === 3)

			check('the block never writes to schedule or Google routes', writes.length === 0, writes.join(' | '))
			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		() => removeConversations(conversationIds),
		removeFixtures
	)
}

function appSql(text) {
	const result = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/sql.mjs`, `${ROOT}/.env`, 'app', text], {
		encoding: 'utf8',
	})
	if (result.status !== 0 || result.error) throw new Error('Fixture SQL under the application role failed')
	return JSON.parse(result.stdout.trim().split('\n').pop() ?? '')
}

const BUDGET_TITLE = 'Alex Example 2220 budget'
const BUDGET = '[data-budget-state]'

async function openBudget(page) {
	await page.goto(`${BASE}/settings?tab=assistant`)
	await page.locator(`${BUDGET}:visible`).waitFor({ timeout: 30000 })
}

async function sectionBudget() {
	const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
	const settingsRow = sql(
		`select chat_monthly_cap_usd::text as cap, default_time_zone as zone from teacher_settings where account_id = '${accountId}'`
	).rows[0]
	const zone = settingsRow?.zone ?? core.SCHEDULE_TIME_ZONE
	const startsOn = `${core.zonedParts(new Date(), zone).date.slice(0, 7)}-01`
	const existing = sql(
		`select id, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where account_id = '${accountId}' and starts_on = '${startsOn}'`
	).rows[0]
	const conversations = []
	const restore = () => {
		if (conversations.length > 0) {
			const list = conversations.map((id) => `'${id}'`).join(', ')
			sql(`delete from chat_usage_attempts where conversation_id in (${list})`)
		}
		if (existing)
			sql(
				`update chat_budget_periods set spent_nano = ${existing.spent}, held_nano = ${existing.held} where id = '${existing.id}'`
			)
		else sql(`delete from chat_budget_periods where account_id = '${accountId}' and starts_on = '${startsOn}'`)
		if (settingsRow)
			sql(`update teacher_settings set chat_monthly_cap_usd = ${settingsRow.cap} where account_id = '${accountId}'`)
		removeConversations(conversations)
	}
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			if (settingsRow)
				appSql(`update teacher_settings set chat_monthly_cap_usd = 10.00 where account_id = '${accountId}'`)
			const conversationId = appSql(
				`insert into chat_conversations (account_id, title) values ('${accountId}', '${BUDGET_TITLE}') returning id`
			).rows[0].id
			conversations.push(conversationId)
			const zoneLiteral = zone.replaceAll("'", "''")
			const endsBefore = (() => {
				const year = Number.parseInt(startsOn.slice(0, 4), 10)
				const month = Number.parseInt(startsOn.slice(5, 7), 10)
				return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
			})()
			appSql(
				`insert into chat_budget_periods (account_id, starts_on, ends_before, time_zone) values ('${accountId}', '${startsOn}', '${endsBefore}', '${zoneLiteral}') on conflict (account_id, starts_on) do nothing`
			)
			const periodId = sql(
				`select id from chat_budget_periods where account_id = '${accountId}' and starts_on = '${startsOn}'`
			).rows[0].id
			const base = sql(
				`select spent_nano::text as spent, held_nano::text as held from chat_budget_periods where id = '${periodId}'`
			).rows[0]
			if (base.spent !== '0' || base.held !== '0') {
				sql(`update chat_budget_periods set spent_nano = 0, held_nano = 0 where id = '${periodId}'`)
			}
			const pricing = JSON.stringify({
				inputPerMTok: '0.10',
				cacheWrite5mPerMTok: '0.125',
				cacheReadPerMTok: '0.01',
				outputPerMTok: '0.50',
			})
			const attempt = (state, reserved, cost) =>
				appSql(
					`insert into chat_usage_attempts (account_id, conversation_id, period_id, model, effort, pricing, max_input_tokens, max_output_tokens, reserved_nano, state, cost_nano) values ('${accountId}', '${conversationId}', '${periodId}', 'claude-haiku-5-5', 'medium', '${pricing}'::jsonb, 100000, 16000, ${reserved}, '${state}', ${cost ?? 'null'})`
				)
			attempt('settled', 20500000, 8500000000)
			appSql(`update chat_budget_periods set spent_nano = spent_nano + 8500000000 where id = '${periodId}'`)

			await openBudget(page)
			const card = page.locator(`${BUDGET}:visible`)
			const field = page.locator('#settings-monthly-limit')
			check('the limit field shows the saved $10', (await field.inputValue()) === '10.00', await field.inputValue())
			check('85% is the warning state', (await card.getAttribute('data-budget-state')) === 'warning')
			const warningText = await card.innerText()
			check(
				'usage, remaining and the conversation come from the server',
				warningText.includes('$8.50 used') &&
					warningText.includes('$1.50 left') &&
					!warningText.includes('held by a request in progress') &&
					warningText.includes(BUDGET_TITLE) &&
					warningText.includes('Costs count toward your monthly budget.') &&
					warningText.includes('Saved to your account.'),
				warningText
			)
			check('the bar shows 85%', (await card.locator('[data-budget-fill]').getAttribute('data-budget-fill')) === '85')
			await shot(page, 'chat-budget', 'warning')

			attempt('unknown', 2000000000, null)
			appSql(`update chat_budget_periods set held_nano = held_nano + 2000000000 where id = '${periodId}'`)
			await openBudget(page)
			const reachedText = await card.innerText()
			check(
				'usage with an unconfirmed reserve at the cap is the reached state with a full bar',
				(await card.getAttribute('data-budget-state')) === 'reached' &&
					(await card.locator('[data-budget-fill]').getAttribute('data-budget-fill')) === '100' &&
					reachedText.includes('$0.00 left') &&
					reachedText.includes('$2.00 is held by a request in progress.') &&
					reachedText.includes('Usage has not been confirmed. The figures are estimates.'),
				reachedText
			)
			await shot(page, 'chat-budget', 'reached')

			const save = card.getByRole('button', { name: 'Save' })
			check('Save is off without changes', await save.isDisabled())
			await field.fill('0')
			check(
				'a zero limit shows the field error and keeps Save off',
				(await card.innerText()).includes('Enter a monthly budget above zero.') &&
					(await field.getAttribute('aria-invalid')) === 'true' &&
					(await save.isDisabled())
			)
			await shot(page, 'chat-budget', 'invalid')
			await field.fill('5')
			check(
				'a limit below this month usage says the assistant stays paused',
				(await card.locator('[data-budget-note="above-limit"]').count()) === 1 &&
					(await card.innerText()).includes('Unsaved changes') &&
					!(await save.isDisabled())
			)
			const patches = []
			page.on('request', (request) => {
				if (request.method() === 'PATCH' && request.url().includes('/api/settings/assistant'))
					patches.push(request.postData())
			})
			await field.fill('15')
			await save.click()
			await page.getByText('Monthly limit: $15.00.').waitFor({ timeout: 15000 })
			await card.getByText('Saved to your account.').waitFor({ timeout: 15000 })
			const savedCap = sql(
				`select chat_monthly_cap_usd::text as cap from teacher_settings where account_id = '${accountId}'`
			).rows[0].cap
			check(
				'Save sends one PATCH, the toast follows the server answer and the cap is stored',
				patches.length === 1 && JSON.parse(patches[0]).monthlyCapUsd === '15' && savedCap === '15.00',
				`${patches.join()} ${savedCap}`
			)
			check(
				'after saving $15 the state follows the server',
				(await card.getAttribute('data-budget-state')) === 'ok' && (await card.innerText()).includes('$8.50 used')
			)
			await shot(page, 'chat-budget', 'saved')

			await page.route('**/api/settings/assistant', (route) =>
				route.request().method() === 'GET'
					? route.fulfill({
							status: 500,
							json: { error: { code: 'internal_error', message: 'Internal Server Error' } },
						})
					: route.continue()
			)
			await page.goto(`${BASE}/settings?tab=assistant`)
			await page.getByText('Budget status unavailable. Refresh before sending.').waitFor({ timeout: 30000 })
			check(
				'a read error shows the unavailable state with Refresh status, no numbers',
				(await page.locator('[data-budget-state="unavailable"]:visible').count()) === 1 &&
					(await page.getByRole('button', { name: 'Refresh status' }).count()) === 1 &&
					(await page.locator('[data-budget-usage]').count()) === 0
			)
			await shot(page, 'chat-budget', 'unavailable')
			await page.unroute('**/api/settings/assistant')
			await page.getByRole('button', { name: 'Refresh status' }).click()
			await page.locator(`${BUDGET}[data-budget-state="ok"]:visible`).waitFor({ timeout: 30000 })
			check('Refresh status reads the budget again', true)

			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		restore
	)
}

const STOP = '[data-slot="chat-stop"]'
const REPLY_TEXT = '[data-slot="chat-reply-text"]'
const FAKE_FIRST = 'Here is a short plan for the next lesson.'
const FAKE_LAST = 'That should fit well into one session.'

function portFree(port) {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host: '127.0.0.1' })
		socket.setTimeout(1500)
		socket.on('connect', () => {
			socket.destroy()
			resolve(false)
		})
		socket.on('timeout', () => {
			socket.destroy()
			resolve(true)
		})
		socket.on('error', () => resolve(true))
	})
}

async function startFakeModelApi() {
	if (!(await portFree(4000))) throw new Error('port 4000 is busy: stop the dev api first, this section starts its own')
	const env = {
		...process.env,
		PORT: '4000',
		APP_ORIGIN: BASE,
		ANTHROPIC_API_KEY: 'sk-ant-fake-check',
		LOG_LEVEL: 'info',
	}
	delete env.DATABASE_URL
	delete env.MIGRATOR_DATABASE_URL
	const child = spawn(
		process.execPath,
		['--import', `${ROOT}/scripts/dev-checks/chat-fake-anthropic.mjs`, '--env-file=.env', 'apps/api/src/server.ts'],
		{ cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] }
	)
	let output = ''
	child.stdout.on('data', (chunk) => (output += chunk))
	child.stderr.on('data', (chunk) => (output += chunk))
	const deadline = Date.now() + 30000
	while (Date.now() < deadline) {
		if (child.exitCode !== null) break
		try {
			const res = await fetch('http://127.0.0.1:4000/healthz')
			if (res.status === 200) return { child, logs: () => output }
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 300))
	}
	child.kill('SIGTERM')
	throw new Error('the api with the fake model did not answer /healthz in 30 s')
}

function stopFakeModelApi(started) {
	if (!started || started.child.exitCode !== null) return Promise.resolve()
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			started.child.kill('SIGKILL')
			resolve()
		}, 15000)
		started.child.once('exit', () => {
			clearTimeout(timer)
			resolve()
		})
		started.child.kill('SIGTERM')
	})
}

async function replyText(page) {
	const texts = await page.locator(REPLY_TEXT).allInnerTexts()
	return texts.at(-1) ?? ''
}

async function sectionStream() {
	const started = await startFakeModelApi()
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	const period = teacher
		? sql(
				`select id, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where account_id = '${teacher}' order by starts_on desc limit 1`
			).rows[0]
		: undefined
	const turns = (conversationId) =>
		sql(`select state from chat_turns where conversation_id = '${conversationId}' order by created_at`).rows.map(
			(row) => row.state
		)
	try {
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await setTheme(page)
				await signIn(page)
				await openChat(page, null)
				const field = page.locator(FIELD)
				await field.waitFor({ timeout: 30000 })
				await field.click()
				await page.keyboard.type('Plan the next lesson for my group')
				await page.keyboard.press('Enter')
				await page.locator(STOP).waitFor({ timeout: 15000 })
				check('while the reply comes Send becomes Stop reply and the field is off', await field.isDisabled())
				await page.locator(REPLY_TEXT).waitFor({ timeout: 15000 })
				const early = await replyText(page)
				await page.waitForTimeout(1500)
				const later = await replyText(page)
				check(
					'the reply grows sentence by sentence',
					early.startsWith(FAKE_FIRST) && later.length > early.length,
					`${early.length} -> ${later.length}`
				)
				await shot(page, 'chat-stream', 'streaming')
				const conversationId = new URL(page.url()).searchParams.get('c')
				if (conversationId) conversations.push(conversationId)
				await page.reload()
				await page.locator(REPLY_TEXT).waitFor({ timeout: 30000 })
				const resumed = await replyText(page)
				check('after a reload during the reply the same text is back', resumed.startsWith(later), resumed)
				await page.getByText(FAKE_LAST).waitFor({ timeout: 30000 })
				await page.locator(SEND).waitFor({ timeout: 15000 })
				check(
					'the reply finishes once, with one turn and no second request after the reload',
					conversationId !== null && JSON.stringify(turns(conversationId)) === '["completed"]',
					JSON.stringify(conversationId ? turns(conversationId) : null)
				)
				await shot(page, 'chat-stream', 'done')

				await field.click()
				const repliesBefore = await page.locator(REPLY_TEXT).count()
				await page.keyboard.type('Another plan please')
				await page.keyboard.press('Enter')
				await page.locator(STOP).waitFor({ timeout: 15000 })
				await page.waitForFunction(
					({ selector, before }) => {
						const items = document.querySelectorAll(selector)
						return items.length > before && (items[items.length - 1]?.textContent ?? '').length > 10
					},
					{ selector: REPLY_TEXT, before: repliesBefore },
					{ timeout: 15000 }
				)
				await page.locator(STOP).click()
				await page.getByText('Reply stopped.').waitFor({ timeout: 15000 })
				await page.locator(SEND).waitFor({ timeout: 15000 })
				const states = conversationId ? turns(conversationId) : []
				check(
					'Stop reply ends the turn as stopped and keeps the text that arrived',
					JSON.stringify(states) === '["completed","stopped"]' && (await replyText(page)).startsWith(FAKE_FIRST),
					JSON.stringify(states)
				)
				await shot(page, 'chat-stream', 'stopped')
				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
				check('the api log has no reply text', !started.logs().includes(FAKE_FIRST))
			},
			() => removeConversations(conversations),
			() => {
				if (period)
					sql(
						`update chat_budget_periods set spent_nano = ${period.spent}, held_nano = ${period.held} where id = '${period.id}'`
					)
			}
		)
	} finally {
		await stopFakeModelApi(started)
	}
}

const ANSWER_PAYS = { name: 'Alex Example 2213', hundredths: 100 }
const ANSWER_UNSET = { name: 'Alex Example 2214', hundredths: null }
const READ_BROKEN = { type: 'read_failed', key: { kind: 'day', day: 'payments' } }
const EXCERPT_TEXT = 'Prefers short reading texts. Needs more time for the writing task.'
const IDEA_LINES = ['Start with a short reading warm-up.', 'Give the writing task a fixed time limit.']

async function sendCommand(page, text) {
	const field = page.locator(FIELD)
	await field.click()
	await page.keyboard.type(text)
	await page.keyboard.press('Enter')
	await page.locator(SEND).click()
}

async function sectionAnswers() {
	removeFixtures()
	const conversationIds = []
	await withBrowser(
		{ width: 1280, height: 800 },
		async ({ context, page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const opening = core.addDays(core.zonedParts(new Date(), VN).date, -3)
			const ids = {}
			for (const item of [ANSWER_PAYS, ANSWER_UNSET]) {
				ids[item.name] = await createCard(page, item.name)
				if (item.hundredths !== null) await setOpening(page, ids[item.name], opening, item.hundredths)
			}
			await openStudentsList(page)
			const students = {}
			for (const item of [ANSWER_PAYS, ANSWER_UNSET]) students[item.name] = await balanceFacts(page, item.name)

			const today = await context.newPage()
			await setTheme(today)
			await today.goto(`${BASE}/`)
			await today.locator('#today-pays-soon').waitFor({ timeout: 30000 })
			await today.waitForTimeout(500)
			const todayDue = await today.locator('#today-pays-soon [data-slot="due-row"]').allInnerTexts()
			const todayLessons = await today
				.locator('#today-lessons [data-slot="today-row"]')
				.evaluateAll((rows) =>
					rows.map(
						(row) =>
							`${row.querySelector('[data-slot="time-main"]')?.textContent}|${row.querySelector('[data-slot="today-row-open"]')?.textContent}`
					)
				)

			const posts = []
			page.on('request', (request) => {
				if (
					request.method() === 'POST' &&
					request.url().includes('/api/chat/conversations/') &&
					request.url().endsWith('/messages')
				)
					posts.push(request.url())
			})
			const injected = []
			await page.route('**/api/chat/conversations/*/messages', async (route) => {
				if (route.request().method() !== 'POST') return route.continue()
				const blocks = injected.shift()
				if (blocks === undefined) return route.continue()
				const response = await route.fetch()
				const body = await response.json()
				const reply = body.messages.at(-1)
				await route.fulfill({
					response,
					json: { ...body, messages: [...body.messages.slice(0, -1), { ...reply, blocks }] },
				})
			})

			await openChat(page, null)
			await page.locator(FIELD).waitFor({ timeout: 30000 })
			await sendCommand(page, '/payments')
			const due = page.locator('[data-slot="due-list"]').last()
			await due.waitFor({ timeout: 30000 })
			const chatDue = await due.locator('[data-slot="due-row"]').allInnerTexts()
			check(
				'/payments shows the same Pays soon rows as Today in the other tab',
				JSON.stringify(chatDue) === JSON.stringify(todayDue) && chatDue.length > 0,
				`${chatDue.length} / ${todayDue.length}`
			)
			check(
				'the fixture card with one lesson left is in the chat list and the card without a balance is not',
				chatDue.some((row) => row.includes(ANSWER_PAYS.name)) && !chatDue.some((row) => row.includes(ANSWER_UNSET.name))
			)
			await shot(page, 'chat-answers', 'payments')

			await sendCommand(page, '/today')
			await page.getByRole('heading', { name: 'Lessons today' }).waitFor({ timeout: 30000 })
			const lessonLists = page.locator('[data-slot="chat-lessons"]')
			const chatLessons =
				(await lessonLists.count()) === 0
					? []
					: await lessonLists
							.last()
							.locator('[data-slot="chat-lesson-row"]')
							.evaluateAll((rows) =>
								rows.map(
									(row) =>
										`${row.querySelector('[data-slot="time-main"]')?.textContent}|${row.querySelector('a')?.textContent}`
								)
							)
			check(
				'/today shows the same lessons as Today in the other tab',
				JSON.stringify(chatLessons) === JSON.stringify(todayLessons.slice(0, 8)),
				`${chatLessons.length} / ${todayLessons.length}`
			)
			await shot(page, 'chat-answers', 'today')
			await sendCommand(page, '/tomorrow')
			await page.getByRole('heading', { name: 'Lessons tomorrow' }).waitFor({ timeout: 30000 })
			check(
				'/tomorrow shows one Lessons tomorrow panel',
				(await page.getByRole('heading', { name: 'Lessons tomorrow' }).count()) === 1
			)
			const conversationId = new URL(page.url()).searchParams.get('c')
			if (conversationId) conversationIds.push(conversationId)

			const factsNow = await api(page, 'GET', `/chat/records?studentId=${ids[ANSWER_PAYS.name]}`)
			injected.push([{ type: 'facts', facts: factsNow.json }])
			await page.locator(FIELD).waitFor({ timeout: 15000 })
			await sendCommand(page, '/payments')
			const group = factsGroup(page, ANSWER_PAYS.name)
			await group.waitFor({ timeout: 30000 })
			const groupText = await group.innerText()
			check(
				'a facts block in a message equals the Students row',
				groupText.includes(students[ANSWER_PAYS.name].text) &&
					(students[ANSWER_PAYS.name].dotLabel === null || groupText.includes(students[ANSWER_PAYS.name].dotLabel)),
				groupText
			)
			await shot(page, 'chat-answers', 'facts')

			injected.push([READ_BROKEN])
			await sendCommand(page, '/payments')
			await page.getByText(READ_ERROR).last().waitFor({ timeout: 30000 })
			check(
				'a failed read shows the read error block with Refresh records',
				(await page.getByRole('alert').filter({ hasText: READ_ERROR }).count()) === 1
			)
			await shot(page, 'chat-answers', 'read-error')
			const refreshed = []
			page.on('request', (request) => {
				if (request.url().includes('/api/chat/records/refresh')) refreshed.push(request.method())
			})
			await page.route('**/api/chat/records/refresh', (route) =>
				route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
			)
			const postsBeforeRefresh = posts.length
			await page.getByRole('button', { name: 'Refresh records' }).click()
			await page.getByRole('button', { name: 'Refresh records' }).waitFor({ timeout: 15000 })
			check(
				'Refresh records with a failing read keeps the error',
				(await page.getByText(READ_ERROR).count()) === 1 && refreshed.length === 1
			)
			await page.unroute('**/api/chat/records/refresh')
			await page.getByRole('button', { name: 'Refresh records' }).click()
			await page.getByText(READ_ERROR).waitFor({ state: 'detached', timeout: 30000 })
			const afterRefresh = await page
				.locator('[data-slot="due-list"]')
				.last()
				.locator('[data-slot="due-row"]')
				.allInnerTexts()
			check(
				'Refresh records after the failure shows the fresh Pays soon rows in place',
				JSON.stringify(afterRefresh) === JSON.stringify(todayDue),
				`${afterRefresh.length} / ${todayDue.length}`
			)
			check(
				'Refresh records sent no message and made no model request',
				posts.length === postsBeforeRefresh && refreshed.length === 2
			)

			injected.push([
				{
					type: 'excerpt',
					source: 'note',
					id: randomUUID(),
					studentId: ids[ANSWER_PAYS.name],
					body: EXCERPT_TEXT,
					createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
					timeZone: VN,
				},
				{ type: 'suggestions', lines: IDEA_LINES },
			])
			await sendCommand(page, '/payments')
			const excerpt = page.locator('[data-slot="chat-excerpt"]').last()
			await excerpt.waitFor({ timeout: 30000 })
			const excerptText = await excerpt.innerText()
			check(
				'an excerpt is a dated quote with its source and stored text, not a panel',
				excerptText.includes(EXCERPT_TEXT) &&
					/From notes · \w{3} \d{1,2} \w{3} · stored text/.test(excerptText) &&
					(await excerpt.locator('blockquote').count()) === 1,
				excerptText
			)
			const suggestions = page.locator('[data-slot="chat-suggestions"]').last()
			check(
				'suggestions are separate lines with the not-saved footer',
				(await suggestions.getByRole('button').count()) === IDEA_LINES.length &&
					(await suggestions.getByText("Not saved to the student's notes.").count()) === 1
			)
			await shot(page, 'chat-answers', 'excerpt')
			const notesBefore = sql(
				`select count(*)::int as n from student_notes where student_id = '${ids[ANSWER_PAYS.name]}'`
			).rows[0].n
			const postsBeforeUse = posts.length
			await suggestions.getByRole('button', { name: IDEA_LINES[0] }).click()
			check('a suggestion puts its text in the field', (await value(page)) === IDEA_LINES[0], await value(page))
			await page.waitForTimeout(500)
			check(
				'a suggestion sends nothing and writes no note',
				posts.length === postsBeforeUse &&
					sql(`select count(*)::int as n from student_notes where student_id = '${ids[ANSWER_PAYS.name]}'`).rows[0]
						.n === notesBefore
			)

			await page.setViewportSize({ width: 390, height: 800 })
			await page.waitForTimeout(300)
			const overflow = await page.evaluate(
				() => document.documentElement.scrollWidth - document.documentElement.clientWidth
			)
			check('on a phone the blocks do not overflow the page', overflow <= 0, String(overflow))
			await shot(page, 'chat-answers', 'phone')

			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		},
		() => removeConversations(conversationIds),
		removeFixtures
	)
}

const MODELS_TITLE = 'Alex Example 2221 models'
const MODEL_CHIP = '[data-slot="model-chip"]'
const EFFORT_CHIP = '[data-slot="effort-chip"]'
const MODEL_ROW = '[data-slot="model-row"]'
const ENTRY = '[data-slot="model-entry"]'
const MODELS_CARD = 'section[aria-labelledby="settings-models"]'
const GHOST_ID = 'claude-absent-1-0'

async function openModelsSettings(page) {
	await page.goto(`${BASE}/settings?tab=assistant`)
	await page.locator(MODELS_CARD).waitFor({ timeout: 30000 })
}

async function menuNames(page) {
	await page.locator(MODEL_CHIP).click()
	await page.locator(MODEL_ROW).first().waitFor({ timeout: 15000 })
	const names = await page.locator(MODEL_ROW).evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label')))
	return names
}

async function sectionModels() {
	const started = await startFakeModelApi()
	const accountId = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0].id
	const original = sql(
		`select chat_monthly_cap_usd::text as cap, chat_models as models, chat_model as model, chat_effort as effort, chat_max_input_tokens as input, chat_max_output_tokens as output from teacher_settings where account_id = '${accountId}'`
	).rows[0]
	const zone = sql(
		`select coalesce((select default_time_zone from teacher_settings where account_id = '${accountId}'), '${core.SCHEDULE_TIME_ZONE}') as zone`
	).rows[0].zone
	const startsOn = `${core.zonedParts(new Date(), zone).date.slice(0, 7)}-01`
	const period = sql(
		`select id, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where account_id = '${accountId}' and starts_on = '${startsOn}'`
	).rows[0]
	const conversations = []
	const defaults = () =>
		appSql(
			`update teacher_settings set chat_models = null, chat_model = null, chat_effort = null, chat_max_input_tokens = 100000, chat_max_output_tokens = 16000, chat_monthly_cap_usd = 10.00 where account_id = '${accountId}'`
		)
	const restore = () => {
		if (!original) return
		const json = original.models === null ? 'null' : `'${JSON.stringify(original.models).replaceAll("'", "''")}'::jsonb`
		const text = (value) => (value === null ? 'null' : `'${value}'`)
		appSql(
			`update teacher_settings set chat_models = ${json}, chat_model = ${text(original.model)}, chat_effort = ${text(original.effort)}, chat_max_input_tokens = ${original.input}, chat_max_output_tokens = ${original.output}, chat_monthly_cap_usd = ${original.cap} where account_id = '${accountId}'`
		)
	}
	try {
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, problems }) => {
				await setTheme(page)
				await signIn(page)
				defaults()
				const conversationId = appSql(
					`insert into chat_conversations (account_id, title) values ('${accountId}', '${MODELS_TITLE}') returning id`
				).rows[0].id
				conversations.push(conversationId)
				const overrideRow = () =>
					sql(
						`select model_override as model, effort_override as effort from chat_conversations where id = '${conversationId}'`
					).rows[0]

				await page.goto(`${BASE}/chat?c=${conversationId}`)
				await page.locator(MODEL_CHIP).waitFor({ timeout: 30000 })
				const names = await menuNames(page)
				check(
					'the menu shows the four models in the order of the settings',
					JSON.stringify(names) === JSON.stringify(['Haiku 5.5', 'Sonnet 5.5', 'Opus 5.5', 'Fable 5.1']),
					JSON.stringify(names)
				)
				check(
					'Default stands on the model of the teacher',
					(await page.locator(`${MODEL_ROW}[data-model="claude-haiku-5-5"]`).innerText()).includes('Default')
				)
				await shot(page, 'chat-models', 'menu')
				await page.locator(`${MODEL_ROW}[data-model="claude-sonnet-5-5"]`).click()
				await page.waitForFunction(
					(selector) => document.querySelector(selector)?.getAttribute('aria-label') === 'Model: Sonnet 5.5',
					MODEL_CHIP,
					{ timeout: 15000 }
				)
				await page.reload()
				await page.locator(MODEL_CHIP).waitFor({ timeout: 30000 })
				check(
					'the choice is kept with the conversation after a reload',
					(await page.locator(MODEL_CHIP).getAttribute('aria-label')) === 'Model: Sonnet 5.5' &&
						overrideRow().model === 'claude-sonnet-5-5'
				)
				await page.locator(MODEL_CHIP).click()
				await page.getByRole('menuitem', { name: 'Use default (Haiku 5.5)' }).click()
				await page.waitForFunction(
					(selector) => document.querySelector(selector)?.getAttribute('aria-label') === 'Model: Haiku 5.5',
					MODEL_CHIP,
					{ timeout: 15000 }
				)
				check('Use default clears the choice', overrideRow().model === null && overrideRow().effort === null)

				await openModelsSettings(page)
				const card = page.locator(MODELS_CARD)
				await card.getByRole('button', { name: 'Edit Haiku 5.5' }).click()
				const haiku = card.locator(`${ENTRY}[data-model="claude-haiku-5-5"]`)
				await haiku.getByRole('button', { name: 'Max', exact: true }).click()
				await haiku.getByRole('button', { name: 'Extra high', exact: true }).click()
				await card.getByRole('button', { name: 'Save' }).click()
				await card.getByText('Saved to your account.').waitFor({ timeout: 15000 })
				await page.goto(`${BASE}/chat?c=${conversationId}`)
				await page.locator(EFFORT_CHIP).click()
				check(
					'a level the model cannot do is dimmed and the ceiling is named',
					(await page.locator('[data-slot="effort-unavailable"]').count()) === 2 &&
						(await page.getByText('Haiku 5.5 goes up to High.').count()) === 1
				)
				await shot(page, 'chat-models', 'effort')
				await page.keyboard.press('Escape')

				await openModelsSettings(page)
				const chat = page.locator('[data-slot="chat-model-card"]')
				await chat.getByRole('combobox').first().click()
				await page.getByRole('option', { name: /^Sonnet 5\.5/ }).click()
				await page.getByText(/^Chat model: Sonnet 5\.5/).waitFor({ timeout: 15000 })
				await page.goto(`${BASE}/chat?c=${conversationId}`)
				await page.locator(MODEL_CHIP).waitFor({ timeout: 30000 })
				check(
					'the new default reaches a conversation without a choice of its own',
					(await page.locator(MODEL_CHIP).getAttribute('aria-label')) === 'Model: Sonnet 5.5'
				)

				await openModelsSettings(page)
				await card.getByLabel('Reorder Opus 5.5').focus()
				await page.keyboard.press('Space')
				await page.keyboard.press('ArrowUp')
				await page.keyboard.press('ArrowUp')
				await page.keyboard.press('Space')
				await card.getByRole('button', { name: 'Edit Opus 5.5' }).click()
				const opus = card.locator(`${ENTRY}[data-model="claude-opus-5-5"]`)
				await opus.getByLabel('Input', { exact: true }).fill('4.50')
				const output = card.locator('#settings-max-output')
				await output.fill('20000')
				const input = card.locator('#settings-max-input')
				await input.fill('150000')
				check(
					'Max input tokens above the limit shows the field text and keeps Save off',
					(await card.innerText()).includes('Enter a whole number from 1,000 to 100,000.') &&
						(await card.getByRole('button', { name: 'Save' }).isDisabled())
				)
				await input.fill('90000')
				await card.getByRole('button', { name: 'Save' }).click()
				await card.getByText('Saved to your account.').waitFor({ timeout: 15000 })
				const stored = sql(
					`select chat_models->0->>'id' as first, chat_models->0->'pricing'->>'inputPerMTok' as input, chat_max_input_tokens as max_input, chat_max_output_tokens as max_output from teacher_settings where account_id = '${accountId}'`
				).rows[0]
				check(
					'the order, the rate and the limits are stored',
					stored.first === 'claude-opus-5-5' &&
						stored.input === '4.50' &&
						Number(stored.max_input) === 90000 &&
						Number(stored.max_output) === 20000,
					JSON.stringify(stored)
				)
				await page.reload()
				await page.locator(MODELS_CARD).waitFor({ timeout: 30000 })
				check(
					'after a reload the saved values are shown',
					(await page.locator('#settings-max-output').inputValue()) === '20,000' &&
						(await page.locator(MODELS_CARD).innerText()).includes('Input $4.50')
				)
				await shot(page, 'chat-models', 'settings')

				await page.locator(MODELS_CARD).getByRole('button', { name: 'Add model' }).click()
				const form = page.locator(`${MODELS_CARD} [data-slot="model-form"]`).last()
				await form.getByLabel('Name', { exact: true }).fill('Ghost 1.0')
				await form.getByLabel('Model id', { exact: true }).fill(GHOST_ID)
				await form.getByLabel('Short description', { exact: true }).fill('Not given to this key')
				for (const label of ['Input', 'Cache write', 'Cache read', 'Output'])
					await form.getByLabel(label, { exact: true }).fill('1.00')
				await page.locator(MODELS_CARD).getByRole('button', { name: 'Save' }).click()
				await page.locator(MODELS_CARD).getByText('Saved to your account.').waitFor({ timeout: 15000 })
				check(
					'a model the provider does not give is listed as not available',
					(await page.locator(MODELS_CARD).innerText()).includes(
						'Not available with your API key. The chat menu skips it.'
					)
				)
				await page.goto(`${BASE}/chat?c=${conversationId}`)
				await page.locator(MODEL_CHIP).waitFor({ timeout: 30000 })
				await page.locator(MODEL_CHIP).click()
				await page.getByRole('menuitem', { name: 'Other models' }).hover()
				check(
					'the added model sits in Other models, dimmed and not selectable',
					(await page.locator(`${MODEL_ROW}[data-model="${GHOST_ID}"]`).count()) === 1 &&
						(await page.locator(`${MODEL_ROW}[data-model="${GHOST_ID}"]`).getAttribute('aria-disabled')) === 'true'
				)
				await page.keyboard.press('Escape')

				defaults()
				const year = Number.parseInt(startsOn.slice(0, 4), 10)
				const month = Number.parseInt(startsOn.slice(5, 7), 10)
				const endsBefore = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`
				appSql(
					`insert into chat_budget_periods (account_id, starts_on, ends_before, time_zone) values ('${accountId}', '${startsOn}', '${endsBefore}', '${zone.replaceAll("'", "''")}') on conflict (account_id, starts_on) do nothing`
				)
				const periodId = sql(
					`select id from chat_budget_periods where account_id = '${accountId}' and starts_on = '${startsOn}'`
				).rows[0].id
				sql(`update chat_budget_periods set spent_nano = 8500000000, held_nano = 0 where id = '${periodId}'`)
				await page.goto(`${BASE}/chat?c=${conversationId}`)
				const warning = page.locator('[data-slot="budget-warning"]')
				await warning.waitFor({ timeout: 30000 })
				check(
					'at 85% a line shows the share and the amounts',
					(await warning.innerText()).includes('85% of the monthly budget is used. $8.50 of $10.')
				)
				await shot(page, 'chat-models', 'warning')
				sql(`update chat_budget_periods set spent_nano = 10000000000 where id = '${periodId}'`)
				await page.reload()
				await page.locator('[data-slot="budget-reached"]').waitFor({ timeout: 30000 })
				check(
					'at 100% the banner shows and the field, the chips and Send are off',
					(await page.locator(FIELD).isDisabled()) &&
						(await page.locator(MODEL_CHIP).isDisabled()) &&
						(await page.locator(SEND).isDisabled())
				)
				await shot(page, 'chat-models', 'reached')
				await page.goto(`${BASE}/students`)
				await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
				check(
					'the rest of the app keeps working at the cap',
					(await page.getByRole('heading', { name: 'Students', level: 1 }).isVisible()) &&
						(await page.locator(MODEL_CHIP).count()) === 0
				)

				sql(`update chat_budget_periods set spent_nano = 0, held_nano = 0 where id = '${periodId}'`)
				await page.setViewportSize({ width: 375, height: 800 })
				await page.goto(`${BASE}/chat?c=${conversationId}`)
				await page.locator(SEND).waitFor({ timeout: 30000 })
				const box = await page.locator(SEND).boundingBox()
				check('on 375px Send stays inside the screen', box !== null && box.x + box.width <= 375, JSON.stringify(box))
				check(
					'on 375px the effort chip keeps only its meter',
					(await page.locator(`${EFFORT_CHIP} span.sr-only, ${EFFORT_CHIP} span[class*="sr-only"]`).count()) >= 1
				)
				await shot(page, 'chat-models', 'phone')

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeConversations(conversations),
			() => {
				if (period)
					sql(
						`update chat_budget_periods set spent_nano = ${period.spent}, held_nano = ${period.held} where id = '${period.id}'`
					)
				else sql(`delete from chat_budget_periods where account_id = '${accountId}' and starts_on = '${startsOn}'`)
			},
			restore
		)
	} finally {
		await stopFakeModelApi(started)
	}
}

const DELETE_BLOCKED = 'This chat has an unconfirmed request or usage record. Check its status before deleting.'

async function sectionDelete() {
	const started = await startFakeModelApi()
	const conversations = []
	const teacher = sql(`select id from accounts where role = 'teacher' and status = 'active'`).rows[0]?.id
	const period = teacher
		? sql(
				`select id, spent_nano::text as spent, held_nano::text as held from chat_budget_periods where account_id = '${teacher}' order by starts_on desc limit 1`
			).rows[0]
		: undefined
	try {
		await withBrowser(
			{ width: 1280, height: 800 },
			async ({ page, browser, problems }) => {
				await setTheme(page)
				await signIn(page)
				await openChat(page, null)
				const field = page.locator(FIELD)
				await field.waitFor({ timeout: 30000 })
				await field.click()
				await page.keyboard.type('Plan the next lesson for my group')
				await page.keyboard.press('Enter')
				await page.getByText(FAKE_LAST).waitFor({ timeout: 30000 })
				await page.locator(SEND).waitFor({ timeout: 15000 })
				const id = new URL(page.url()).searchParams.get('c')
				if (id) conversations.push(id)
				check('a conversation with a finished reply exists', id !== null)
				const facts = () =>
					sql(
						`select (select count(*)::int from chat_messages where conversation_id = '${id}') as messages,
							(select count(*)::int from chat_messages where conversation_id = '${id}' and redacted_at is not null and body = '' and mentions = '[]'::jsonb and blocks = '[]'::jsonb) as redacted,
							(select count(*)::int from chat_turns where conversation_id = '${id}') as turns,
							(select deleted_at is not null from chat_conversations where id = '${id}') as deleted`
					).rows[0]
				const before = facts()

				await openList(page)
				await rowOf(page, id).waitFor({ timeout: 15000 })
				await openRowMenu(page, id, 'Delete conversation')
				const confirm = page.getByRole('dialog', { name: 'Delete this conversation?' })
				await confirm.waitFor({ timeout: 15000 })
				await page.route('**/api/chat/conversations/*', (route) =>
					route.request().method() === 'DELETE'
						? route.fulfill({
								status: 409,
								json: { error: { code: 'busy', message: 'The conversation has unfinished work' } },
							})
						: route.fallback()
				)
				await confirm.getByRole('button', { name: 'Delete conversation' }).click()
				await confirm.getByText(DELETE_BLOCKED).waitFor({ timeout: 15000 })
				check(
					'a refused delete shows the unconfirmed request text, keeps the dialog and the chat',
					(await confirm.getByText(DELETE_ERROR).count()) === 0 && (await rowOf(page, id).count()) === 1
				)
				await shot(page, 'chat-delete', 'blocked')
				await page.unroute('**/api/chat/conversations/*')
				await page.route('**/api/chat/conversations/*', (route) =>
					route.request().method() === 'DELETE' ? route.fulfill({ status: 500, json: SERVER_ERROR }) : route.fallback()
				)
				await confirm.getByRole('button', { name: 'Delete conversation' }).click()
				await confirm.getByText(DELETE_ERROR).waitFor({ timeout: 15000 })
				check(
					'a server failure after that shows the general text again',
					(await confirm.getByText(DELETE_BLOCKED).count()) === 0
				)
				await page.unroute('**/api/chat/conversations/*')
				check('nothing was erased by the refused deletes', JSON.stringify(facts()) === JSON.stringify(before))

				await confirm.getByRole('button', { name: 'Delete conversation' }).click()
				await confirm.waitFor({ state: 'detached', timeout: 15000 })
				await page.waitForTimeout(300)
				check('the deleted conversation leaves the list', (await rowOf(page, id).count()) === 0)
				const focused = await page.evaluate(() => {
					const node = document.activeElement
					return node instanceof HTMLElement && node.hasAttribute('data-all-chats') && node.offsetParent !== null
				})
				check('after a delete the focus is on All chats', focused)
				const after = facts()
				check(
					'the rows stay and every message is erased',
					after.deleted === true &&
						after.messages === before.messages &&
						after.redacted === before.messages &&
						after.turns === before.turns,
					JSON.stringify(after)
				)
				await shot(page, 'chat-delete', 'deleted')

				const visitor = await browser.newContext({ colorScheme: theme })
				const policy = await visitor.newPage()
				const response = await policy.goto(`${BASE}/privacy`)
				await policy.getByRole('heading', { level: 2, name: 'Chat assistant', exact: true }).waitFor({ timeout: 30000 })
				const text = await policy.locator('main').innerText()
				check(
					'the privacy page opens without a sign-in and describes the chat',
					response?.status() === 200 && new URL(policy.url()).pathname === '/privacy' && text.includes('Anthropic')
				)
				check(
					'the privacy page holds no key and no student name',
					!/sk-ant|Alex Example/.test(text) && !text.includes('Plan the next lesson for my group')
				)
				await shot(policy, 'chat-delete', 'privacy')
				await visitor.close()

				const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
				check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
			},
			() => removeConversations(conversations),
			() => {
				if (period)
					sql(
						`update chat_budget_periods set spent_nano = ${period.spent}, held_nano = ${period.held} where id = '${period.id}'`
					)
			}
		)
	} finally {
		await stopFakeModelApi(started)
	}
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
