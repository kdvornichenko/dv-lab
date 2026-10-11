import { check, launch, shot, signIn, failures } from '../browser-context.ts'
import { setTheme, openSchedule } from './navigation.ts'
import { secondZonePopup } from './second-zone-popup.ts'
import { weekGridLayout } from './week-grid-layout.ts'
import { weekNavigation } from './week-navigation.ts'

export async function frameNewYork() {
	const at = new Date('2026-10-11T19:00:00Z')
	const { browser, page, problems } = await launch({ timezoneId: 'America/New_York' })
	try {
		await setTheme(page)
		await page.clock.setFixedTime(at)
		await signIn(page)
		await openSchedule(page)
		const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
		check('New York: browser zone is America/New_York', zone === 'America/New_York', zone)
		await weekGridLayout(page, 'New York', at)
		await weekNavigation(page, 'New York', at)
		await shot(page, 'sched-frame', 'new-york')
		check('New York: no console problems', problems.length === 0, problems.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
	}
}

export async function frame() {
	const { browser, page, problems } = await launch()
	const requests: { method: string; url: string }[] = []
	try {
		page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }))
		await setTheme(page)
		await signIn(page)
		requests.length = 0
		await openSchedule(page)
		await weekGridLayout(page, 'frame')
		await shot(page, 'sched-frame', 'week')
		await weekNavigation(page, 'frame')
		await shot(page, 'sched-frame', 'toolbar')
		await secondZonePopup(page, 'frame', requests)
		await page.setViewportSize({ width: 1920, height: 1080 })
		await page.waitForTimeout(400)
		const tall = await page.evaluate(() => {
			const viewport = document
				.querySelector<HTMLElement>('h1')
				?.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')
			const grid = document.querySelector<HTMLElement>('[data-slot="week-grid"]')?.getBoundingClientRect()
			return {
				scroll: viewport?.scrollHeight,
				client: viewport?.clientHeight,
				bottom: grid?.bottom,
				innerHeight: window.innerHeight,
			}
		})
		check('1080px high: no second page scroll', tall.scroll! <= tall.client! + 1, JSON.stringify(tall))
		check(
			'1080px high: the grid ends above the bottom edge',
			tall.bottom! <= tall.innerHeight - 8,
			JSON.stringify(tall)
		)
		await shot(page, 'sched-frame', 'tall')
		await page.setViewportSize({ width: 320, height: 800 })
		await page.waitForTimeout(300)
		const narrow = await page.evaluate(() => ({
			scroll: document.documentElement.scrollWidth,
			client: document.documentElement.clientWidth,
			body: document.body.scrollWidth,
		}))
		check(
			'320px has no horizontal page scroll',
			narrow.scroll <= narrow.client && narrow.body <= narrow.client,
			JSON.stringify(narrow)
		)
		await shot(page, 'sched-frame', 'narrow')
		check('no console problems', problems.length === 0, problems.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
	}
	await frameNewYork()
	if (failures() === 0) console.log('SCHEDULE_WEB_FRAME_OK')
}
