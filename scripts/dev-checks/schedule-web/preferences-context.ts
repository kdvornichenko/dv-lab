import type { Page } from '@playwright/test'

export const ZONE_KEYS = ['dv-lab.schedule.second-zone', 'dv-lab.time-zones.favorites']

export const OFFSET_TEXT = /UTC[+−-]\d|GMT[+−-]\d/

export async function clearZoneStorage(page: Page) {
	await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), ZONE_KEYS)
}

export async function listSequence(page: Page) {
	return page.evaluate(() => {
		const list = document.querySelector<HTMLElement>('[role="listbox"]')
		if (!list) return []
		return Array.from(list.children)
			.map((child) => (child.textContent ?? '').trim())
			.filter((text) => text !== '')
	})
}

export async function pageHasOffsetText(page: Page) {
	return page.evaluate((source) => new RegExp(source).test(document.body.innerText), OFFSET_TEXT.source)
}

export async function surfaceProbe(page: Page, level: number) {
	return page.evaluate((name) => {
		const probe = document.createElement('div')
		probe.style.backgroundColor = `var(--surface-${name})`
		document.body.append(probe)
		const color = getComputedStyle(probe).backgroundColor
		probe.remove()
		return color
	}, level)
}
