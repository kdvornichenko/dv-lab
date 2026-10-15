import { BASE, api, check, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'
import { removeStudentCards } from './fixture-cleanup.mjs'
import { createCard } from './ledger-web/common.mjs'

const PREFIX = 'Alex Example 257'
const EXPECTED_NOISE =
	/status of 500|Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/
const STANDARD = ['General info', 'Interests', 'Level', 'Goals', 'Typical mistakes', 'Lesson ideas']

const sections = { blocks: sectionBlocks, order: sectionOrder, vocabulary: sectionVocabulary, review: sectionReview }

function removeFixtures() {
	const removed = removeStudentCards(sql, `display_name like '${PREFIX}%' and import_key is null`)
	console.log(`fixture cards removed ${removed}`)
}

function setTheme(page) {
	return page.addInitScript((value) => {
		try {
			localStorage.setItem('theme', value)
		} catch {}
	}, theme)
}

const blockOf = (page, key) => page.locator(`section[data-block-key="${key}"]`)
const titles = (page) => page.locator('section[data-block-key] h2').allInnerTexts()
const stored = (id) =>
	sql(
		`select id, kind, name, position, revision, body, deleted_at is not null as deleted from student_sections where student_id = '${id}' order by position nulls last, kind`
	).rows
const liveNames = (id) =>
	stored(id)
		.filter((row) => !row.deleted)
		.map((row) => row.name)

async function openNotes(page, id, query = '') {
	await page.goto(`${BASE}/students/${id}?tab=notes${query}`)
	await blockOf(page, 'general_info').waitFor({ timeout: 30000 })
}

async function openMenu(page, name) {
	await page.getByRole('button', { name: `More actions for ${name}` }).click()
	await page.getByRole('menuitem').first().waitFor({ timeout: 5000 })
}

async function pickMenu(page, name, item) {
	await openMenu(page, name)
	await page.getByRole('menuitem', { name: item, exact: true }).click()
}

async function sectionBlocks(page, problems) {
	const id = await createCard(page, `${PREFIX}0`)
	await openNotes(page, id)
	const list = await titles(page)
	check(
		'a new card shows the six standard blocks in order',
		JSON.stringify(list) === JSON.stringify(STANDARD),
		list.join(' | ')
	)
	check(
		'an empty block is not hidden and says No text yet.',
		(await page.getByText('No text yet.', { exact: true }).count()) === 6
	)
	check(
		'every block has a named Edit button',
		(await page.getByRole('button', { name: 'Edit', exact: true }).count()) === 6
	)
	check('Add block is real and enabled', await page.getByRole('button', { name: 'Add block' }).isEnabled())
	check(
		'the old fixed Save section line is gone',
		(await page.getByText('Notes added later are listed under the section').count()) === 0
	)
	await shot(page, 'notes-blocks', 'list')

	const goals = blockOf(page, 'goals')
	await goals.getByRole('button', { name: 'Edit' }).click()
	const area = goals.getByRole('textbox', { name: 'Goals' })
	check(
		'Edit opens the editor with the Markdown line, Cancel and Save',
		(await goals.getByText('Markdown is supported.').count()) === 1
	)
	await area.fill('First goals text')
	const saving = page.waitForRequest((request) => request.method() === 'PUT' && request.url().includes('/blocks/'))
	await goals.getByRole('button', { name: 'Save', exact: true }).click()
	const request = await saving
	const sent = JSON.parse(request.postData() ?? '{}')
	check(
		'saving sends the text with the block revision',
		sent.body === 'First goals text' && sent.expectedRevision === 1,
		request.postData()
	)
	await goals.getByText('First goals text').waitFor({ timeout: 15000 })
	const row = stored(id).find((item) => item.kind === 'goals')
	check(
		'the text and revision 2 are stored',
		row.body === 'First goals text' && row.revision === 2,
		JSON.stringify(row)
	)

	await goals.getByRole('button', { name: 'Edit' }).click()
	await area.fill('My draft that must stay')
	const other = await api(page, 'PUT', `/students/${id}/blocks/${row.id}`, {
		body: 'Text from another tab',
		expectedRevision: 2,
	})
	check('the second-tab write succeeds', other.status === 200, String(other.status))
	await goals.getByRole('button', { name: 'Save', exact: true }).click()
	await goals
		.getByText('This block changed elsewhere. Your draft has been kept. Reload the current text before saving.')
		.waitFor({ timeout: 15000 })
	check(
		'a competing edit keeps the draft, turns Save off and offers Reload block',
		(await area.inputValue()) === 'My draft that must stay' &&
			(await goals.getByRole('button', { name: 'Save', exact: true }).isDisabled()) &&
			(await goals.getByRole('button', { name: 'Reload block' }).count()) === 1
	)
	await shot(page, 'notes-blocks', 'conflict')
	check(
		'nothing was overwritten on the server',
		stored(id).find((item) => item.kind === 'goals').body === 'Text from another tab'
	)
	await goals.getByRole('button', { name: 'Reload block' }).click()
	await page.waitForFunction(
		() => document.querySelector('section[data-block-key="goals"] textarea')?.value === 'Text from another tab',
		null,
		{ timeout: 15000 }
	)
	check('Reload block replaces the draft with the current text', (await area.inputValue()) === 'Text from another tab')
	check('after the reload Save is on again', await goals.getByRole('button', { name: 'Save', exact: true }).isEnabled())
	await area.fill('Text after reload')
	await goals.getByRole('button', { name: 'Save', exact: true }).click()
	await goals.getByText('Text after reload').waitFor({ timeout: 15000 })
	check('saving after the reload works', stored(id).find((item) => item.kind === 'goals').revision === 4)

	sql(
		`insert into student_notes (student_id, section_kind, body, created_at) values ('${id}', 'interests', 'Legacy entry text', now() - interval '1 day')`
	)
	await page.reload()
	await blockOf(page, 'interests').waitFor({ timeout: 30000 })
	await blockOf(page, 'interests').getByText('Legacy entry text').waitFor({ timeout: 15000 })
	check(
		'an old Added note shows under its block with Remove, and not under others',
		(await blockOf(page, 'interests').getByText('Added notes', { exact: true }).count()) === 1 &&
			(await blockOf(page, 'interests')
				.getByRole('button', { name: /^Remove note from / })
				.count()) === 1 &&
			(await blockOf(page, 'level').getByText('Added notes').count()) === 0
	)

	const created = await api(page, 'POST', `/students/${id}/blocks`, {
		name: 'Exam dates',
		body: 'Writing exam in November',
	})
	check('a block of the teacher is created', created.status === 201, String(created.status))
	const key = created.json.block.key
	check('its key has the b_ form', /^b_[0-9a-f]{32}$/.test(key), key)
	await page.goto(`${BASE}/students/${id}?tab=notes&section=${key}`)
	await blockOf(page, key).waitFor({ timeout: 30000 })
	check(
		'the deep link opens Notes and shows the custom block',
		(await blockOf(page, key).getByText('Writing exam in November').count()) === 1
	)
	await page.waitForFunction(
		(blockKey) => (document.getElementById(`section-${blockKey}`)?.style.boxShadow ?? '') !== '',
		key,
		{ timeout: 8000 }
	)
	check('the custom block carries the arrival highlight', true)
	check('the arrival parameter leaves the address', !page.url().includes('section='), page.url())
	await shot(page, 'notes-blocks', 'arrival')

	await page.goto(`${BASE}/students/${id}?tab=overview`)
	const recent = page
		.locator('[data-slot="overview-recent"][data-kind="note"]')
		.filter({ hasText: 'Writing exam in November' })
	await recent.waitFor({ timeout: 30000 })
	await recent.click()
	await blockOf(page, key).waitFor({ timeout: 30000 })
	await page.waitForFunction(
		(blockKey) => (document.getElementById(`section-${blockKey}`)?.style.boxShadow ?? '') !== '',
		key,
		{ timeout: 8000 }
	)
	check('a note of a custom block in Recent opens Notes with that block highlighted', true)

	await page.goto(`${BASE}/students/${id}?tab=notes&section=goals`)
	await blockOf(page, 'goals').waitFor({ timeout: 30000 })
	await page.waitForFunction(() => (document.getElementById('section-goals')?.style.boxShadow ?? '') !== '', null, {
		timeout: 8000,
	})
	check('a standard block deep link is highlighted too', true)

	await page.goto(`${BASE}/students/${id}?tab=notes&section=b_00000000000000000000000000000000`)
	await blockOf(page, 'goals').waitFor({ timeout: 30000 })
	await page.waitForTimeout(1500)
	check('an unknown block key opens Notes quietly without highlight', !page.url().includes('section='))

	await page.route('**/api/students/*/blocks', (route) =>
		route.request().method() === 'GET'
			? route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
			: route.continue()
	)
	await page.reload()
	await page.getByRole('button', { name: 'Refresh records' }).waitFor({ timeout: 30000 })
	check(
		'a failed read gives the profile panel with Refresh records',
		(await page.getByText('Could not read these records.').count()) === 1 &&
			(await page.getByText('Refresh before continuing.').count()) === 1 &&
			(await page.getByRole('tab', { name: 'Notes' }).count()) === 1
	)
	await shot(page, 'notes-blocks', 'read-error')
	await page.unroute('**/api/students/*/blocks')
	await page.getByRole('button', { name: 'Refresh records' }).click()
	await blockOf(page, 'general_info').waitFor({ timeout: 30000 })
	check('Refresh after the failure shows the blocks', true)

	await page.route('**/api/students/*/blocks', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 1500))
		await route.continue().catch(() => {})
	})
	await page.reload()
	await page.getByRole('tab', { name: 'Notes', exact: true }).click()
	await page.locator('[data-slot="notes-loading"]').waitFor({ timeout: 10000 })
	check(
		'the skeleton has a real disabled Add block, three blocks with a real disabled Edit and no fixed titles',
		(await page.getByRole('button', { name: 'Add block' }).isDisabled()) &&
			(await page.locator('[data-slot="notes-loading"]').getByRole('button', { name: 'Edit' }).count()) === 3 &&
			(await page.getByRole('heading', { name: 'General info' }).count()) === 0
	)
	await shot(page, 'notes-blocks', 'loading')
	await page.unroute('**/api/students/*/blocks')
	await blockOf(page, 'general_info').waitFor({ timeout: 30000 })

	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

