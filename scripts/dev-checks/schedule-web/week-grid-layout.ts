import type { Page } from '@playwright/test'

import * as core from '../../../packages/core/src/index.ts'
import { check } from '../browser-context.ts'
import { expectedNow, expectedRange, WEEKDAYS, dayNum } from './format.ts'

export async function weekGridLayout(page: Page, label: string, at?: Date | undefined) {
	const nowVn = expectedNow(at)
	const monday = core.mondayOf(nowVn.date)
	const data = await page.evaluate(() => {
		const query = (selector: string, root: ParentNode = document) =>
			Array.from(root.querySelectorAll<HTMLElement>(selector))
		const body = document.querySelector<HTMLElement>('[data-slot="week-grid-body"]')
		const head = document.querySelector<HTMLElement>('[data-slot="week-grid-head"]')
		const probe = document.createElement('div')
		probe.style.background = 'var(--gcal-today)'
		document.body.append(probe)
		const todayColor = getComputedStyle(probe).backgroundColor
		probe.remove()
		const transparent = 'rgba(0, 0, 0, 0)'
		const columns = query('[data-slot="week-grid-column"]')
		const lineTop = (hour: number) =>
			document.querySelector<HTMLElement>(`[data-slot="week-grid-line"][data-hour="${hour}"]`)?.getBoundingClientRect()
				.top
		const gutter = (hour: number) =>
			query('span', query('[data-slot="week-grid-gutter"] > div')[hour]).map((element) => element.textContent)
		const nowElement = document.querySelector<HTMLElement>('[data-slot="week-grid-now"]')
		const nowColumn = nowElement?.closest<HTMLElement>('[data-slot="week-grid-column"]')
		const nowRect = nowElement?.getBoundingClientRect()
		const columnRect = nowColumn?.getBoundingClientRect()
		return {
			h1: document.querySelector<HTMLElement>('h1')?.textContent,
			weekdays: query('[data-slot="week-grid-day"] > span:first-child').map((element) => element.textContent),
			dates: query('[data-slot="week-grid-day"]').map((element) => element.dataset.date),
			circles: query('[data-slot="week-grid-date"]').map((element) => ({
				text: element.textContent,
				background: getComputedStyle(element).backgroundColor,
			})),
			todayColor,
			columns: columns.map((element) => ({
				date: element.dataset.date,
				background: getComputedStyle(element).backgroundColor,
			})),
			transparent,
			hourStep: lineTop(11)! - lineTop(10)!,
			corner: query('span', document.querySelector<HTMLElement>('[data-slot="week-grid-corner"]')!).map(
				(element) => element.textContent
			),
			gutter8: gutter(8),
			gutter4: gutter(4),
			gutterLook: (() => {
				const describe = (root: ParentNode) =>
					query('span', root).map((element) => ({
						width: Math.round(element.getBoundingClientRect().width),
						weight: getComputedStyle(element).fontWeight,
						size: getComputedStyle(element).fontSize,
						opacity: getComputedStyle(element).opacity,
						color: getComputedStyle(element).color,
						right: element.getBoundingClientRect().right,
					}))
				const row = query('[data-slot="week-grid-gutter"] > div')[8]
				const first = document.querySelector<HTMLElement>('[data-slot="week-grid-column"]')
				return {
					row: describe(row),
					corner: describe(document.querySelector<HTMLElement>('[data-slot="week-grid-corner"]')!),
					gridLeft: first?.getBoundingClientRect().left,
				}
			})(),
			bodyFade: body?.classList.contains('scroll-fade'),
			scrollTop: body?.scrollTop,
			headInsideBody: Boolean(body && head && body.contains(head)),
			nowText: nowElement?.querySelector<HTMLElement>('.sr-only')?.textContent,
			nowCenter: nowRect ? nowRect.top + nowRect.height / 2 - columnRect!.top : null,
			nowHeight: nowRect?.height,
			nowColors: nowElement ? getComputedStyle(nowElement).backgroundColor : null,
			nowColumns: query('[data-slot="week-grid-now"]').length,
		}
	})
	check(`${label} h1 is the week range`, data.h1 === expectedRange(monday), data.h1)
	check(
		`${label} seven weekday captions`,
		data.weekdays.join(' ') === WEEKDAYS.map((name) => name.toUpperCase()).join(' '),
		data.weekdays.join(' ')
	)
	check(
		`${label} columns follow the week`,
		data.dates[0] === monday && data.dates[6] === core.addDays(monday, 6),
		data.dates.join(',')
	)
	const todayIndex = data.dates.indexOf(nowVn.date)
	check(`${label} today is in the week`, todayIndex >= 0)
	const circle = data.circles[todayIndex]
	check(`${label} today circle shows the Vietnam day`, circle?.text === String(dayNum(nowVn.date)), circle?.text)
	check(
		`${label} today circle uses gcal-today`,
		circle?.background === data.todayColor,
		`${circle?.background} / ${data.todayColor}`
	)
	check(
		`${label} only one filled circle`,
		data.circles.filter((item) => item.background !== data.transparent).length === 1
	)
	const column = data.columns.find((item) => item.date === nowVn.date)
	check(
		`${label} today column has bg-hover`,
		column !== undefined && column.background !== data.transparent,
		column?.background
	)
	check(
		`${label} other columns are empty`,
		data.columns.filter((item) => item.date !== nowVn.date).every((item) => item.background === data.transparent)
	)
	check(`${label} hour is 48px`, Math.abs(data.hourStep - 48) < 0.6, String(data.hourStep))
	check(
		`${label} corner names MSK on the left and VN on the right`,
		data.corner.join(' ') === 'MSK VN',
		data.corner.join(' ')
	)
	check(
		`${label} 08:00 VN is 04:00 MSK, second zone first`,
		data.gutter8.join(' ') === '04:00 08:00',
		data.gutter8.join(' ')
	)
	check(`${label} midnight row shows the weekday`, data.gutter4.join(' ') === 'Mon 04:00', data.gutter4.join(' '))
	const look = data.gutterLook
	const same = (items: typeof look.row, key: keyof (typeof look.row)[number]) =>
		items.length === 2 && items[0][key] === items[1][key]
	for (const [name, items] of [
		['row', look.row],
		['corner', look.corner],
	] as const) {
		check(
			`${label} gutter ${name}: two columns of the same width, size, weight and colour`,
			same(items, 'width') && same(items, 'size') && same(items, 'weight') && same(items, 'color'),
			JSON.stringify(items)
		)
		check(
			`${label} gutter ${name}: nothing is faded`,
			items.every((item: (typeof look.row)[number]) => item.opacity === '1'),
			JSON.stringify(items)
		)
	}
	check(
		`${label} gutter: Vietnam sits 8px from the grid`,
		Math.abs(look.gridLeft! - look.row[1].right - 8) <= 1,
		String(look.gridLeft! - look.row[1].right)
	)
	check(`${label} body has scroll-fade`, data.bodyFade === true)
	check(`${label} scrollTop is 336`, Math.abs(data.scrollTop! - 336) <= 2, String(data.scrollTop))
	check(`${label} day header is outside the scroller`, data.headInsideBody === false)
	const after = expectedNow(at)
	const shown = data.nowText?.replace(/^Now /, '')
	const shownMinutes = shown ? Number(shown.slice(0, 2)) * 60 + Number(shown.slice(3, 5)) : -1000
	check(
		`${label} sr-only Now matches Vietnam time`,
		Math.abs(shownMinutes - after.minutes) <= 1,
		`${data.nowText} / ${after.time}`
	)
	check(
		`${label} now line sits at the Vietnam minute`,
		data.nowCenter !== null && Math.abs(data.nowCenter - after.minutes * 0.8) <= 2,
		`${data.nowCenter} / ${after.minutes * 0.8}`
	)
	check(
		`${label} now line is 2px and drawn once`,
		data.nowHeight === 2 && data.nowColumns === 1,
		`${data.nowHeight}/${data.nowColumns}`
	)
	return { monday, nowVn }
}
