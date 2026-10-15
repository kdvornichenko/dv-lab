import { BASE, api, check, failures, shot, signIn } from './browser-context.ts'
import { withBrowser } from './browser-journey.ts'

const EXPECTED_NOISE = /Failed to load resource|server caches disabled|Route "\/login": Next\.js encountered URL data/
const TITLE = 'A new version is available'
const OTHER_SHA = 'f'.repeat(40)
const NEWER_SHA = 'e'.repeat(40)
const TICK_MS = 10 * 60 * 1000

const notice = (page) => page.getByRole('status').filter({ hasText: TITLE })
const reloadButton = (page) => notice(page).getByRole('button', { name: 'Reload', exact: true })
const shown = async (page) => (await notice(page).count()) === 1

const isHealth = (response) => response.url().endsWith('/api/healthz')

async function settle(page, answered) {
	await answered.catch(() => null)
	await page.waitForTimeout(500)
}

async function becomeVisible(page) {
	const answered = page.waitForResponse(isHealth, { timeout: 10000 })
	await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
	await settle(page, answered)
}

async function tick(page) {
	const answered = page.waitForResponse(isHealth, { timeout: 10000 })
	await page.clock.fastForward(TICK_MS)
	await settle(page, answered)
}

async function serveSha(page, sha) {
	await page.unroute('**/api/healthz')
	if (sha !== null)
		await page.route('**/api/healthz', (route) => route.fulfill({ json: { status: 'ok', sha, db: 'ok' } }))
}

async function box(locator) {
	const found = await locator.boundingBox()
	return found ? Object.fromEntries(Object.entries(found).map(([key, value]) => [key, Math.round(value)])) : null
}

async function openPage(page, path) {
	const answered = page.waitForResponse(isHealth, { timeout: 30000 })
	await page.goto(`${BASE}${path}`)
	await settle(page, answered)
}

async function desktop(page, liveSha) {
	const healthOnLogin = []
	const listen = (request) => {
		if (request.url().endsWith('/api/healthz')) healthOnLogin.push(request.url())
	}
	page.on('request', listen)
	await page.goto(`${BASE}/login`)
	await page.waitForTimeout(1500)
	page.off('request', listen)
	check('the login page does not check the version', healthOnLogin.length === 0, healthOnLogin.length)

	await page.addInitScript(() => {
		delete Element.prototype.animate
	})
	await page.clock.install()
	await signIn(page)
	await openPage(page, '/')
	check('the same sha shows no notice', (await notice(page).count()) === 0)
	if (liveSha === 'unknown') {
		await serveSha(page, OTHER_SHA)
		await becomeVisible(page)
		check('without a build version the check is off', (await notice(page).count()) === 0)
		return
	}

	await serveSha(page, 'unknown')
	await becomeVisible(page)
	check('an unknown api sha shows no notice', (await notice(page).count()) === 0)

	await serveSha(page, OTHER_SHA)
	await becomeVisible(page)
	check('a different sha shows the notice', await shown(page))
	check(
		'the notice has the line, one Reload and Dismiss',
		(await notice(page).getByText('Reload to get the latest changes.', { exact: true }).count()) === 1 &&
			(await reloadButton(page).count()) === 1 &&
			(await notice(page).getByRole('button', { name: 'Dismiss' }).count()) === 1
	)
	const placed = await box(notice(page))
	check(
		'on desktop the notice is 340px wide, 16px from the bottom right corner',
		placed !== null &&
			placed.width === 340 &&
			1280 - placed.x - placed.width === 16 &&
			800 - placed.y - placed.height === 16,
		JSON.stringify(placed)
	)
	check(
		'the notice does not take focus',
		await notice(page).evaluate((element) => !element.contains(document.activeElement))
	)
	await page.waitForTimeout(5000)
	check('the notice stays after five seconds', await shown(page))
	await page.keyboard.press('Escape')
	await page.waitForTimeout(300)
	check('Escape does not close the notice', await shown(page))
	await tick(page)
	check('the ten-minute check keeps one notice', (await notice(page).count()) === 1)
	await shot(page, 'update-web', 'notice-1280')

	await notice(page).getByRole('button', { name: 'Dismiss' }).click()
	await page.clock.runFor(1000)
	check('Dismiss hides the notice', (await notice(page).count()) === 0)
	await tick(page)
	check('the ten-minute check does not bring a dismissed notice back', (await notice(page).count()) === 0)
	await becomeVisible(page)
	check('returning to the page brings it back while the version is old', await shown(page))

	await notice(page).getByRole('button', { name: 'Dismiss' }).click()
	await page.clock.runFor(1000)
	await serveSha(page, NEWER_SHA)
	await tick(page)
	check('a newer version shows the notice at once', await shown(page))

	await serveSha(page, null)
	await becomeVisible(page)
	await page.clock.runFor(1000)
	check('the notice goes when the server runs this version again', (await notice(page).count()) === 0)
}

