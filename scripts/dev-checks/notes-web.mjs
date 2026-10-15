import { BASE, api, check, failures, shot, signIn, sql, theme } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'
import { createCard } from './ledger-web/common.mjs'

const PREFIX = 'Alex Example 257'
const EXPECTED_NOISE =
	/status of 500|Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/
const STANDARD = ['General info', 'Interests', 'Level', 'Goals', 'Typical mistakes', 'Lesson ideas']

const sections = { blocks: sectionBlocks, order: sectionOrder }

function removeFixtures() {
	const cards = `select id from students where display_name like '${PREFIX}%' and import_key is null`
	sql(`delete from student_notes where student_id in (${cards})`)
	sql(`delete from student_sections where student_id in (${cards})`)
	sql(`delete from student_terms where student_id in (${cards})`)
	sql(`delete from note_reviews where student_id in (${cards})`)
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
	await page.getByRole('button', { name: 'Refresh' }).waitFor({ timeout: 30000 })
	check('a failed read gives one panel with Refresh', (await page.getByText('Could not load notes').count()) === 1)
	await shot(page, 'notes-blocks', 'read-error')
	await page.unroute('**/api/students/*/blocks')
	await page.getByRole('button', { name: 'Refresh' }).click()
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