async function sectionOrder(page, problems) {
	const id = await createCard(page, `${PREFIX}1`)
	await openNotes(page, id)

	await page.getByRole('button', { name: 'Add block' }).click()
	const fresh = page.locator('section[aria-label="New block"]')
	await fresh.waitFor({ timeout: 10000 })
	check(
		'Add block opens a new block at the end with the name field focused and Save off',
		(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))) === 'Block name' &&
			(await fresh.getByRole('button', { name: 'Save', exact: true }).isDisabled()) &&
			(await fresh.getByPlaceholder('Write notes in Markdown.').count()) === 1
	)
	check('Add block waits while a new block is open', await page.getByRole('button', { name: 'Add block' }).isDisabled())
	await page.waitForTimeout(800)
	await shot(page, 'notes-order', 'new')
	await fresh.getByRole('textbox', { name: 'Block name' }).fill('goals')
	await fresh.getByRole('button', { name: 'Save', exact: true }).click()
	await fresh.getByText('A block with this name already exists.').waitFor({ timeout: 15000 })
	check('a taken name is refused under the field and nothing is saved', liveNames(id).length === 6)
	await fresh.getByRole('textbox', { name: 'Block name' }).fill('Exam dates')
	await fresh.getByRole('textbox', { name: 'Block text' }).fill('Writing exam in November')
	await fresh.getByRole('button', { name: 'Save', exact: true }).click()
	await blockOf(page, 'general_info').waitFor({ timeout: 15000 })
	await page.locator('section[data-block-key^="b_"]').first().waitFor({ timeout: 15000 })
	check(
		'the new block is saved at the end',
		JSON.stringify(await titles(page)) === JSON.stringify([...STANDARD, 'Exam dates']) &&
			JSON.stringify(liveNames(id)) === JSON.stringify([...STANDARD, 'Exam dates']),
		(await titles(page)).join(' | ')
	)
	await page.getByRole('button', { name: 'Add block' }).click()
	await fresh.waitFor({ timeout: 10000 })
	await fresh.getByRole('button', { name: 'Cancel' }).click()
	await fresh.waitFor({ state: 'detached', timeout: 10000 })
	check('Cancel on a new block saves nothing', liveNames(id).length === 7)

	const custom = page.locator('section[data-block-key^="b_"]')
	const customKey = await custom.first().getAttribute('data-block-key')
	await pickMenu(page, 'Exam dates', 'Rename')
	const renameInput = page.getByRole('textbox', { name: 'Block name' })
	await renameInput.waitFor({ timeout: 5000 })
	check(
		'Rename turns the name into a field with the hint line',
		(await page.getByText('Enter to save, Esc to cancel.').count()) === 1 &&
			(await renameInput.getAttribute('maxlength')) === '60'
	)
	await renameInput.fill('')
	await renameInput.press('Enter')
	await page.getByText('Enter a name.').waitFor({ timeout: 5000 })
	await renameInput.fill('LEVEL')
	await renameInput.press('Enter')
	await page.getByText('A block with this name already exists.').waitFor({ timeout: 15000 })
	check('an empty and a taken name are refused under the field', liveNames(id).includes('Exam dates'))
	await renameInput.press('Escape')
	check('Esc restores the old name', (await blockOf(page, customKey).locator('h2').innerText()) === 'Exam dates')
	await pickMenu(page, 'Exam dates', 'Rename')
	await page.getByRole('textbox', { name: 'Block name' }).fill('Exam schedule')
	await page.getByRole('textbox', { name: 'Block name' }).press('Enter')
	await page.getByRole('heading', { name: 'Exam schedule' }).waitFor({ timeout: 15000 })
	check('Enter saves the new name', liveNames(id).includes('Exam schedule'))
	await pickMenu(page, 'Level', 'Rename')
	await page.getByRole('textbox', { name: 'Block name' }).fill('CEFR level')
	await page.getByRole('textbox', { name: 'Block name' }).press('Enter')
	await page.getByRole('heading', { name: 'CEFR level' }).waitFor({ timeout: 15000 })
	check(
		'a standard block renames like any other and keeps its key',
		stored(id).some((row) => row.kind === 'level' && row.name === 'CEFR level')
	)

	await pickMenu(page, 'Interests', 'Delete block')
	await page.getByText('Block deleted').first().waitFor({ timeout: 15000 })
	check(
		'an empty block is deleted at once with a toast and no dialog',
		(await page.getByRole('dialog').count()) === 0 &&
			stored(id).find((row) => row.kind === 'interests').deleted === true &&
			(await titles(page)).length === 6
	)
	await pickMenu(page, 'Exam schedule', 'Delete block')
	const dialog = page.getByRole('dialog', { name: 'Delete this block?' })
	await dialog.waitFor({ timeout: 10000 })
	check(
		'a block with text asks first and focuses Keep block',
		(await dialog.getByText('“Exam schedule” and its text will be deleted. This cannot be undone.').count()) === 1 &&
			(await page.evaluate(() => document.activeElement?.textContent?.trim())) === 'Keep block'
	)
	await shot(page, 'notes-order', 'delete')
	await dialog.getByRole('button', { name: 'Keep block' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	check('Keep block deletes nothing', liveNames(id).includes('Exam schedule'))
	await pickMenu(page, 'Exam schedule', 'Delete block')
	await dialog.getByRole('button', { name: 'Delete block' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 15000 })
	await page.waitForFunction(() => document.querySelectorAll('section[data-block-key^="b_"]').length === 0, null, {
		timeout: 15000,
	})
	check('Delete block removes the block with text', !liveNames(id).includes('Exam schedule'))
	check(
		'the remaining blocks keep their order',
		JSON.stringify(await titles(page)) ===
			JSON.stringify(['General info', 'CEFR level', 'Goals', 'Typical mistakes', 'Lesson ideas']),
		(await titles(page)).join(' | ')
	)
	await shot(page, 'notes-order', 'list')

	const before = await titles(page)
	await pickMenu(page, before[0], 'Move down')
	await page.waitForFunction(
		(first) => document.querySelector('section[data-block-key] h2')?.textContent !== first,
		before[0],
		{ timeout: 15000 }
	)
	const afterMenu = await titles(page)
	check(
		'Move down in the menu swaps the first two blocks',
		afterMenu[0] === before[1] && afterMenu[1] === before[0],
		afterMenu.join(' | ')
	)
	check(
		'the menu move is saved',
		JSON.stringify(liveNames(id)) === JSON.stringify(afterMenu),
		liveNames(id).join(' | ')
	)
	await page.getByRole('button', { name: `More actions for ${afterMenu[0]}` }).click()
	check(
		'Move up is off on the first block',
		(await page
			.getByRole('menuitem', { name: 'Move up', exact: true })
			.evaluate((node) => getComputedStyle(node).opacity)) === '0.5'
	)
	await page.keyboard.press('Escape')

	const handles = page.locator('[data-slot="block-handle"]')
	const second = handles.nth(1)
	const secondName = afterMenu[1]
	await second.focus()
	await page.keyboard.press('Space')
	await page.keyboard.press('ArrowDown')
	check(
		'Space lifts and the arrow key moves the block, announced politely',
		(await page.locator('p[role="status"].sr-only').innerText()).includes(`${secondName}, position 3 of`)
	)
	await page.keyboard.press('Space')
	await page.waitForFunction(
		(name) => document.querySelectorAll('section[data-block-key] h2')[2]?.textContent === name,
		secondName,
		{ timeout: 15000 }
	)
	check('dropping with Space saves the new order', JSON.stringify(liveNames(id)) === JSON.stringify(await titles(page)))
	await page.waitForFunction(
		(name) =>
			document.querySelector('p[role="status"].sr-only')?.textContent?.includes(`${name} moved to position 3 of`),
		secondName,
		{ timeout: 10000 }
	)
	check('the saved move is announced', true)

	const third = handles.nth(2)
	const thirdName = (await titles(page))[2]
	await third.focus()
	await page.keyboard.press('Space')
	await page.keyboard.press('ArrowUp')
	await page.keyboard.press('Escape')
	check('Esc cancels a lift and saves nothing', (await titles(page))[2] === thirdName && liveNames(id)[2] === thirdName)

	const box = await handles.nth(0).boundingBox()
	const target = await handles.nth(2).boundingBox()
	const movedName = (await titles(page))[0]
	if (box && target) {
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
		await page.mouse.down()
		const steps = 12
		for (let step = 1; step <= steps; step++) {
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + ((target.y - box.y + 60) * step) / steps)
			await page.waitForTimeout(20)
		}
		await page.mouse.up()
		await page.waitForTimeout(1200)
		const dragged = await titles(page)
		check(
			'dragging the handle moves the block and saves the order',
			dragged[0] !== movedName && JSON.stringify(liveNames(id)) === JSON.stringify(dragged),
			dragged.join(' | ')
		)
	}

	const orderNow = await titles(page)
	await page.route('**/api/students/*/blocks/order', (route) =>
		route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
	)
	await pickMenu(page, orderNow[0], 'Move down')
	await page.getByText('Could not save the order. The list is back as it was.').first().waitFor({ timeout: 15000 })
	check(
		'a failed order save returns the list and shows a warning with Try again',
		JSON.stringify(await titles(page)) === JSON.stringify(orderNow) &&
			(await page.getByRole('button', { name: 'Try again' }).count()) === 1
	)
	await page.waitForTimeout(800)
	await shot(page, 'notes-order', 'failed')
	await page.unroute('**/api/students/*/blocks/order')
	await page.getByRole('button', { name: 'Try again' }).click()
	await page.waitForFunction(
		(name) => document.querySelector('section[data-block-key] h2')?.textContent === name,
		orderNow[1],
		{ timeout: 15000 }
	)
	await page.waitForTimeout(500)
	const retried = await titles(page)
	check(
		'Try again saves the order that failed',
		retried[0] === orderNow[1] && JSON.stringify(liveNames(id)) === JSON.stringify(retried),
		retried.join(' | ')
	)

	await page.reload()
	await blockOf(page, 'goals').waitFor({ timeout: 30000 })
	check('the order survives a reload', JSON.stringify(await titles(page)) === JSON.stringify(retried))

	await page.setViewportSize({ width: 375, height: 800 })
	await page.reload()
	await blockOf(page, 'goals').waitFor({ timeout: 30000 })
	check(
		'at 375 px there is no handle',
		(await handles
			.first()
			.isVisible()
			.catch(() => false)) === false
	)
	const phone = await titles(page)
	await pickMenu(page, phone[1], 'Move up')
	await page.waitForFunction(
		(name) => document.querySelector('section[data-block-key] h2')?.textContent === name,
		phone[1],
		{ timeout: 15000 }
	)
	check('at 375 px the menu moves a block', liveNames(id)[0] === phone[1])
	check(
		'at 375 px the page does not scroll sideways',
		await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
	)
	await shot(page, 'notes-order', 'phone')

	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

const termRows = (page, area) => page.locator(`[data-slot="vocabulary-${area}"] li[data-slot="vocabulary-row"]`)
const termNames = (page, area) =>
	termRows(page, area).evaluateAll((rows) => rows.map((row) => row.querySelector('span')?.textContent ?? ''))
const termRow = (page, name, area) => termRows(page, area).filter({ has: page.getByText(name, { exact: true }) })
const tabNamed = (page, name) => page.getByRole('tab', { name, exact: true })

async function openVocabulary(page, id, count) {
	await page.goto(`${BASE}/students/${id}?tab=vocabulary`)
	await tabNamed(page, `Words ${count}`).waitFor({ timeout: 30000 })
}

function termsSql(id) {
	return sql(
		`insert into student_terms (student_id, term, note, added_by, created_at, removed_at, removed_by) values
		('${id}', 'alpha', 'first meaning', null, now() - interval '5 days', null, null),
		('${id}', 'bravo', 'second meaning', 'chat', now() - interval '2 days', null, null),
		('${id}', 'charlie', null, 'review', now() - interval '1 day', null, null),
		('${id}', 'delta', 'fourth meaning', 'chat', now() - interval '9 days', now() - interval '3 days', 'chat'),
		('${id}', 'echo', 'fifth meaning', null, now() - interval '8 days', now() - interval '1 day', 'review')`
	)
}

const removedAtOf = (id, term) =>
	sql(`select removed_at is not null as removed from student_terms where student_id = '${id}' and term = '${term}'`)
		.rows[0]?.removed

async function sectionVocabulary(page, problems) {
	const id = await createCard(page, `${PREFIX}3`)
	termsSql(id)
	await openVocabulary(page, id, 3)
	check('the views are Words 3 and Removed 2', await tabNamed(page, 'Removed 2').isVisible())
	const names = await termNames(page, 'words')
	check(
		'words are listed newest first',
		JSON.stringify(names) === JSON.stringify(['charlie', 'bravo', 'alpha']),
		names.join(' | ')
	)
	check(
		'a word added by review says Added by review',
		(await termRow(page, 'charlie', 'words').innerText()).includes('Added by review')
	)
	check(
		'a word added in chat says Added in chat',
		(await termRow(page, 'bravo', 'words').innerText()).includes('Added in chat')
	)
	check(
		'a word the teacher typed has the date only',
		!/Added (in|by)/.test(await termRow(page, 'alpha', 'words').innerText())
	)
	check(
		'the meaning is shown next to the word',
		(await termRow(page, 'alpha', 'words').innerText()).includes('first meaning')
	)
	check(
		'Edit note and Delete stay on every word',
		(await page.getByRole('button', { name: /^Edit note for / }).count()) === 3 &&
			(await page.getByRole('button', { name: /^Delete / }).count()) === 3
	)
	check('Add term stays next to the stamp', await page.getByRole('button', { name: 'Add term' }).isVisible())
	await page.waitForTimeout(400)
	await shot(page, 'notes-vocabulary', 'words')

	await tabNamed(page, 'Removed 2').click()
	await termRows(page, 'removed').first().waitFor({ timeout: 10000 })
	const removed = await termNames(page, 'removed')
	check(
		'removed words are listed newest first',
		JSON.stringify(removed) === JSON.stringify(['echo', 'delta']),
		removed.join(' | ')
	)
	check(
		'a word removed by review says so',
		(await termRow(page, 'echo', 'removed').innerText()).includes('Removed by review')
	)
	check(
		'a word removed in chat says so',
		(await termRow(page, 'delta', 'removed').innerText()).includes('Removed in chat')
	)
	check(
		'every removed word has Restore and no Edit or Delete',
		(await page.getByRole('button', { name: /^Restore / }).count()) === 2 &&
			(await page.getByRole('button', { name: /^Edit note for / }).count()) === 0
	)
	await page.waitForTimeout(400)
	await shot(page, 'notes-vocabulary', 'removed')

	await page.route('**/api/students/*/terms/*/restore', (route) =>
		route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
	)
	await page.getByRole('button', { name: 'Restore delta' }).click()
	await page.getByText('Could not restore the word. Try again.').waitFor({ timeout: 10000 })
	check(
		'a failed Restore keeps the row and says why in it',
		(await termRow(page, 'delta', 'removed').count()) === 1 && removedAtOf(id, 'delta') === true
	)
	await page.unroute('**/api/students/*/terms/*/restore')

	await page.getByRole('button', { name: 'Restore echo' }).click()
	await tabNamed(page, 'Removed 1').waitFor({ timeout: 10000 })
	check('Restore returns the word at once: Words 4, Removed 1', await tabNamed(page, 'Words 4').isVisible())
	check('Restore clears the removal in the database', removedAtOf(id, 'echo') === false)
	check('the row leaves Removed', (await termRow(page, 'echo', 'removed').count()) === 0)
	check(
		'focus moves to the next Restore',
		await page.evaluate(() => document.activeElement?.textContent?.includes('Restore') === true)
	)
	await tabNamed(page, 'Words 4').click()
	await termRows(page, 'words').first().waitFor({ timeout: 10000 })
	const four = await termNames(page, 'words')
	check(
		'the restored word is back in Words in its place',
		JSON.stringify(four) === JSON.stringify(['charlie', 'bravo', 'alpha', 'echo']),
		four.join(' | ')
	)

	await tabNamed(page, 'Removed 1').click()
	await page.getByRole('button', { name: 'Restore delta' }).click()
	await page.getByText('Nothing removed', { exact: true }).waitFor({ timeout: 10000 })
	check(
		'an empty Removed says what is missing',
		await page.getByText('Words the assistant removes stay here for 30 days.').isVisible()
	)
	check('the last Restore leaves Words 5, Removed 0', await tabNamed(page, 'Words 5').isVisible())
	check(
		'focus returns to the Removed view when the list empties',
		await page.evaluate(() => document.activeElement?.getAttribute('role') === 'tab')
	)
	await page.reload()
	await tabNamed(page, 'Words 5').waitFor({ timeout: 30000 })
	check('the restored words survive a reload', removedAtOf(id, 'delta') === false)

	await tabNamed(page, 'Removed 0').click()
	await page.getByRole('button', { name: 'Add term' }).click()
	await page.getByLabel('Term', { exact: true }).fill('zulu')
	await page.getByLabel('Note (optional)').fill('last meaning')
	await page.getByRole('button', { name: 'Add term' }).last().click()
	await tabNamed(page, 'Words 6').waitFor({ timeout: 10000 })
	check(
		'adding a word switches to Words and shows it first without a source line',
		(await tabNamed(page, 'Words 6').getAttribute('aria-selected')) === 'true' &&
			(await termNames(page, 'words'))[0] === 'zulu' &&
			!/Added (in|by)/.test(await termRow(page, 'zulu', 'words').innerText())
	)
	await page.getByRole('button', { name: 'Delete zulu' }).click()
	await page.getByRole('button', { name: 'Delete term' }).click()
	await tabNamed(page, 'Words 5').waitFor({ timeout: 10000 })
	check('deleting a word of the teacher removes it for good', removedAtOf(id, 'zulu') === undefined)

	const empty = await createCard(page, `${PREFIX}4`)
	await openVocabulary(page, empty, 0)
	check('an empty Words says No words yet', await page.getByText('No words yet', { exact: true }).isVisible())
	check(
		'an empty Words points to the chat',
		await page.getByText('Ask the assistant in the chat to add the words from a lesson.').isVisible()
	)
	await tabNamed(page, 'Removed 0').click()
	check('an empty Removed says Nothing removed', await page.getByText('Nothing removed', { exact: true }).isVisible())

	await page.route('**/api/students/*/terms*', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 2500))
		await route.continue().catch(() => {})
	})
	await page.goto(`${BASE}/students/${empty}?tab=vocabulary`)
	await page.locator('[data-slot="vocabulary-loading"]').first().waitFor({ timeout: 10000 })
	check(
		'while loading the tabs are real and the stamp is a shape',
		(await tabNamed(page, 'Words …').isVisible()) &&
			(await tabNamed(page, 'Removed …').isVisible()) &&
			(await page.locator('[data-slot="review-stamp-loading"]').count()) === 1
	)
	await shot(page, 'notes-vocabulary', 'loading')
	await page.unroute('**/api/students/*/terms*')
	await tabNamed(page, 'Words 0').waitFor({ timeout: 30000 })

	await page.route('**/api/students/*/terms*', (route) =>
		route.fulfill({ status: 500, json: { error: { code: 'internal_error', message: 'Internal Server Error' } } })
	)
	await page.reload()
	await page.getByText('Could not read these records.').waitFor({ timeout: 15000 })
	check(
		'a read error is the profile panel with Refresh records',
		(await page.getByRole('button', { name: 'Refresh records' }).isVisible()) &&
			(await page.getByText('Refresh before continuing.').count()) === 1
	)
	await page.unroute('**/api/students/*/terms*')
	await page.getByRole('button', { name: 'Refresh records' }).click()
	await tabNamed(page, 'Words 0').waitFor({ timeout: 30000 })
	check('Refresh reads the words again', true)

	await page.setViewportSize({ width: 375, height: 800 })
	await openVocabulary(page, id, 5)
	check('at 375 px the column head is gone', !(await page.locator('[data-slot="vocabulary-head"]').isVisible()))
	const first = termRow(page, 'bravo', 'words')
	const wordBox = await first.locator('span').first().boundingBox()
	const meaningBox = await first.locator('span').nth(1).boundingBox()
	const dateBox = await first.locator('div').first().boundingBox()
	check(
		'at 375 px a word is a card: word, meaning, then the date line',
		wordBox !== null && meaningBox !== null && dateBox !== null && wordBox.y < meaningBox.y && meaningBox.y < dateBox.y
	)
	check(
		'at 375 px the page does not scroll sideways',
		await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
	)
	await page.waitForTimeout(400)
	await shot(page, 'notes-vocabulary', 'phone-words')
	sql(
		`update student_terms set removed_at = now(), removed_by = 'chat' where student_id = '${id}' and term in ('alpha', 'bravo')`
	)
	await page.reload()
	await tabNamed(page, 'Removed 2').waitFor({ timeout: 30000 })
	await tabNamed(page, 'Removed 2').click()
	const card = termRows(page, 'removed').first()
	await card.waitFor({ timeout: 10000 })
	const dateLine = await card.locator('div').first().boundingBox()
	const restoreBox = await card.getByRole('button', { name: /^Restore / }).boundingBox()
	check(
		'at 375 px Restore sits under the removed word',
		dateLine !== null && restoreBox !== null && restoreBox.y > dateLine.y
	)
	check(
		'at 375 px the page does not scroll sideways on Removed',
		await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
	)
	await page.waitForTimeout(400)
	await shot(page, 'notes-vocabulary', 'phone-removed')

	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

