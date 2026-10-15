import { BASE, api, check, failures, shot, signIn, sql } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'
import { removeStudentCards } from './fixture-cleanup.mjs'

const PREFIX = 'Alex Example 263'
const NOTE = '## Heading line\n\n**bold words** and a [link](https://example.com)\n\n- first item\n- second item'
const DELAY_MS = 2500

function removeFixtures() {
	const removed = removeStudentCards(sql, `display_name like '${PREFIX}%' and import_key is null`)
	console.log(`fixture cards removed ${removed}`)
}

async function makeCard(page, name) {
	const created = await api(page, 'POST', '/students', {
		displayName: name,
		rateMinor: null,
		currency: null,
		defaultLessonMinutes: 60,
		parent: null,
		level: null,
		goals: null,
		timeZone: null,
	})
	check(`the fixture card ${name} is created`, created.status === 201, String(created.status))
	const id = created.json.student.id
	const blocks = await api(page, 'GET', `/students/${id}/blocks`)
	const block = blocks.json.blocks[0]
	const saved = await api(page, 'PUT', `/students/${id}/blocks/${block.id}`, {
		body: NOTE,
		expectedRevision: block.revision,
	})
	check('the fixture note with markdown is saved', saved.status === 200, String(saved.status))
	return id
}

function watch(page, id) {
	const gets = []
	page.on('request', (request) => {
		const url = new URL(request.url())
		if (request.method() === 'GET' && url.pathname.startsWith(`/api/students/${id}`))
			gets.push(url.pathname + url.search)
	})
	return gets
}

async function openFromList(page, id) {
	await page.locator('a[href="/students"]').first().click()
	await page.waitForURL(`${BASE}/students`)
	const link = page.locator(`a[href="/students/${id}"]`).first()
	await link.waitFor({ timeout: 30000 })
	await link.click()
	await page.waitForURL(`${BASE}/students/${id}`)
	return Date.now()
}

async function previewShown(page, timeout) {
	return page
		.locator('[data-slot="markdown-preview"]')
		.first()
		.waitFor({ timeout })
		.then(() => true)
		.catch(() => false)
}

async function skeletons(page) {
	return page.locator('[role="tabpanel"]:not([hidden]) [data-slot="skeleton"]').count()
}

