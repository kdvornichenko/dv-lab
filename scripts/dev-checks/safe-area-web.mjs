import { BASE, check, failures, shot, signIn } from './web.mjs'

const playwright = process.env.PLAYWRIGHT_CORE ?? '/Volumes/T7/personal/ielts/node_modules/playwright-core/index.mjs'
const { chromium } = await import(playwright)

const TOP = 47
const BOTTOM = 34
const OTHER_SHA = 'f'.repeat(40)
const TITLE = 'A new version is available'
const COLUMN = '[data-slot="week-grid-column"][data-page="current"]'
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function open(browser, { width, height, phone, inset }) {
	const context = await browser.newContext({
		viewport: { width, height },
		hasTouch: phone,
		isMobile: phone,
		colorScheme: process.argv.includes('dark') ? 'dark' : 'light',
	})
	if (inset)
		await context.addInitScript(
			([top, bottom]) => {
				const sheet = new CSSStyleSheet()
				sheet.replaceSync(`:root { --safe-top: ${top}px !important; --safe-bottom: ${bottom}px !important; }`)
				document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
			},
			[TOP, BOTTOM]
		)
	await context.route(/\/api\/schedule\/week(\?|$)/, async (route) => {
		const response = await route.fetch()
		const body = await response.json()
		return route.fulfill({
			response,
			json: {
				...body,
				read: { state: 'fresh', fetchedAt: new Date().toISOString(), revision: '1' },
				write: { state: 'ready' },
				snapshotRange: body.requestedRange,
				events: [],
				series: [],
			},
		})
	})
	const page = await context.newPage()
	await signIn(page)
	return { context, page }
}

function px(value) {
	return value === null ? null : Math.round(parseFloat(value))
}

async function style(locator, property) {
	return locator
		.evaluate((element, name) => getComputedStyle(element)[name], property)
		.then(px)
		.catch(() => null)
}

async function box(locator) {
	const found = await locator.boundingBox().catch(() => null)
	return found ? Object.fromEntries(Object.entries(found).map(([key, value]) => [key, Math.round(value)])) : null
}

const topbar = (page) => page.locator('#content').locator('xpath=..').locator('header').first()
const toastStack = (page) => page.locator('[class*="var(--safe-top)"].pointer-events-none').first()
const notice = (page) => page.getByRole('status').filter({ hasText: TITLE })

async function phoneMeasure(browser, inset, screenshots) {
	const { context, page } = await open(browser, { width: 390, height: 844, phone: true, inset })
	const result = {}
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(COLUMN).first().waitFor({ timeout: 30000 })
	await page.locator('[data-slot="schedule-window"][aria-busy="false"]').waitFor({ timeout: 30000 })
	await wait(500)
	result.barHeight = (await box(topbar(page)))?.height ?? null
	result.barPadding = await style(topbar(page), 'paddingTop')
	result.triggerTop = (await box(topbar(page).locator('button').first()))?.y ?? null
	result.gridPadding = await style(page.locator('[data-slot="week-grid-body"]').first(), 'paddingBottom')
	result.toastTop = (await box(toastStack(page)))?.y ?? null
	if (screenshots) await shot(page, 'safe-area', 'schedule-390')

	const column = await page.locator(COLUMN).nth(3).boundingBox()
	const body = await page.locator('[data-slot="week-grid-body"]').first().boundingBox()
	const cdp = await context.newCDPSession(page)
	const point = { x: Math.round(column.x + column.width / 2), y: Math.round(body.y + body.height / 2), id: 1 }
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
	await wait(80)
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
	const dialog = page.getByRole('dialog').last()
	await dialog.waitFor({ timeout: 10000 })
	await wait(700)
	result.dialogPadding = await style(dialog, 'paddingTop')
	result.footerPadding = await style(dialog.locator('[data-slot="form-footer"]').first(), 'paddingBottom')
	const footer = await box(dialog.locator('[data-slot="form-footer"]').first())
	result.footerGap = footer === null ? null : 844 - (footer.y + footer.height)
	result.titleTop = (await box(dialog.getByRole('heading').first()))?.y ?? null
	if (screenshots) await shot(page, 'safe-area', 'new-lesson-390')
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 8000 }).catch(() => undefined)

	await page.route('**/api/healthz', (route) => route.fulfill({ json: { status: 'ok', sha: OTHER_SHA, db: 'ok' } }))
	await page.goto(`${BASE}/chat`, { timeout: 120000 })
	const composer = page.locator('textarea').first()
	await composer.waitFor({ timeout: 30000 })
	await notice(page)
		.waitFor({ timeout: 15000 })
		.catch(() => undefined)
	await wait(800)
	result.composerPadding = await style(
		page.locator('[class*="max(0.75rem,var(--safe-bottom))"]').first(),
		'paddingBottom'
	)
	result.noticeTop = (await box(notice(page)))?.y ?? null
	if (screenshots) await shot(page, 'safe-area', 'chat-390')
	await composer.fill('A message that is not sent yet')
	await notice(page).getByRole('button', { name: 'Reload', exact: true }).click()
	const sheet = page.getByRole('dialog').filter({ hasText: 'Reload now?' })
	await sheet.waitFor({ timeout: 8000 })
	await wait(700)
	result.sheetPadding = await style(sheet.locator('[class*="var(--safe-bottom)"]').first(), 'paddingBottom')
	const sheetBox = await box(sheet)
	result.sheetBottom = sheetBox === null ? null : sheetBox.y + sheetBox.height
	if (screenshots) await shot(page, 'safe-area', 'sheet-390')
	await sheet.getByRole('button', { name: 'Stay' }).click()
	await context.unrouteAll({ behavior: 'ignoreErrors' })
	await context.close()
	return result
}