async function phone(page) {
	await signIn(page)
	await serveSha(page, OTHER_SHA)
	await openPage(page, '/chat')
	const bar = await page.locator('#content').evaluate((main) => {
		const header = main.parentElement?.querySelector('header')
		return header ? Math.round(header.getBoundingClientRect().height) : null
	})
	check('the chat top bar is 48px on the phone', bar === 48, bar)
	check('the notice opens on the phone', await shown(page))
	const placed = await box(notice(page))
	check(
		'on the phone the notice is 358px wide with 16px gutters, 8px under the bar',
		placed !== null && placed.width === 358 && placed.x === 16 && placed.y === 56,
		JSON.stringify(placed)
	)
	check(
		'at 390 px the page does not scroll sideways',
		await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
	)
	await shot(page, 'update-web', 'notice-390')

	const composer = page.locator('textarea').first()
	await composer.fill('A message that is not sent yet')
	await reloadButton(page).click()
	const confirm = page.getByRole('dialog').filter({ hasText: 'Reload now?' })
	await confirm.waitFor({ timeout: 5000 })
	check(
		'typed text asks Reload now? with the warning line',
		(await confirm.getByText('Changes you have not saved will be lost.', { exact: true }).count()) === 1
	)
	check(
		'Stay comes first and has the focus',
		await confirm.evaluate((dialog) => {
			const buttons = [...dialog.querySelectorAll('button')].map((button) => button.textContent?.trim())
			return (
				buttons.indexOf('Stay') < buttons.indexOf('Reload') && document.activeElement?.textContent?.trim() === 'Stay'
			)
		})
	)
	const covered = await notice(page).evaluate((element) => {
		const rect = element.getBoundingClientRect()
		const top = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
		return top !== null && !element.contains(top)
	})
	check('under the dialog the notice stays behind the backdrop', covered)
	await shot(page, 'update-web', 'confirm-390')
	await confirm.getByRole('button', { name: 'Stay' }).click()
	await page.waitForTimeout(400)
	check(
		'Stay keeps the page and the typed text',
		(await composer.inputValue()) === 'A message that is not sent yet' && (await shown(page))
	)

	await composer.fill('')
	await page.evaluate(() => {
		window.__beforeReload = true
	})
	const leaving = []
	page.on('dialog', (dialog) => {
		leaving.push(dialog.type())
		void dialog.dismiss()
	})
	await page.evaluate(() => {
		window.__hold = (event) => event.preventDefault()
		window.addEventListener('beforeunload', window.__hold)
	})
	await reloadButton(page).click()
	await page.waitForTimeout(300)
	const pressed = notice(page).getByRole('button', { name: 'Reloading…' })
	check(
		'Reload without typed text starts the reload at once and shows Reloading…',
		leaving.includes('beforeunload') && (await pressed.count()) === 1 && (await pressed.isDisabled()),
		leaving.join(',')
	)
	await page.waitForTimeout(5500)
	check(
		'a reload that did not happen returns the action to Reload',
		(await reloadButton(page).isEnabled()) && (await shown(page))
	)
	await page.evaluate(() => window.removeEventListener('beforeunload', window.__hold))
	const loaded = page.waitForEvent('load', { timeout: 30000 })
	await reloadButton(page).click()
	await loaded
	check('the page was reloaded', (await page.evaluate(() => window.__beforeReload === true)) === false)
}

try {
	let liveSha = null
	await withBrowser({ width: 1280, height: 800 }, async ({ page, problems }) => {
		const live = await api(page, 'GET', '/healthz')
		liveSha = live.json?.sha ?? null
		check('the api answers healthz with a sha', live.status === 200 && typeof liveSha === 'string', live.status)
		await desktop(page, liveSha)
		const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
		check('no unexpected console problems on desktop', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
	})
	if (liveSha === 'unknown') {
		check('the stand runs with --git-sha for the update notice', false, 'stand.mjs up --git-sha <value>')
	} else {
		await withBrowser({ width: 390, height: 844 }, async ({ page, problems }) => {
			await phone(page)
			const unexpected = problems.filter((line) => !EXPECTED_NOISE.test(line))
			check('no unexpected console problems on the phone', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
		})
	}
} catch (error) {
	check('the check completed', false, String(error).slice(0, 1500))
}
if (failures() === 0) console.log('UPDATE_WEB_OK')
process.exit(failures())
