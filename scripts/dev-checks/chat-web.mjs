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

const sections = {
	records: sectionRecords,
	conversations: sectionConversations,
	notes: sectionNotes,
	comments: sectionComments,
	composer: sectionComposer,
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
				await route.continue()
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

			await page.keyboard.press('Enter')
			check(
				'Enter without the list adds no line and sends nothing',
				!(await value(page)).includes('\n') && writes.length === 0
			)
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
