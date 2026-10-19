import { removeStudentCards } from './fixture-cleanup.mjs'
import { BASE, check, failures, launch, shot, signIn, sql } from './web.mjs'

const NAME = 'Alex Example 2140'
const SECOND = 'Alex Example 2141'

const run = (text) => sql(text)
const clean = () => removeStudentCards(run, `display_name like 'Alex Example 214%' and import_key is null`)

clean()
const { browser, page, problems } = await launch({ width: 1280, height: 800 })
try {
	await signIn(page)

	await page.goto(`${BASE}/settings`)
	await page.getByText("Students' time zone").waitFor({ timeout: 30000 })
	const card = page.locator('section, div').filter({ hasText: "Students' time zone" }).last()
	check("Settings shows the Students' time zone card", (await card.count()) > 0)
	await page
		.getByText('Europe/Moscow')
		.first()
		.waitFor({ timeout: 15000 })
		.catch(() => {})
	check('the default students time zone is Europe/Moscow', (await page.getByText('Europe/Moscow').count()) > 0)
	await shot(page, 'pickers', 'settings')

	await page.goto(`${BASE}/students`)
	await page.getByRole('button', { name: 'New student' }).first().click()
	await page.getByPlaceholder('Student name').fill(NAME)
	const dialog = page.getByRole('dialog')
	check('a new student starts in Europe/Moscow', (await dialog.getByText('Europe/Moscow').count()) > 0)
	await dialog.getByRole('button', { name: 'Create student' }).click()
	await page.waitForURL(/\/students\/[0-9a-f-]{36}/, { timeout: 30000 })

	await page.goto(`${BASE}/students`)
	await page.getByRole('button', { name: 'New student' }).first().click()
	await page.getByPlaceholder('Student name').fill(SECOND)
	await page.getByRole('dialog').getByRole('button', { name: 'Create student' }).click()
	await page.waitForURL(/\/students\/[0-9a-f-]{36}/, { timeout: 30000 })

	await page.goto(`${BASE}/`)
	await page.getByRole('button', { name: 'Add payment' }).click()
	const picker = page.getByRole('dialog').getByRole('combobox').first()
	await picker.waitFor({ timeout: 15000 })
	await picker.fill('alex example 2141')
	const options = page.getByRole('option')
	await options.first().waitFor({ timeout: 5000 })
	check('the payment student picker filters by typed text', (await options.count()) === 1)
	check('the only match is the typed student', (await options.first().innerText()).includes(SECOND))
	await shot(page, 'pickers', 'payment-search')
	await page.keyboard.press('Escape')

	const unexpected = problems.filter(
		(entry) =>
			![
				'server caches disabled',
				'Route "/login"',
				'503 (Service Unavailable)',
				'500 (Internal Server Error)',
				'hydrated but some attributes',
			].some((part) => entry.includes(part))
	)
	check('no unexpected console problems', unexpected.length === 0, unexpected.slice(0, 3).join(' | '))
} catch (error) {
	check('section completed', false, String(error).slice(0, 1200))
} finally {
	await browser.close()
	clean()
}
if (failures() === 0) console.log('PICKERS_WEB_OK')
process.exit(failures())
