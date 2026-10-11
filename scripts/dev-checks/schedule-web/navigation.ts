import type { Page } from 'playwright-core'

import * as core from '../../../packages/core/src/index.ts'
import { BASE, shot } from '../browser-context.ts'

export const dark = process.argv.includes('dark')

export function setTheme(page: Page) {
	return page.addInitScript(
		(value) => {
			try {
				localStorage.setItem('theme', value)
			} catch {}
		},
		dark ? 'dark' : 'light'
	)
}

export const VN = core.SCHEDULE_TIME_ZONE

export async function openSchedule(page: Page) {
	await page.goto(`${BASE}/schedule`)
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
}

export function weeksFrom(left: string, right: string) {
	return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 604800000)
}

export async function goToWeek(page: Page, nav: { monday: string }, target: string) {
	const diff = weeksFrom(nav.monday, target)
	for (let step = 0; step < Math.abs(diff); step += 1) await page.keyboard.press(diff > 0 ? 'j' : 'k')
	nav.monday = target
	await page.waitForFunction(
		(expected) => document.querySelector<HTMLElement>('[data-slot="week-grid-day"]')?.dataset.date === expected,
		target,
		{ timeout: 30000 }
	)
	await page.waitForTimeout(150)
}

export async function shotEvening(page: Page, name: string) {
	const body = page.locator('[data-slot="week-grid-body"]')
	await body.evaluate((element) => {
		element.scrollTop = 560
	})
	await page.waitForTimeout(200)
	await shot(page, 'sched-read', name)
	await body.evaluate((element) => {
		element.scrollTop = 336
	})
	await page.waitForTimeout(100)
}
