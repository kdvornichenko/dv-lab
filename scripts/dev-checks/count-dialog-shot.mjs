import { launch, signIn, BASE, check, failures, theme } from './web.mjs'

const mobile = process.argv.includes('mobile')
const many = process.argv.includes('many')
const width = mobile ? 390 : 1280
const height = mobile ? 844 : 800
const { browser, page } = await launch({ width, height })
await signIn(page)
await page.goto(`${BASE}/schedule`)
await page.waitForTimeout(2500)
await page.locator('button:has(svg.lucide-list-checks)').click()
await page.waitForTimeout(600)
const names = many
	? ['Anna K.', 'Boris', 'Chen', 'Dina', 'Egor', 'Farid', 'Gala', 'Hugo']
	: ['Anna K.', 'Boris']
await page.route('**/api/schedule/week*', async (route) => {
	const url = new URL(route.request().url())
	const start = new Date(`${url.searchParams.get('start')}T00:00:00Z`)
	const events = names.flatMap((name, index) => {
		const day = new Date(start.getTime() + (index % 5) * 86400000)
		const iso = `${day.toISOString().slice(0, 10)}T09:00:00Z`
		const end = `${day.toISOString().slice(0, 10)}T10:00:00Z`
		return [
			{
				eventKey: `${name}-${iso}`,
				title: name,
				when: { kind: 'timed', startsAt: iso, endsAt: end, timeZone: 'Asia/Ho_Chi_Minh' },
				status: 'confirmed',
				blocksTime: true,
				binding: { kind: 'external' },
				editBlock: null,
			},
		]
	})
	await route.fulfill({
		contentType: 'application/json',
		body: JSON.stringify({ read: { state: 'fresh', fetchedAt: new Date().toISOString(), revision: 'r' }, events }),
	})
})
const cells = page.getByRole('dialog').locator('button[data-day]')
const total = await cells.count()
await cells.nth(Math.min(12, total - 1)).click()
await page.waitForTimeout(200)
await cells.nth(Math.min(25, total - 1)).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Show events' }).click()
await page.waitForTimeout(1500)
await page.getByRole('option').first().click()
await page.waitForTimeout(300)
await page.screenshot({ path: `/private/tmp/claude-501/shots/count-${theme}-${width}${many ? '-many' : ''}.png` })
check('dialog opens', (await page.getByRole('dialog').count()) > 0)
check('options listed', (await page.getByRole('option').count()) === names.length)
check('result shown', (await page.getByRole('button', { name: 'Copy' }).count()) === 1)
await browser.close()
process.exit(failures() ? 1 : 0)