async function laptopMeasure(browser) {
	const { context, page } = await open(browser, { width: 1280, height: 720, phone: false, inset: false })
	await page.goto(`${BASE}/schedule`, { timeout: 120000 })
	await page.locator(COLUMN).first().waitFor({ timeout: 30000 })
	const result = {
		barHeight: (await box(topbar(page)))?.height ?? null,
		barPadding: await style(topbar(page), 'paddingTop'),
		gridPadding: await style(page.locator('[data-slot="week-grid-body"]').first(), 'paddingBottom'),
		toastBottom: await style(toastStack(page), 'bottom'),
		shellPadding: await page.locator('#content').evaluate((main) => {
			const shell = main.closest('.bg-surface-1')
			return shell ? `${getComputedStyle(shell).paddingLeft} ${getComputedStyle(shell).paddingRight}` : null
		}),
		viewport: await page.locator('meta[name="viewport"]').getAttribute('content'),
	}
	await context.unrouteAll({ behavior: 'ignoreErrors' })
	await context.close()
	return result
}

const browser = await chromium.launch()
const flat = await phoneMeasure(browser, false, false)
const cut = await phoneMeasure(browser, true, true)
const laptop = await laptopMeasure(browser)
await browser.close()

const shift = (key) => (flat[key] === null || cut[key] === null ? null : cut[key] - flat[key])
const detail = (key) => `${flat[key]} -> ${cut[key]}`
check('viewport meta has viewport-fit=cover', laptop.viewport?.includes('viewport-fit=cover'), laptop.viewport)
check(
	'phone: the top bar is 48px without an inset',
	flat.barHeight === 48 && flat.barPadding === 0,
	detail('barHeight')
)
check(
	'phone: the top bar takes the top inset and stays 48px under it',
	shift('barHeight') === TOP && cut.barPadding === TOP && shift('triggerTop') === TOP,
	`${detail('barHeight')} trigger ${detail('triggerTop')}`
)
check('phone: the week grid ends above the bottom inset', shift('gridPadding') === BOTTOM, detail('gridPadding'))
check('phone: toasts sit under the bar and the top inset', shift('toastTop') === TOP, detail('toastTop'))
check('phone: a full-screen form starts under the top inset', shift('dialogPadding') === TOP, detail('dialogPadding'))
check('phone: the form title moves down by the top inset', shift('titleTop') === TOP, detail('titleTop'))
check(
	'phone: the form footer takes the bottom inset and stays at the bottom edge',
	shift('footerPadding') === BOTTOM && flat.footerGap === 0 && cut.footerGap === 0,
	`${detail('footerPadding')} gap ${detail('footerGap')}`
)
check(
	'phone: the chat composer clears the bottom inset',
	flat.composerPadding === 12 && cut.composerPadding === BOTTOM,
	detail('composerPadding')
)
check('phone: UpdateNotice sits under the bar and the top inset', shift('noticeTop') === TOP, detail('noticeTop'))
check(
	'phone: the bottom sheet footer takes the bottom inset, the sheet stays on the bottom edge',
	shift('sheetPadding') === BOTTOM && flat.sheetBottom === 844 && cut.sheetBottom === 844,
	`${detail('sheetPadding')} bottom ${detail('sheetBottom')}`
)
check(
	'laptop 1280: the top bar, grid, toasts and shell are as before',
	laptop.barHeight === 48 &&
		laptop.barPadding === 0 &&
		laptop.gridPadding === 0 &&
		laptop.toastBottom === 24 &&
		laptop.shellPadding === '0px 0px',
	JSON.stringify(laptop)
)

const failed = failures()
if (failed > 0) {
	console.log(`SAFE_AREA_WEB_FAILED ${failed}`)
	process.exit(1)
}
console.log('SAFE_AREA_WEB_OK')