async function journey(page, id, other) {
	const gets = watch(page, id)
	await page.goto(`${BASE}/students`)
	await openFromList(page, id)
	check('the first visit shows the Overview preview', await previewShown(page, 30000))

	const preview = page.locator('[data-slot="markdown-preview"]').first()
	const text = await preview.innerText()
	check(
		'the preview has no markdown signs',
		!text.includes('##') && !text.includes('**') && !/^- /m.test(text) && !text.includes(']('),
		JSON.stringify(text)
	)
	check(
		'the heading is bold, list items start with a bullet, the link is text',
		(await preview.locator('strong').count()) >= 2 &&
			text.includes('Heading line') &&
			text.includes('• first item') &&
			(await preview.locator('a').count()) === 0,
		JSON.stringify(text)
	)

	await page.getByRole('tab', { name: 'Lessons' }).click()
	await page.locator('[role="tabpanel"]:not([hidden])').first().waitFor()
	await page.waitForTimeout(1500)
	const before = gets.length
	await page.getByRole('tab', { name: 'Overview' }).click()
	const shownAt = await previewShown(page, 300)
	const skeletonAt = await skeletons(page)
	await page.waitForTimeout(800)
	check('the second visit to Overview shows the preview at once', shownAt)
	check('the second visit to Overview shows no skeleton', skeletonAt === 0, String(skeletonAt))
	check('the second visit to Overview sends no GET', gets.length === before, JSON.stringify(gets.slice(before)))
	await page.getByRole('tab', { name: 'Lessons' }).click()
	await page.waitForTimeout(300)
	const lessonsBefore = gets.length
	await page.getByRole('tab', { name: 'Overview' }).click()
	await page.getByRole('tab', { name: 'Lessons' }).click()
	await page.waitForTimeout(800)
	check(
		'the second visit to Lessons sends no GET',
		gets.length === lessonsBefore,
		JSON.stringify(gets.slice(lessonsBefore))
	)

	const slow = async (route) => {
		if (route.request().method() === 'GET') await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
		await route.fallback()
	}
	await page.route(/\/api\/students\/[^/?]+(\/|\?|$)/, slow)

	const back = await openFromList(page, id)
	const panel = page.locator('[role="tabpanel"]:not([hidden])').first()
	await page.waitForTimeout(400)
	const backText = (await panel.innerText().catch(() => '')).trim()
	check(
		'coming back to the student page shows its data at once, before the slowed reads answer',
		backText.length > 0 && (await skeletons(page)) === 0 && Date.now() - back < DELAY_MS,
		backText.slice(0, 120).replace(/\n/g, ' | ')
	)
	const notesBefore = gets.length
	await page.getByRole('tab', { name: 'Notes' }).click()
	const blocksAt = await page
		.locator('[role="tabpanel"]:not([hidden]) section[data-block-key]')
		.first()
		.waitFor({ timeout: 600 })
		.then(() => true)
		.catch(() => false)
	check('the first visit to Notes shows the note blocks from the cache before the slowed read answers', blocksAt)
	check(
		'the Notes tab still asks for fresh data in the background',
		gets.slice(notesBefore).some((path) => path.endsWith('/blocks')),
		JSON.stringify(gets.slice(notesBefore))
	)
	await page.waitForTimeout(DELAY_MS + 1000)
	await shot(page, 'web-cache', 'notes-1280')
	await page.getByRole('tab', { name: 'Overview' }).click()
	await page.waitForTimeout(300)
	await shot(page, 'web-cache', 'overview-1280')

	await page.unroute(/\/api\/students\/[^/?]+(\/|\?|$)/, slow)
	await openFromList(page, other)
	await previewShown(page, 30000)
	await page.waitForTimeout(1000)
	await page.route(/\/api\/students\/[^/?]+(\/|\?|$)/, slow)
	await page.getByRole('tab', { name: 'Vocabulary' }).click()
	await page.getByRole('button', { name: 'Add term' }).first().waitFor({ timeout: 15000 })
	await page.getByRole('button', { name: 'Add term' }).first().click()
	const dialog = page.getByRole('dialog')
	await dialog.getByLabel('Term').fill('cache term')
	await dialog.getByRole('button', { name: 'Add term' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 15000 })
	await page.getByRole('tab', { name: 'Notes' }).click()
	await page.waitForTimeout(500)
	const staleBlocks = await page.locator('[role="tabpanel"]:not([hidden]) section[data-block-key]').count()
	const waiting = await skeletons(page)
	check(
		'after a write the cache is cleared: the first visit to Notes waits for the read',
		staleBlocks === 0 && waiting > 0,
		`blocks ${staleBlocks} skeletons ${waiting}`
	)
	check(
		'the read then shows the note blocks',
		await page
			.locator('[role="tabpanel"]:not([hidden]) section[data-block-key]')
			.first()
			.waitFor({ timeout: DELAY_MS + 15000 })
			.then(() => true)
			.catch(() => false)
	)
	await page.unrouteAll({ behavior: 'ignoreErrors' })
}

async function phone(page, id) {
	await page.goto(`${BASE}/students/${id}`)
	await previewShown(page, 30000)
	await page.waitForTimeout(800)
	await shot(page, 'web-cache', 'overview-390')
}

removeFixtures()
try {
	let id = null
	await withBrowser({ width: 1280, height: 800 }, async ({ page }) => {
		await signIn(page)
		id = await makeCard(page, `${PREFIX}0 Cache`)
		const other = await makeCard(page, `${PREFIX}1 Cache`)
		await journey(page, id, other)
	})
	await withBrowser({ width: 390, height: 844 }, async ({ page }) => {
		await signIn(page)
		await phone(page, id)
	})
} catch (error) {
	check('the journey completed', false, String(error).slice(0, 1500))
} finally {
	removeFixtures()
}
console.log(failures() === 0 ? 'WEB_CACHE_OK' : `WEB_CACHE_FAILED ${failures()}`)
process.exit(failures())