const REVIEW_AGES = [
	['now()', 'Reviewed today'],
	["now() - interval '1 day'", 'Reviewed yesterday'],
	["now() - interval '3 days'", 'Reviewed 3 days ago'],
	["now() - interval '45 days'", 'Reviewed 1 month ago'],
	["now() - interval '70 days'", 'Reviewed 2 months ago'],
]

function setReview(id, expression) {
	sql(
		`insert into note_reviews (student_id, reviewed_at) values ('${id}', ${expression}) on conflict (student_id) do update set reviewed_at = excluded.reviewed_at`
	)
}

async function openStamped(page, id, tab) {
	await page.goto(`${BASE}/students/${id}?tab=${tab}`)
	if (tab === 'notes') await blockOf(page, 'general_info').waitFor({ timeout: 30000 })
	else await tabNamed(page, 'Words 0').waitFor({ timeout: 30000 })
	const stamp = page.locator('[data-slot="review-stamp"]')
	await stamp.waitFor({ timeout: 10000 })
	return stamp
}

async function sectionReview(page, problems) {
	const id = await createCard(page, `${PREFIX}5`)
	for (const tab of ['notes', 'vocabulary']) {
		const stamp = await openStamped(page, id, tab)
		check(`${tab}: no review reads Never reviewed`, (await stamp.innerText()).trim() === 'Never reviewed')
		check(`${tab}: Never reviewed has no tooltip trigger`, (await stamp.getAttribute('tabindex')) === null)
		await shot(page, 'notes-review', `${tab}-never`)
	}
	for (const [expression, text] of REVIEW_AGES) {
		setReview(id, expression)
		const stamp = await openStamped(page, id, 'notes')
		check(`notes: ${text}`, (await stamp.innerText()).trim() === text, (await stamp.innerText()).trim())
	}
	setReview(id, "now() - interval '3 days'")
	for (const tab of ['notes', 'vocabulary']) {
		const stamp = await openStamped(page, id, tab)
		check(`${tab}: 3 days ago reads Reviewed 3 days ago`, (await stamp.innerText()).trim() === 'Reviewed 3 days ago')
		const stampBox = await stamp.boundingBox()
		const addBox = await page.getByRole('button', { name: tab === 'notes' ? 'Add block' : 'Add term' }).boundingBox()
		check(
			`${tab}: the stamp is on the left of the top row, the add button on the right`,
			stampBox !== null && addBox !== null && stampBox.x < addBox.x && Math.abs(stampBox.y - addBox.y) < 24
		)
		const expected = sql(
			`select to_char(reviewed_at at time zone 'Asia/Ho_Chi_Minh', 'Dy FMDD Mon YYYY, HH24:MI') as text from note_reviews where student_id = '${id}'`
		).rows[0].text
		await stamp.hover()
		const tip = page.getByText(/^Last review: /)
		await tip.waitFor({ timeout: 8000 })
		check(
			`${tab}: the tooltip gives the exact date and time`,
			(await tip.innerText()) === `Last review: ${expected} VN`,
			`${await tip.innerText()} vs ${expected}`
		)
		await page.waitForTimeout(300)
		await shot(page, 'notes-review', `${tab}-reviewed`)
	}
	await page.setViewportSize({ width: 375, height: 800 })
	for (const tab of ['notes', 'vocabulary']) {
		const stamp = await openStamped(page, id, tab)
		const stampBox = await stamp.boundingBox()
		check(
			`${tab}: at 375 px the stamp is first and fits`,
			stampBox !== null && stampBox.x >= 0 && stampBox.x + stampBox.width <= 375
		)
		check(
			`${tab}: at 375 px the page does not scroll sideways`,
			await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
		)
		await shot(page, 'notes-review', `${tab}-phone`)
	}
	const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
	check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
}

const wanted = process.argv.slice(2).find((value) => value in sections)
const run = wanted === undefined ? Object.entries(sections) : [[wanted, sections[wanted]]]

removeFixtures()
try {
	for (const [name, section] of run) {
		await withBrowser({ width: 1280, height: 800 }, async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			await section(page, problems)
		})
		console.log(`section ${name} done`)
	}
} catch (error) {
	check('sections completed', false, String(error).slice(0, 1500))
} finally {
	removeFixtures()
}
if (failures() === 0) console.log('NOTES_WEB_OK')
process.exit(failures())
