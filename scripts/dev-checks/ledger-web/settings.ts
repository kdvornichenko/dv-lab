import type { Page } from '@playwright/test'

import type { SettingsResponse, ErrorResponse } from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { BASE, api, check, failures, shot, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import {
	VN,
	cleanupFixtures,
	setTheme,
	createCard,
	setOpening,
	setThreshold,
	withTeacherSettings,
	openStudentsList,
} from './common.mjs'
import { balanceFacts } from './students.mjs'

async function paysSoonThreshold(page: Page) {
	const result = await api<SettingsResponse & Partial<ErrorResponse>>(page, 'GET', '/settings')
	return result.json?.settings?.paysSoonLessons ?? null
}

async function waitThreshold(page: Page, expected: number) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		if ((await paysSoonThreshold(page)) === expected) return true
		await page.waitForTimeout(250)
	}
	return false
}

export async function settingsSection() {
	cleanupFixtures('settings start')
	await withTeacherSettings(async () => {
		const patches: (string | null)[] = []
		await withBrowser(
			{ width: 1440, height: 900 },
			async ({ page, problems }) => {
				await setTheme(page)
				await signIn(page)
				page.on('request', (request) => {
					if (request.method() === 'PATCH' && request.url().endsWith('/api/settings')) patches.push(request.postData())
				})
				await setThreshold(page, 2)
				const holder = await createCard(page, 'Alex Example 2166 A')
				await setOpening(page, holder, core.addDays(core.zonedParts(new Date(), VN).date, -3), 300)
				await openStudentsList(page)
				let facts = await balanceFacts(page, 'Alex Example 2166 A')
				check(
					'threshold 2: three lessons left is Plenty left',
					facts.text === '3 lessons left' && facts.dotLabel === 'Plenty left',
					`${facts.text} ${facts.dotLabel}`
				)
				await page.goto(`${BASE}/settings`)
				const input = page.getByLabel('Pays soon threshold (lessons)')
				await page.locator('#settings-payments').waitFor({ timeout: 30000 })
				await page.waitForFunction(
					() => document.querySelector<HTMLInputElement>('#settings-pays-soon')?.value === '2',
					null,
					{
						timeout: 15000,
					}
				)
				const card = await page.evaluate(() => {
					const titles = Array.from(document.querySelectorAll<HTMLElement>('h2')).map((item) => item.textContent)
					const field = document.querySelector<HTMLInputElement>('#settings-pays-soon')
					const panel = document.querySelector<HTMLElement>('#settings-payments')!.closest<HTMLElement>('section')
					return {
						titles,
						width: field!.getBoundingClientRect().width,
						align: getComputedStyle(field!).textAlign,
						numeric: getComputedStyle(field!).fontVariantNumeric,
						text: panel!.textContent,
					}
				})
				check(
					'settings: Payments follows Time zones',
					JSON.stringify(card.titles.slice(-2)) === JSON.stringify(['Time zones', 'Payments']),
					card.titles.join('|')
				)
				check(
					'settings: the field is 96px, right aligned and tabular',
					card.width === 96 && /right|end/.test(card.align) && card.numeric.includes('tabular-nums'),
					`${card.width} ${card.align} ${card.numeric}`
				)
				check(
					'settings: description, hint and caption are there',
					card.text.includes('Decide when a student counts as paying soon.') &&
						card.text.includes('Students with this many lessons left or fewer appear in Pays soon on Today.') &&
						card.text.includes('Saved to your account.')
				)
				await shot(page, 'ledger-settings', 'payments')
				await input.fill('3')
				await input.blur()
				await page.getByText('Pays soon threshold: 3 lessons.').waitFor({ timeout: 10000 })
				check('save by blur: the toast says Saved', await page.getByText('Saved', { exact: true }).first().isVisible())
				check('save by blur: GET /settings is 3', (await paysSoonThreshold(page)) === 3)
				check('save by blur: one request left', patches.length === 1, String(patches.length))
				await shot(page, 'ledger-settings', 'saved')
				await openStudentsList(page)
				facts = await balanceFacts(page, 'Alex Example 2166 A')
				check(
					'threshold 3: three lessons left is Pays soon',
					facts.dotLabel === 'Pays soon' && facts.dotTone === 'bg-info',
					String(facts.dotLabel)
				)
				await page.goto(`${BASE}/settings`)
				await page.waitForFunction(
					() => document.querySelector<HTMLInputElement>('#settings-pays-soon')?.value === '3',
					null,
					{
						timeout: 15000,
					}
				)
				const error = page.getByText('Use a whole number from 0 to 20.', { exact: true })
				const rejected = async (label: string, text: string, keepCaption: boolean) => {
					const sent = patches.length
					await input.fill(text)
					await input.blur()
					await page.waitForTimeout(500)
					check(`${label}: the error shows`, await error.isVisible())
					check(`${label}: the field is marked invalid`, (await input.getAttribute('aria-invalid')) === 'true')
					check(`${label}: no request left`, patches.length === sent, `${patches.length} / ${sent}`)
					check(`${label}: the value is still shown for a moment`, (await input.inputValue()) === text)
					if (keepCaption) await shot(page, 'ledger-settings', 'invalid')
					await page.waitForTimeout(2300)
					check(
						`${label}: the saved value returns`,
						(await input.inputValue()) === '3' && !(await error.isVisible()),
						await input.inputValue()
					)
					check(`${label}: the server value is unchanged`, (await paysSoonThreshold(page)) === 3)
				}
				await rejected('2.5', '2.5', true)
				await rejected('21', '21', false)
				await rejected('empty', '', false)
				await rejected('spaces', '   ', false)
				await rejected('minus one', '-1', false)
				const sent = patches.length
				await input.fill('2')
				await input.press('Enter')
				await page.getByText('Pays soon threshold: 2 lessons.').waitFor({ timeout: 10000 })
				check('Enter saves 2', (await paysSoonThreshold(page)) === 2)
				await input.blur()
				await page.waitForTimeout(500)
				check('Enter then blur sends one request', patches.length === sent + 1, `${patches.length} / ${sent}`)
				await input.fill('1')
				await input.blur()
				await page.getByText('Pays soon threshold: 1 lesson.').waitFor({ timeout: 10000 })
				await input.fill('2')
				await input.press('Enter')
				check('Enter saves 2 again', await waitThreshold(page, 2))
				await page.waitForTimeout(500)
				await page.route('**/api/settings', (route) =>
					route.request().method() === 'PATCH' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()
				)
				await input.fill('5')
				await input.blur()
				await page.getByText('Could not save the setting. Try again.').waitFor({ timeout: 10000 })
				check('a failed save returns the saved value', (await input.inputValue()) === '2', await input.inputValue())
				check('a failed save changes nothing on the server', (await paysSoonThreshold(page)) === 2)
				await shot(page, 'ledger-settings', 'failed')
				await page.unroute('**/api/settings')
				const real = problems.filter(
					(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409|500)/.test(problem)
				)
				check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
			},
			() => cleanupFixtures('settings end')
		)
	})
	if (failures() === 0) console.log('LEDGER_WEB_SETTINGS_OK')
}
