import * as core from '../../packages/core/src/index.ts'
import { BASE, api, check, failures, launch, shot, signIn, sql } from './web.mjs'

const section = process.argv[2]
const dark = process.argv.includes('dark')

const fixtureWhere = (like) => `display_name like '${like}' and import_key is null`

const cleanupText = (like) => `do $$ begin
if to_regclass('lesson_marks') is not null then
delete from lesson_marks where lesson_id in (select id from lessons where student_id in (select id from students where ${fixtureWhere(like)}))
or series_id in (select id from lesson_series where student_id in (select id from students where ${fixtureWhere(like)}));
end if;
if to_regclass('lesson_exceptions') is not null then
delete from lesson_exceptions where series_id in (select id from lesson_series where student_id in (select id from students where ${fixtureWhere(like)}));
end if;
if to_regclass('lessons') is not null then
delete from lessons where student_id in (select id from students where ${fixtureWhere(like)});
end if;
if to_regclass('lesson_series') is not null then
delete from lesson_series where student_id in (select id from students where ${fixtureWhere(like)});
end if;
delete from students where ${fixtureWhere(like)};
end $$`

export function cleanupFixtures(label, like = 'Alex Example 20%') {
	const before = sql(`select count(*)::int as n from students where ${fixtureWhere(like)}`)
	const found = before.rows?.[0]?.n ?? 0
	const result = sql(cleanupText(like))
	console.log(`${label}: fixture cards removed ${found}${result.error || result.raw ? ' (cleanup failed)' : ''}`)
	return found
}

function setTheme(page) {
	return page.addInitScript(
		(value) => {
			try {
				localStorage.setItem('theme', value)
			} catch {}
		},
		dark ? 'dark' : 'light'
	)
}

async function fade() {
	cleanupFixtures('fade start')
	const insert = sql(`insert into students (display_name) values ('Alex Example 2031') returning id`)
	check('fixture card created', insert.rowCount === 1)
	const { browser, page, problems } = await launch()
	try {
		await setTheme(page)
		await signIn(page)
		await page.goto(`${BASE}/students`)
		await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })

		const root = await page.evaluate(() => {
			const style = getComputedStyle(document.documentElement)
			const read = (name) => style.getPropertyValue(name).trim().toLowerCase()
			return {
				size: read('--scroll-fade-size'),
				compact: read('--scroll-fade-size-compact'),
				today: read('--gcal-today'),
				ink: read('--gcal-today-ink'),
				now: read('--gcal-now'),
				line: read('--gcal-line'),
			}
		})
		check('--scroll-fade-size is 48px', root.size === '48px', root.size)
		check('--scroll-fade-size-compact is 24px', root.compact === '24px', root.compact)
		check('--gcal-today', root.today === (dark ? '#8ab4f8' : '#1a73e8'), root.today)
		check(
			'--gcal-today-ink',
			root.ink.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') === (dark ? '#202124' : '#ffffff'),
			root.ink
		)
		check('--gcal-now', root.now === (dark ? '#f28b82' : '#ea4335'), root.now)
		check('--gcal-line', root.line === (dark ? '#3c4043' : '#dadce0'), root.line)

		const body = await page.evaluate(() => {
			const heading = document.querySelector('h1')
			const viewport = heading?.closest('[data-slot="scroll-area-viewport"]')
			if (!viewport) return null
			const style = getComputedStyle(viewport)
			return {
				fade: viewport.classList.contains('scroll-fade'),
				mask: style.maskImage || style.webkitMaskImage,
				size: style.getPropertyValue('--scroll-fade-size').trim(),
			}
		})
		check('page body viewport found', body !== null)
		check('page body viewport has scroll-fade', body?.fade === true)
		check('page body mask-image is set', Boolean(body?.mask) && body.mask !== 'none', body?.mask?.slice(0, 40))
		check('page body fade size is 48px', body?.size === '48px', body?.size)

		await page.getByRole('button', { name: 'New student' }).click()
		const dialog = page.getByRole('dialog')
		await dialog.waitFor({ timeout: 10000 })
		await dialog.locator('#student-form-currency').first().click()
		const listbox = page.getByRole('listbox')
		await listbox.waitFor({ timeout: 10000 })
		const select = await page.evaluate(() => {
			const list = document.querySelector('[role="listbox"]')
			const viewport =
				list?.closest('[data-slot="scroll-area-viewport"]') ?? list?.querySelector('[data-slot="scroll-area-viewport"]')
			const target = viewport ?? list?.parentElement?.closest('[data-slot="scroll-area-viewport"]')
			if (!target) return null
			return {
				fade: target.classList.contains('scroll-fade'),
				size: getComputedStyle(target).getPropertyValue('--scroll-fade-size').trim(),
				height: target.getBoundingClientRect().height,
			}
		})
		check('Select list viewport found', select !== null)
		check('Select list has scroll-fade', select?.fade === true)
		check(
			'Select list fade size is 24px under 200px and 48px from 200px',
			select !== null && select.size === (select.height < 200 ? '24px' : '48px'),
			`${select?.size} at ${select?.height}`
		)
		await shot(page, 'sched-fade', 'select')
		await page.keyboard.press('Escape')
		await page.keyboard.press('Escape')
		console.log(failures() === 0 ? 'FADE_PART1_OK' : 'FADE_PART1_FAIL')

		await page.setViewportSize({ width: 360, height: 800 })
		await page.goto(`${BASE}/students`)
		await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
		await page.locator('[data-slot="table-container"]').first().waitFor({ timeout: 15000 })
		const table = await page.evaluate(() => {
			const container = document.querySelector('[data-slot="table-container"]')
			if (!container) return null
			const style = getComputedStyle(container)
			return {
				fade: container.classList.contains('scroll-fade-x'),
				size: style.getPropertyValue('--scroll-fade-size').trim(),
				scroll: container.scrollWidth,
				client: container.clientWidth,
				mask: style.maskImage || style.webkitMaskImage,
			}
		})
		check('table container found', table !== null)
		check('table container has scroll-fade-x', table?.fade === true)
		check('table container fade size is 24px', table?.size === '24px', table?.size)
		check(
			'table container overflows at 360px',
			table !== null && table.scroll > table.client,
			`${table?.scroll}/${table?.client}`
		)
		check('table container mask-image is set', Boolean(table?.mask) && table.mask !== 'none', table?.mask?.slice(0, 40))
		await shot(page, 'sched-fade', 'table')
		check('no console errors', problems.length === 0, problems.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
		cleanupFixtures('fade end')
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_FADE_OK')
}

const VN = core.SCHEDULE_TIME_ZONE
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dayNum(date) {
	return Number(date.slice(8, 10))
}

function monthName(date) {
	return MONTHS[Number(date.slice(5, 7)) - 1]
}

function expectedRange(monday) {
	const sunday = core.addDays(monday, 6)
	const left = `${dayNum(monday)}`
	if (monday.slice(0, 4) !== sunday.slice(0, 4)) {
		return `${left} ${monthName(monday)} ${monday.slice(0, 4)} – ${dayNum(sunday)} ${monthName(sunday)} ${sunday.slice(0, 4)}`
	}
	if (monthName(monday) !== monthName(sunday))
		return `${left} ${monthName(monday)} – ${dayNum(sunday)} ${monthName(sunday)}`
	return `${left} – ${dayNum(sunday)} ${monthName(sunday)}`
}

function expectedNow(at) {
	return core.zonedParts(at ?? new Date(), VN)
}

function expectedTitle(monday) {
	const sunday = core.addDays(monday, 6)
	if (monday.slice(0, 4) !== sunday.slice(0, 4)) {
		return `${monthName(monday)} ${monday.slice(0, 4)} – ${monthName(sunday)} ${sunday.slice(0, 4)}`
	}
	if (monthName(monday) !== monthName(sunday))
		return `${monthName(monday)} – ${monthName(sunday)} ${sunday.slice(0, 4)}`
	const long = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long' }).format(
		new Date(`${monday}T12:00:00Z`)
	)
	return `${long} ${monday.slice(0, 4)}`
}

async function openSchedule(page) {
	await page.goto(`${BASE}/schedule`)
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
}

async function framePart1(page, label, at) {
	const nowVn = expectedNow(at)
	const monday = core.mondayOf(nowVn.date)
	const data = await page.evaluate(() => {
		const query = (selector, root = document) => Array.from(root.querySelectorAll(selector))
		const body = document.querySelector('[data-slot="week-grid-body"]')
		const head = document.querySelector('[data-slot="week-grid-head"]')
		const probe = document.createElement('div')
		probe.style.background = 'var(--gcal-today)'
		document.body.append(probe)
		const todayColor = getComputedStyle(probe).backgroundColor
		probe.remove()
		const transparent = 'rgba(0, 0, 0, 0)'
		const columns = query('[data-slot="week-grid-column"]')
		const lineTop = (hour) =>
			document.querySelector(`[data-slot="week-grid-line"][data-hour="${hour}"]`)?.getBoundingClientRect().top
		const gutter = (hour) =>
			query('span', query('[data-slot="week-grid-gutter"] > div')[hour]).map((element) => element.textContent)
		const nowElement = document.querySelector('[data-slot="week-grid-now"]')
		const nowColumn = nowElement?.closest('[data-slot="week-grid-column"]')
		const nowRect = nowElement?.getBoundingClientRect()
		const columnRect = nowColumn?.getBoundingClientRect()
		return {
			h1: document.querySelector('h1')?.textContent,
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
			hourStep: lineTop(11) - lineTop(10),
			corner: query('span', document.querySelector('[data-slot="week-grid-corner"]')).map(
				(element) => element.textContent
			),
			gutter8: gutter(8),
			gutter4: gutter(4),
			gutterLook: (() => {
				const describe = (root) =>
					query('span', root).map((element) => ({
						width: Math.round(element.getBoundingClientRect().width),
						weight: getComputedStyle(element).fontWeight,
						size: getComputedStyle(element).fontSize,
						opacity: getComputedStyle(element).opacity,
						color: getComputedStyle(element).color,
						right: element.getBoundingClientRect().right,
					}))
				const row = query('[data-slot="week-grid-gutter"] > div')[8]
				const first = document.querySelector('[data-slot="week-grid-column"]')
				return {
					row: describe(row),
					corner: describe(document.querySelector('[data-slot="week-grid-corner"]')),
					gridLeft: first?.getBoundingClientRect().left,
				}
			})(),
			bodyFade: body?.classList.contains('scroll-fade'),
			scrollTop: body?.scrollTop,
			headInsideBody: Boolean(body && head && body.contains(head)),
			nowText: nowElement?.querySelector('.sr-only')?.textContent,
			nowCenter: nowRect ? nowRect.top + nowRect.height / 2 - columnRect.top : null,
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
	const same = (items, key) => items.length === 2 && items[0][key] === items[1][key]
	for (const [name, items] of [
		['row', look.row],
		['corner', look.corner],
	]) {
		check(
			`${label} gutter ${name}: two columns of the same width, size, weight and colour`,
			same(items, 'width') && same(items, 'size') && same(items, 'weight') && same(items, 'color'),
			JSON.stringify(items)
		)
		check(
			`${label} gutter ${name}: nothing is faded`,
			items.every((item) => item.opacity === '1'),
			JSON.stringify(items)
		)
	}
	check(
		`${label} gutter: Vietnam sits 8px from the grid`,
		Math.abs(look.gridLeft - look.row[1].right - 8) <= 1,
		String(look.gridLeft - look.row[1].right)
	)
	check(`${label} body has scroll-fade`, data.bodyFade === true)
	check(`${label} scrollTop is 336`, Math.abs(data.scrollTop - 336) <= 2, String(data.scrollTop))
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

async function readHeader(page) {
	return page.evaluate(() => {
		const h1 = document.querySelector('h1')
		return {
			h1: h1?.textContent,
			eyebrow: h1?.parentElement?.querySelector('p')?.textContent,
			title: document.querySelector('[data-slot="schedule-period"]')?.textContent,
			first: document.querySelector('[data-slot="week-grid-day"]')?.dataset.date,
			scrollTop: document.querySelector('[data-slot="week-grid-body"]')?.scrollTop,
			nowLines: document.querySelectorAll('[data-slot="week-grid-now"]').length,
		}
	})
}

async function framePart2(page, label, at) {
	const nowVn = expectedNow(at)
	const monday = core.mondayOf(nowVn.date)
	const today = page.getByRole('button', { name: 'Today', exact: true })
	const settle = async () => {
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 15000 })
		await page.waitForTimeout(250)
	}
	const expectWeek = async (name, offset, eyebrow, todayDisabled) => {
		const week = core.addDays(monday, offset * 7)
		const header = await readHeader(page)
		check(`${label} ${name}: h1`, header.h1 === expectedRange(week), header.h1)
		check(`${label} ${name}: period title`, header.title === expectedTitle(week), header.title)
		check(`${label} ${name}: eyebrow ${eyebrow}`, header.eyebrow === eyebrow, header.eyebrow)
		check(`${label} ${name}: columns start on Monday`, header.first === week, header.first)
		check(
			`${label} ${name}: Today ${todayDisabled ? 'disabled' : 'enabled'}`,
			(await today.isDisabled()) === todayDisabled
		)
		check(
			`${label} ${name}: now line ${offset === 0 ? 'shown' : 'hidden'}`,
			header.nowLines === (offset === 0 ? 1 : 0),
			String(header.nowLines)
		)
		check(`${label} ${name}: scroll offset kept`, Math.abs(header.scrollTop - 336) <= 2, String(header.scrollTop))
	}
	await expectWeek('current', 0, 'This week', true)
	const view = await page.getByRole('combobox', { name: 'Calendar view' }).textContent()
	check(`${label} view select shows Week`, view?.trim() === 'Week', view)
	await page.getByRole('button', { name: 'Next week' }).click()
	await settle()
	await expectWeek('next by button', 1, 'Coming weeks', false)
	await page.keyboard.press('k')
	await settle()
	await expectWeek('k once', 0, 'This week', true)
	await page.keyboard.press('k')
	await settle()
	await expectWeek('k twice', -1, 'Past week', false)
	await page.keyboard.press('t')
	await settle()
	await expectWeek('t', 0, 'This week', true)
	await page.keyboard.press('ArrowRight')
	await settle()
	await expectWeek('ArrowRight', 1, 'Coming weeks', false)
	await page.keyboard.press('j')
	await settle()
	await expectWeek('j', 2, 'Coming weeks', false)
	await page.keyboard.press('ArrowLeft')
	await settle()
	await expectWeek('ArrowLeft', 1, 'Coming weeks', false)
	await page.evaluate(() => {
		const input = document.createElement('input')
		input.id = 'probe-input'
		document.body.append(input)
		input.focus()
	})
	await page.keyboard.press('t')
	await page.keyboard.press('j')
	await settle()
	await expectWeek('keys inside an input do nothing', 1, 'Coming weeks', false)
	await page.evaluate(() => document.getElementById('probe-input')?.remove())
	await page.evaluate(() => {
		const dialog = document.createElement('div')
		dialog.setAttribute('role', 'dialog')
		dialog.id = 'probe-dialog'
		document.body.append(dialog)
	})
	await page.keyboard.press('t')
	await settle()
	await expectWeek('keys with a dialog open do nothing', 1, 'Coming weeks', false)
	await page.evaluate(() => document.getElementById('probe-dialog')?.remove())
	await page.keyboard.press('t')
	await settle()
	await expectWeek('t after the probes', 0, 'This week', true)
	await page.keyboard.press('Control+t')
	await settle()
	await expectWeek('modifier ignored', 0, 'This week', true)
}

async function readCorner(page) {
	return page.evaluate(() => ({
		corner: Array.from(document.querySelectorAll('[data-slot="week-grid-corner"] span')).map(
			(element) => element.textContent
		),
		gutter8: Array.from(
			document.querySelectorAll('[data-slot="week-grid-gutter"] > div')[8]?.querySelectorAll('span') ?? []
		).map((element) => element.textContent),
		stored: localStorage.getItem('dv-lab.schedule.second-zone'),
	}))
}

function zoneOffset(zone, at) {
	const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
		.formatToParts(at)
		.find((part) => part.type === 'timeZoneName').value
	const match = /^GMT([+-])(\d+)(?::(\d+))?$/.exec(name)
	if (!match) return 0
	const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0)
	return match[1] === '-' ? -minutes : minutes
}

function berlinFacts(monday) {
	const instant = core.zonedInstant(monday, '08:00', VN)
	const hour = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Berlin',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(instant)
	const noon = core.zonedInstant(monday, '12:00', VN)
	const year = Number(monday.slice(0, 4))
	const standard = Math.min(
		zoneOffset('Europe/Berlin', new Date(Date.UTC(year, 0, 1))),
		zoneOffset('Europe/Berlin', new Date(Date.UTC(year, 6, 1)))
	)
	const label = zoneOffset('Europe/Berlin', noon) > standard ? 'CEST' : 'CET'
	return { hour, label }
}

async function framePart3(page, label, requests) {
	const button = page.locator('[aria-label="Second time zone"]')
	const search = page.getByPlaceholder('Search time zones')
	const options = page.getByRole('option')
	const nowVn = expectedNow()
	const monday = core.mondayOf(nowVn.date)
	check(
		`${label} zone button caption is MSK`,
		(await button.textContent())?.trim() === 'MSK',
		await button.textContent()
	)
	await button.click()
	await search.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	const first = await options.first().textContent()
	check(`${label} popup first row is None`, first?.startsWith('None') && first.includes('Hide the second zone'), first)
	const count = await options.count()
	check(`${label} popup lists many zones`, count > 100, String(count))
	const geometry = await page.evaluate(() => {
		const input = document.querySelector('input[placeholder="Search time zones"]')
		let node = input
		while (node && Math.abs(node.getBoundingClientRect().width - 280) > 1.5) node = node.parentElement
		const button = document.querySelector('[aria-label="Second time zone"]')
		if (!node || !button) return null
		const popup = node.getBoundingClientRect()
		const trigger = button.getBoundingClientRect()
		const fade = document.querySelector('[role="listbox"]')?.closest('[data-slot="scroll-area-viewport"]')
		const style = fade ? getComputedStyle(fade) : null
		const rows = Array.from(document.querySelectorAll('[role="option"]'))
			.slice(0, 3)
			.map((row) => row.getBoundingClientRect().height)
		return {
			width: popup.width,
			gap: popup.top - trigger.bottom,
			right: popup.right - trigger.right,
			fadeClass: fade?.classList.contains('scroll-fade'),
			fadeSize: style?.getPropertyValue('--scroll-fade-size').trim(),
			rows,
			background: getComputedStyle(node).backgroundColor,
		}
	})
	check(
		`${label} popup is 280px wide`,
		geometry !== null && Math.abs(geometry.width - 280) <= 1.5,
		JSON.stringify(geometry)
	)
	check(
		`${label} popup sits 4px under the button`,
		geometry !== null && Math.abs(geometry.gap - 4) <= 2,
		String(geometry?.gap)
	)
	check(
		`${label} popup is right-aligned to the button`,
		geometry !== null && Math.abs(geometry.right) <= 2,
		String(geometry?.right)
	)
	check(
		`${label} popup rows are 28px`,
		geometry !== null && geometry.rows.every((height) => Math.abs(height - 28) <= 0.6),
		String(geometry?.rows)
	)
	check(
		`${label} popup list fades at 24px`,
		geometry?.fadeClass === true && geometry.fadeSize === '24px',
		`${geometry?.fadeClass}/${geometry?.fadeSize}`
	)
	await shot(page, 'sched-frame', 'zone-popup')
	const texts = await options.allTextContents()
	check(
		`${label} list has no Vietnam zone`,
		!texts.some((text) => text.includes('Asia/Ho_Chi_Minh') || text.includes('Asia/Saigon'))
	)
	check(
		`${label} list has Europe/Berlin and Asia/Kolkata`,
		texts.some((text) => text.startsWith('Europe/Berlin')) && texts.some((text) => text.startsWith('Asia/Kolkata'))
	)
	await search.fill('zzz')
	await page.waitForTimeout(300)
	const empty = await page.getByText('No time zones found').isVisible()
	const hint = await page.getByText('Try a city, a country or an abbreviation like CET.').isVisible()
	check(`${label} empty result copy`, empty && hint)
	await shot(page, 'sched-frame', 'zone-empty')
	await search.fill('saigon')
	await page.waitForTimeout(300)
	check(`${label} Saigon is not offered`, (await options.count()) === 0)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(500)
	check(
		`${label} Esc closes the popup only`,
		(await search.count()) === 0 && page.url().endsWith('/schedule') && (await page.locator('h1').count()) === 1
	)

	await button.click()
	await search.fill('berl')
	await page.waitForTimeout(300)
	const berlin = await options.allTextContents()
	check(`${label} search berl finds Berlin first`, berlin[0]?.startsWith('Europe/Berlin'), berlin[0])
	await search.press('Enter')
	await page.waitForTimeout(400)
	const facts = berlinFacts(monday)
	check(
		`${label} button shows the Berlin label`,
		(await button.textContent())?.trim() === facts.label,
		await button.textContent()
	)
	let state = await readCorner(page)
	check(
		`${label} corner shows the short label`,
		state.corner.join(' ') === `${facts.label} VN`,
		state.corner.join(' ')
	)
	check(
		`${label} 08:00 VN is ${facts.hour} in Berlin`,
		state.gutter8.join(' ') === `${facts.hour} 08:00`,
		state.gutter8.join(' ')
	)
	check(`${label} choice is stored`, state.stored === 'Europe/Berlin', state.stored)
	for (let step = 0; step < 3; step += 1) await page.getByRole('button', { name: 'Next week' }).click()
	await page.waitForTimeout(300)
	const later = core.addDays(monday, 21)
	const laterFacts = berlinFacts(later)
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 15000 })
	state = await readCorner(page)
	check(
		`${label} label follows the Monday of the week`,
		(await button.textContent())?.trim() === laterFacts.label && state.corner[0] === laterFacts.label,
		`${await button.textContent()} ${state.corner.join(' ')}`
	)
	check(
		`${label} gutter follows the Monday of the week`,
		state.gutter8.join(' ') === `${laterFacts.hour} 08:00`,
		state.gutter8.join(' ')
	)
	for (let step = 0; step < 3; step += 1) await page.getByRole('button', { name: 'Previous week' }).click()

	await button.click()
	await search.waitFor({ timeout: 10000 })
	await options.first().click()
	await page.waitForTimeout(400)
	state = await readCorner(page)
	check(
		`${label} None: button says No second zone`,
		(await button.textContent())?.trim() === 'No second zone',
		await button.textContent()
	)
	check(`${label} None: corner has only VN`, state.corner.join(' ') === 'VN', state.corner.join(' '))
	check(`${label} None: one label per hour`, state.gutter8.join(' ') === '08:00', state.gutter8.join(' '))
	check(`${label} None: stored as none`, state.stored === 'none', state.stored)
	await shot(page, 'sched-frame', 'zone-none')
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(300)
	state = await readCorner(page)
	check(
		`${label} None survives a reload`,
		(await button.textContent())?.trim() === 'No second zone' && state.corner.join(' ') === 'VN',
		`${await button.textContent()} ${state.corner.join(' ')}`
	)

	for (const bad of ['not-a-zone', 'Asia/Saigon', 'Asia/Ho_Chi_Minh', '']) {
		await page.evaluate((value) => localStorage.setItem('dv-lab.schedule.second-zone', value), bad)
		await page.reload()
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
		await page.waitForTimeout(300)
		state = await readCorner(page)
		check(
			`${label} stored "${bad}" falls back to MSK`,
			(await button.textContent())?.trim() === 'MSK' && state.corner.join(' ') === 'MSK VN',
			`${await button.textContent()} ${state.corner.join(' ')}`
		)
	}
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	const writes = requests.filter((request) => request.method !== 'GET')
	check(
		`${label} the choice reaches no api (no write requests)`,
		writes.length === 0,
		writes
			.map((request) => `${request.method} ${request.url}`)
			.slice(0, 2)
			.join(' | ')
	)
}

async function frame() {
	const { browser, page, problems } = await launch()
	const requests = []
	page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }))
	try {
		await setTheme(page)
		await signIn(page)
		requests.length = 0
		await openSchedule(page)
		await framePart1(page, 'frame')
		await shot(page, 'sched-frame', 'week')
		await framePart2(page, 'frame')
		await shot(page, 'sched-frame', 'toolbar')
		await framePart3(page, 'frame', requests)
		await page.setViewportSize({ width: 1920, height: 1080 })
		await page.waitForTimeout(400)
		const tall = await page.evaluate(() => {
			const viewport = document.querySelector('h1')?.closest('[data-slot="scroll-area-viewport"]')
			const grid = document.querySelector('[data-slot="week-grid"]')?.getBoundingClientRect()
			return {
				scroll: viewport?.scrollHeight,
				client: viewport?.clientHeight,
				bottom: grid?.bottom,
				innerHeight: window.innerHeight,
			}
		})
		check('1080px high: no second page scroll', tall.scroll <= tall.client + 1, JSON.stringify(tall))
		check('1080px high: the grid ends above the bottom edge', tall.bottom <= tall.innerHeight - 8, JSON.stringify(tall))
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

async function frameNewYork() {
	const at = new Date('2026-10-11T19:00:00Z')
	const { browser, page, problems } = await launch({ timezoneId: 'America/New_York' })
	try {
		await setTheme(page)
		await page.clock.setFixedTime(at)
		await signIn(page)
		await openSchedule(page)
		const zone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
		check('New York: browser zone is America/New_York', zone === 'America/New_York', zone)
		await framePart1(page, 'New York', at)
		await framePart2(page, 'New York', at)
		await shot(page, 'sched-frame', 'new-york')
		check('New York: no console problems', problems.length === 0, problems.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
	}
}

const READ_LIKE = 'Alex Example 2007%'
const NAME_A = 'Alex Example 2007 A'
const NAME_B = 'Alex Example 2007 B'

function quote(value) {
	return `'${String(value).replace(/'/g, "''")}'`
}

function whenText(date, time) {
	return core.zonedInstant(date, time, VN).toISOString()
}

function weeksFrom(left, right) {
	return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 604800000)
}

function dayMonth(date) {
	return `${dayNum(date)} ${monthName(date)}`
}

async function createCard(page, name, minutes, goals) {
	const result = await api(page, 'POST', '/students', {
		displayName: name,
		rateMinor: null,
		currency: null,
		defaultLessonMinutes: minutes,
		parent: null,
		level: null,
		goals,
		timeZone: null,
	})
	check(`${name} card created`, result.status === 201, String(result.status))
	return result.json.student.id
}

async function readFixtures(page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const a = await createCard(page, NAME_A, 60, 'Prepare for a speaking test')
	const b = await createCard(page, NAME_B, 30, null)
	const series = await api(page, 'POST', '/schedule/lessons', {
		studentId: a,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	check('series A created', series.status === 201 && Boolean(series.json?.series?.id), String(series.status))
	const single = await api(page, 'POST', '/schedule/lessons', {
		studentId: b,
		date: wednesday,
		startTime: '18:30',
		durationMinutes: 60,
		repeats: 'once',
	})
	check('single B on the same Wednesday created', single.status === 201, String(single.status))
	const thursday = core.addDays(wednesday, 1)
	const short = await api(page, 'POST', '/schedule/lessons', {
		studentId: b,
		date: thursday,
		startTime: '09:00',
		durationMinutes: 30,
		repeats: 'once',
	})
	check('short single B on Thursday created', short.status === 201, String(short.status))
	const seriesId = series.json.series.id
	const movedFrom = core.addDays(wednesday, 7)
	const movedTo = core.addDays(wednesday, 9)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(movedFrom)}, 'moved', ${quote(whenText(movedTo, '10:00'))}, 60)`
	)
	const cancelledOn = core.addDays(wednesday, 14)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind) values (${quote(seriesId)}, ${quote(cancelledOn)}, 'cancelled')`
	)
	const farFrom = core.addDays(wednesday, 21)
	const farTo = core.addDays(wednesday, 26)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(farFrom)}, 'moved', ${quote(whenText(farTo, '11:00'))}, 60)`
	)
	const pastDate = core.addDays(today, -1)
	const past = await api(page, 'POST', '/schedule/lessons', {
		studentId: b,
		date: pastDate,
		startTime: '10:00',
		durationMinutes: 60,
		repeats: 'once',
	})
	check('past single B created', past.status === 201, String(past.status))
	return {
		today,
		a,
		b,
		seriesId,
		wednesday,
		thursday,
		movedFrom,
		movedTo,
		farFrom,
		farTo,
		pastDate,
		cancelledOn,
		week0: core.mondayOf(wednesday),
		week1: core.mondayOf(movedFrom),
		week2: core.mondayOf(cancelledOn),
	}
}

async function goToWeek(page, nav, target) {
	const diff = weeksFrom(nav.monday, target)
	for (let step = 0; step < Math.abs(diff); step += 1) await page.keyboard.press(diff > 0 ? 'j' : 'k')
	nav.monday = target
	await page.waitForFunction(
		(expected) => document.querySelector('[data-slot="week-grid-day"]')?.dataset.date === expected,
		target,
		{ timeout: 30000 }
	)
	await page.waitForTimeout(150)
}

async function readBlocks(page) {
	return page.evaluate(() => {
		const probe = document.createElement('div')
		probe.style.background = 'var(--selected)'
		document.body.append(probe)
		const selected = getComputedStyle(probe).backgroundColor
		probe.remove()
		const columns = Array.from(document.querySelectorAll('[data-slot="week-grid-column"]'))
		const blocks = Array.from(document.querySelectorAll('[data-slot="week-grid-column"] button[data-key]')).map(
			(element) => {
				const column = element.closest('[data-slot="week-grid-column"]')
				const rect = element.getBoundingClientRect()
				const columnRect = column.getBoundingClientRect()
				const style = getComputedStyle(element)
				const name = element.querySelector('span')
				return {
					key: element.dataset.key,
					slot: element.getAttribute('data-slot'),
					label: element.getAttribute('aria-label'),
					text: element.textContent,
					lines: Array.from(element.querySelectorAll('span')).map((span) => span.textContent),
					title: element.getAttribute('title'),
					date: column.dataset.date,
					left: rect.left - columnRect.left,
					width: rect.width,
					top: rect.top - columnRect.top,
					height: rect.height,
					background: style.backgroundColor,
					color: style.color,
					outlineStyle: style.outlineStyle,
					outlineWidth: style.outlineWidth,
					decoration: name ? getComputedStyle(name).textDecorationLine : '',
				}
			}
		)
		return {
			selected,
			transparent: 'rgba(0, 0, 0, 0)',
			columnWidth: columns[0]?.getBoundingClientRect().width ?? 0,
			blocks,
			description: document.querySelector('h1')?.parentElement?.querySelector('div')?.textContent ?? '',
			live: document.querySelector('[aria-live="polite"].sr-only')?.textContent ?? '',
			h1: document.querySelector('h1')?.textContent,
		}
	})
}

const ofCard = (data, name) => data.blocks.filter((block) => block.label.startsWith(`${name},`))

async function shotEvening(page, name) {
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

async function readPart1(page, fx, nav) {
	await goToWeek(page, nav, fx.week0)
	const w0 = await readBlocks(page)
	const a0 = ofCard(w0, NAME_A).find((block) => block.date === fx.wednesday)
	const b0 = ofCard(w0, NAME_B).find((block) => block.date === fx.wednesday)
	const b1 = ofCard(w0, NAME_B).find((block) => block.date === fx.thursday)
	check('week 0: both Wednesday blocks drawn', Boolean(a0) && Boolean(b0))
	check(
		'week 0: overlapping blocks sit side by side',
		Boolean(a0 && b0) &&
			a0.left !== b0.left &&
			Math.abs(a0.width - (w0.columnWidth / 2 - 6)) <= 1.5 &&
			Math.abs(b0.width - (w0.columnWidth / 2 - 6)) <= 1.5,
		a0 && b0 ? `${a0.left}/${b0.left}/${a0.width}/${w0.columnWidth}` : ''
	)
	check(
		'week 0: block starts at 18:00 with 48px hours',
		Boolean(a0) && Math.abs(a0.top - 18 * 48) <= 1.5 && Math.abs(a0.height - 46) <= 1.5,
		a0 ? `${a0.top}/${a0.height}` : ''
	)
	check(
		'week 0: planned block is filled with --selected',
		Boolean(a0) && a0.background === w0.selected && w0.selected !== w0.transparent,
		a0 ? `${a0.background} / ${w0.selected}` : ''
	)
	check('week 0: block text is not painted in the fill colour', Boolean(a0) && a0.color !== a0.background)
	check(
		'week 0: aria-label says planned',
		Boolean(a0) && a0.label.endsWith(', planned') && a0.label.includes('18:00–19:00 VN'),
		a0?.label
	)
	check(
		'week 0: second zone is in brackets in the label',
		Boolean(a0) && a0.label.includes('18:00–19:00 VN (14:00–15:00 MSK), planned'),
		a0?.label
	)
	check(
		'week 0: name line and range line',
		Boolean(a0) && a0.lines.join('|') === `${NAME_A}|18:00–19:00`,
		a0?.lines.join('|')
	)
	check(
		'week 0: no title attribute on blocks',
		w0.blocks.every((block) => block.title === null)
	)
	check(
		'week 0: 30 minute lesson is one line "Name, 09:00"',
		Boolean(b1) && b1.text === `${NAME_B}, 09:00` && b1.lines.length === 1,
		b1?.text
	)
	check(
		'week 0: 30 minute lesson is 22px high',
		Boolean(b1) && Math.abs(b1.height - 22) <= 1.5 && Math.abs(b1.top - 9 * 48) <= 1.5,
		b1 ? `${b1.top}/${b1.height}` : ''
	)
	check(
		'week 0: every fixture block carries data-key and data-slot to',
		[a0, b0, b1].every((block) => block && block.key && block.slot === 'to')
	)
	check(
		'week 0: summary line has the lessons-with-students shape',
		/^\d+ lessons? with \d+ students?( · \d+ cancelled)?$/.test(w0.description),
		w0.description
	)
	const counts = /^(\d+) lessons? with (\d+) students?/.exec(w0.description)
	check(
		'week 0: summary counts the fixture lessons',
		Boolean(counts) && Number(counts[1]) >= 3 && Number(counts[2]) >= 2,
		w0.description
	)
	check(
		'week 0: live line names the week and the lesson count',
		w0.live.startsWith('Week of ') && /, \d+ lessons?$/.test(w0.live),
		w0.live
	)
	await shot(page, 'sched-read', 'week0')

	await goToWeek(page, nav, fx.week1)
	const w1 = await readBlocks(page)
	const from1 = ofCard(w1, NAME_A).find((block) => block.slot === 'from')
	const to1 = ofCard(w1, NAME_A).find((block) => block.slot === 'to' && block.date === fx.movedTo)
	check('week +1: moved original is drawn on Wednesday', Boolean(from1) && from1.date === fx.movedFrom)
	check(
		'week +1: moved original has a dashed outline and no fill',
		Boolean(from1) &&
			from1.outlineStyle === 'dashed' &&
			from1.outlineWidth === '2px' &&
			from1.background === w1.transparent,
		from1 ? `${from1.outlineStyle}/${from1.outlineWidth}/${from1.background}` : ''
	)
	check(
		'week +1: moved original names the new day',
		Boolean(from1) &&
			from1.lines[1] === `→ ${dayMonth(fx.movedTo)}` &&
			from1.label.endsWith(`moved to ${dayMonth(fx.movedTo)}`),
		from1 ? `${from1.lines.join('|')} / ${from1.label}` : ''
	)
	check(
		'week +1: destination is planned on Friday at 10:00',
		Boolean(to1) && Math.abs(to1.top - 10 * 48) <= 1.5 && to1.background === w1.selected && to1.key === from1?.key,
		to1 ? `${to1.top}` : ''
	)
	await shot(page, 'sched-read', 'week1')
	await shotEvening(page, 'week1-evening')

	await goToWeek(page, nav, fx.week2)
	const w2 = await readBlocks(page)
	const cancelled = ofCard(w2, NAME_A).find((block) => block.date === fx.cancelledOn)
	check('week +2: cancelled block is drawn', Boolean(cancelled))
	check(
		'week +2: cancelled block is struck through and has no fill',
		Boolean(cancelled) && cancelled.decoration.includes('line-through') && cancelled.background === w2.transparent,
		cancelled ? `${cancelled.decoration}/${cancelled.background}` : ''
	)
	check(
		'week +2: aria-label says cancelled',
		Boolean(cancelled) && cancelled.label.endsWith(', cancelled'),
		cancelled?.label
	)
	check('week +2: summary shows the cancellation', / · \d+ cancelled$/.test(w2.description), w2.description)

	await shotEvening(page, 'week2-evening')

	const empty = core.addDays(fx.week0, -40 * 7)
	await goToWeek(page, nav, empty)
	const w3 = await readBlocks(page)
	check(
		'far week: no fixture blocks',
		w3.blocks.every((block) => !block.label.includes('Alex Example 2007'))
	)
	check(
		'far week: summary is empty or in shape',
		w3.description === 'No lessons this week' || /^\d+ lessons? with \d+ students?/.test(w3.description),
		w3.description
	)
	await shot(page, 'sched-read', 'far')
}

async function readPart1Loading(page, fx, nav) {
	await goToWeek(page, nav, fx.week1)
	const w1 = await readBlocks(page)
	await goToWeek(page, nav, core.addDays(fx.week0, -7))
	let release
	const held = new Promise((resolve) => {
		release = resolve
	})
	await page.route('**/api/schedule/week*', async (route) => {
		if (route.request().url().includes(`start=${fx.week0}`)) await held
		await route.continue()
	})
	await page.keyboard.press('j')
	nav.monday = fx.week0
	await page.waitForTimeout(150)
	const loading = await page.evaluate(() => ({
		h1: document.querySelector('h1')?.textContent,
		grid: document.querySelectorAll('[data-slot="week-grid"]').length,
		skeleton: document.querySelectorAll('[data-slot="skeleton"]').length,
		next: document.querySelector('button[aria-label="Next week"]')?.disabled,
	}))
	check(
		'loading: real header and a skeleton instead of the grid',
		loading.h1 === expectedRange(fx.week0) && loading.grid === 0 && loading.skeleton > 0,
		JSON.stringify(loading)
	)
	check('loading: week navigation stays enabled', loading.next === false)
	await page.keyboard.press('j')
	nav.monday = fx.week1
	await page.waitForFunction(
		(expected) => document.querySelector('[data-slot="week-grid-day"]')?.dataset.date === expected,
		fx.week1,
		{ timeout: 30000 }
	)
	release()
	await page.waitForTimeout(800)
	const after = await readBlocks(page)
	check(
		'stale week response is ignored',
		after.h1 === expectedRange(fx.week1) && after.description === w1.description && after.live === w1.live,
		`${after.description} / ${w1.description}`
	)
	await page.unroute('**/api/schedule/week*')
}

async function readPartError(page, fx, nav) {
	await goToWeek(page, nav, fx.week0)
	await page.route('**/api/schedule/week*', (route) => route.abort())
	await page.keyboard.press('j')
	nav.monday = fx.week1
	await page.getByText('Could not load schedule').waitFor({ timeout: 15000 })
	const shown = await page.evaluate(() => ({
		h1: document.querySelector('h1')?.textContent,
		refresh: Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.trim() === 'Refresh'),
		grid: document.querySelectorAll('[data-slot="week-grid"]').length,
	}))
	check(
		'read error: h1 is Schedule with a Refresh button and no grid',
		shown.h1 === 'Schedule' && shown.refresh && shown.grid === 0,
		JSON.stringify(shown)
	)
	await shot(page, 'sched-read', 'error')
	await page.unroute('**/api/schedule/week*')
	await page.getByRole('button', { name: 'Refresh' }).click()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 15000 })
	const back = await page.evaluate(() => document.querySelector('h1')?.textContent)
	check('read error: Refresh brings the grid back on the same week', back === expectedRange(fx.week1), back)
}

const MONTHS_LONG = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function fullDate(date) {
	return `${WEEKDAYS_LONG[core.weekdayOf(date) - 1]}, ${dayNum(date)} ${MONTHS_LONG[Number(date.slice(5, 7)) - 1]}`
}

const blockLocator = (page, name, date) =>
	page.locator(`[data-slot="week-grid-column"][data-date="${date}"] button[aria-label^="${name}, "]`).first()

async function pairOf(locator) {
	return locator.evaluate((root) => {
		const main = root.querySelector('[data-slot="time-main"]')
		const second = root.querySelector('[data-slot="time-second"]')
		const style = second ? getComputedStyle(second) : null
		return {
			main: main?.textContent ?? null,
			second: second?.textContent ?? null,
			size: style?.fontSize,
			line: style?.lineHeight,
			muted: second ? second.className.includes('text-muted-foreground') : false,
			numeric: style?.fontVariantNumeric ?? '',
			after: main && second ? Boolean(main.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING) : false,
			stacked: main && second ? second.getBoundingClientRect().top >= main.getBoundingClientRect().bottom - 1 : false,
		}
	})
}

function checkPair(label, pair, main, second) {
	check(`${label}: main line is ${main}`, pair.main === main, String(pair.main))
	if (second === null) {
		check(`${label}: no second line without a second zone`, pair.second === null, String(pair.second))
		return
	}
	check(`${label}: second line is ${second}`, pair.second === second, String(pair.second))
	check(
		`${label}: second line is 11px over 14px`,
		pair.size === '11px' && pair.line === '14px',
		`${pair.size}/${pair.line}`
	)
	check(
		`${label}: second line is muted, tabular and under the main line`,
		pair.muted && pair.numeric.includes('tabular-nums') && pair.after && pair.stacked,
		JSON.stringify(pair)
	)
}

async function tooltipFacts(page) {
	return page.evaluate(() => {
		const content = document.querySelector('[data-slot="event-tooltip"]')
		if (!content) return null
		const surface = content.parentElement
		const style = getComputedStyle(surface)
		const probe = document.createElement('div')
		probe.style.background = 'var(--surface-4)'
		document.body.append(probe)
		const expected = getComputedStyle(probe).backgroundColor
		probe.className = 'rounded-xl'
		const expectedRadius = getComputedStyle(probe).borderTopLeftRadius
		probe.remove()
		return {
			nameWeight: getComputedStyle(content.querySelector('span')).fontWeight,
			expectedRadius,
			text: content.textContent,
			background: style.backgroundColor,
			expected,
			width: surface.getBoundingClientRect().width,
			radius: style.borderTopLeftRadius,
			padding: style.paddingTop,
			shadow: style.boxShadow,
			focusable: surface.querySelector('button, a, input, [tabindex]') !== null,
		}
	})
}

async function readPart2(page, fx, nav) {
	await goToWeek(page, nav, fx.week0)
	const block = blockLocator(page, NAME_A, fx.wednesday)
	await block.scrollIntoViewIfNeeded()
	await block.hover()
	await page.waitForTimeout(90)
	check('tooltip: closed before the 200 ms delay', (await tooltipFacts(page)) === null)
	await page.waitForFunction(() => document.querySelector('[data-slot="event-tooltip"]') !== null, null, {
		timeout: 700,
	})
	await page.waitForTimeout(250)
	const tip = await tooltipFacts(page)
	check('tooltip: opens on mouse hover', tip !== null)
	check(
		'tooltip: name, full date, both zones and the status',
		tip !== null &&
			tip.text.includes(NAME_A) &&
			tip.text.includes(fullDate(fx.wednesday)) &&
			tip.text.includes('18:00–19:00 VN14:00–15:00 MSK') &&
			tip.text.endsWith('Planned'),
		tip?.text
	)
	check('tooltip: the name is semibold', tip !== null && tip.nameWeight === '600', tip?.nameWeight)
	checkPair('tooltip', await pairOf(page.locator('[data-slot="event-tooltip"]')), '18:00–19:00 VN', '14:00–15:00 MSK')
	check(
		'tooltip: surface-4, rounded-xl, p-3, up to 280px, shadow',
		tip !== null &&
			tip.background === tip.expected &&
			tip.radius === tip.expectedRadius &&
			tip.padding === '12px' &&
			tip.width <= 280.5 &&
			tip.shadow !== 'none',
		tip ? `${tip.background}/${tip.radius}/${tip.padding}/${tip.width}` : ''
	)
	check('tooltip: not interactive and not focusable', tip !== null && tip.focusable === false)
	await shot(page, 'sched-read', 'tooltip')
	await page.mouse.move(4, 4)
	await page.waitForTimeout(500)
	check('tooltip: closes when the pointer leaves', (await tooltipFacts(page)) === null)

	await block.hover()
	await page.waitForFunction(() => document.querySelector('[data-slot="event-tooltip"]') !== null, null, {
		timeout: 700,
	})
	await page.locator('[data-slot="week-grid-body"]').evaluate((element) => {
		element.scrollTop += 80
	})
	await page.waitForTimeout(500)
	check('tooltip: closes on grid scroll', (await tooltipFacts(page)) === null)
	await page.locator('[data-slot="week-grid-body"]').evaluate((element) => {
		element.scrollTop -= 80
	})
	await page.mouse.move(4, 4)

	await block.focus()
	await page.waitForTimeout(600)
	check('tooltip: focus does not open it', (await tooltipFacts(page)) === null)
	await block.blur()

	await block.click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	check('dialog: opening it keeps the tooltip closed', (await tooltipFacts(page)) === null)
	const facts = await dialog.evaluate((element) => {
		const link = element.querySelector('a')
		return {
			text: element.textContent,
			href: link?.getAttribute('href'),
			linkText: link?.textContent,
			buttons: Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim()),
			fade: element.querySelector('[data-slot="scroll-area-viewport"]')?.classList.contains('scroll-fade'),
		}
	})
	check(
		'dialog: name is a link to the card',
		facts.href === `/students/${fx.a}` && facts.linkText === NAME_A,
		`${facts.href} ${facts.linkText}`
	)
	check(
		'dialog: description has the date and the Vietnam range',
		facts.text.includes(`${fullDate(fx.wednesday)} · 18:00–19:00 VN`),
		facts.text.slice(0, 160)
	)
	checkPair(
		'dialog header',
		await pairOf(dialog.locator('[data-slot="time-pair"]').first()),
		`${fullDate(fx.wednesday)} · 18:00–19:00 VN`,
		'14:00–15:00 MSK'
	)
	check(
		'dialog: status row says Planned with the card goal',
		facts.text.includes('Planned') && facts.text.includes('· Prepare for a speaking test')
	)
	check(
		'dialog: Length, Repeats and Series rows',
		facts.text.includes('Length60 min') &&
			facts.text.includes('RepeatsEvery Wednesday') &&
			facts.text.includes(`SeriesFrom Wed ${dayNum(fx.wednesday)} ${monthName(fx.wednesday)}`),
		facts.text.slice(0, 260)
	)
	check('dialog: body scrolls with the fade', facts.fade === true)
	check(
		'dialog: a future planned lesson offers Move lesson and Cancel lesson',
		facts.buttons.includes('Move lesson') && facts.buttons.includes('Cancel lesson')
	)
	await shot(page, 'sched-read', 'dialog')
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
	const focused = await page.evaluate(() => ({
		key: document.activeElement?.getAttribute('data-key'),
		slot: document.activeElement?.getAttribute('data-slot'),
	}))
	const expectedKey = await block.getAttribute('data-key')
	check(
		'dialog: Esc closes it and focus returns to the block',
		focused.key === expectedKey && focused.slot === 'to',
		JSON.stringify(focused)
	)

	await goToWeek(page, nav, fx.week1)
	const from = blockLocator(page, NAME_A, fx.movedFrom)
	await from.click()
	await dialog.waitFor({ timeout: 10000 })
	const movedText = await dialog.textContent()
	check(
		'dialog: moved original says Moved and where to',
		/Moved/.test(movedText) && movedText.includes(`moved to ${dayMonth(fx.movedTo)}, 10:00 VN (06:00 MSK)`),
		movedText.slice(0, 200)
	)
	check(
		'dialog: moved original has no Series row confusion (series still shown)',
		movedText.includes('Every Wednesday')
	)
	await dialog.getByRole('button', { name: `moved to ${dayMonth(fx.movedTo)}, 10:00 VN` }).click()
	await page.waitForTimeout(600)
	const toText = await page.getByRole('dialog').textContent()
	check(
		'dialog: the button opens the destination lesson',
		toText.includes('Planned') &&
			toText.includes('10:00–11:00 VN') &&
			toText.includes(`moved from ${dayMonth(fx.movedFrom)}, 18:00 VN (14:00 MSK)`),
		toText.slice(0, 200)
	)
	await page
		.getByRole('dialog')
		.getByRole('button', { name: `moved from ${dayMonth(fx.movedFrom)}, 18:00` })
		.click()
	await page.waitForTimeout(600)
	const backText = await page.getByRole('dialog').textContent()
	check(
		'dialog: and back to the original',
		backText.includes(`moved to ${dayMonth(fx.movedTo)}, 10:00 VN (06:00 MSK)`),
		backText.slice(0, 160)
	)
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })

	await goToWeek(page, nav, core.mondayOf(fx.farFrom))
	await blockLocator(page, NAME_A, fx.farFrom).click()
	await dialog.waitFor({ timeout: 10000 })
	await dialog.getByRole('button', { name: `moved to ${dayMonth(fx.farTo)}, 11:00 VN` }).click()
	await page.waitForFunction(
		(expected) => document.querySelector('[data-slot="week-grid-day"]')?.dataset.date === expected,
		core.mondayOf(fx.farTo),
		{ timeout: 20000 }
	)
	nav.monday = core.mondayOf(fx.farTo)
	await page.getByRole('dialog').waitFor({ timeout: 15000 })
	const crossText = await page.getByRole('dialog').textContent()
	check(
		'dialog: the pair in another week opens after that week loads',
		crossText.includes(`moved from ${dayMonth(fx.farFrom)}, 18:00 VN (14:00 MSK)`) &&
			crossText.includes('11:00–12:00 VN'),
		crossText.slice(0, 200)
	)
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })

	await goToWeek(page, nav, core.mondayOf(fx.pastDate))
	await blockLocator(page, NAME_B, fx.pastDate).click()
	await dialog.waitFor({ timeout: 10000 })
	const pastFacts = await dialog.evaluate((element) => ({
		text: element.textContent,
		buttons: Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim()),
	}))
	check(
		'dialog: a past lesson says it cannot be changed',
		pastFacts.text.includes('This lesson has already taken place and cannot be changed.')
	)
	check(
		'dialog: a past lesson has no Move lesson or Cancel lesson',
		!pastFacts.buttons.some((text) => /Move lesson|Cancel lesson/.test(text ?? ''))
	)
	check(
		'dialog: a single lesson has no Series row',
		!pastFacts.text.includes('Series') && pastFacts.text.includes('RepeatsOnce')
	)
	await shot(page, 'sched-read', 'dialog-past')
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })

	const reopenWeek = async (zone) => {
		await setSecondZone(page, zone)
		await page.reload()
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
		nav.monday = core.mondayOf(fx.today)
		await goToWeek(page, nav, fx.week0)
	}
	await reopenWeek('Pacific/Auckland')
	const lessonStart = new Date(whenText(fx.wednesday, '18:00'))
	const startParts = core.zonedParts(lessonStart, 'Pacific/Auckland')
	const endParts = core.zonedParts(new Date(lessonStart.getTime() + 3600000), 'Pacific/Auckland')
	const dayPrefix =
		startParts.date === core.zonedParts(lessonStart, VN).date ? '' : `${WEEKDAYS[startParts.weekday - 1]} `
	const offsetCaption = expectedSecond(lessonStart.toISOString(), 'Pacific/Auckland').split(' ').pop()
	await blockLocator(page, NAME_A, fx.wednesday).click()
	await dialog.waitFor({ timeout: 10000 })
	check(
		'dialog: another date in the second zone puts the weekday before the whole range',
		(await pairOf(dialog.locator('[data-slot="time-pair"]').first())).second ===
			`${dayPrefix}${startParts.time}–${endParts.time} ${offsetCaption}`,
		`${dayPrefix}${startParts.time}–${endParts.time} ${offsetCaption}`
	)
	check('dialog: that weekday is really shown', dayPrefix !== '', dayPrefix)
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await reopenWeek('none')
	const plain = blockLocator(page, NAME_A, fx.wednesday)
	await plain.scrollIntoViewIfNeeded()
	await plain.hover()
	await page.waitForFunction(() => document.querySelector('[data-slot="event-tooltip"]') !== null, null, {
		timeout: 2000,
	})
	await page.waitForTimeout(250)
	checkPair(
		'tooltip without a second zone',
		await pairOf(page.locator('[data-slot="event-tooltip"]')),
		'18:00–19:00 VN',
		null
	)
	const plainLabel = (await plain.getAttribute('aria-label')) ?? ''
	check(
		'block label without a second zone has no brackets',
		plainLabel.includes('18:00–19:00 VN, planned') && !plainLabel.includes('('),
		plainLabel
	)
	await page.mouse.move(4, 4)
	await plain.click()
	await dialog.waitFor({ timeout: 10000 })
	checkPair(
		'dialog header without a second zone',
		await pairOf(dialog.locator('[data-slot="time-pair"]').first()),
		`${fullDate(fx.wednesday)} · 18:00–19:00 VN`,
		null
	)
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await setSecondZone(page, null)
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
}

const newButton = (page) => page.getByRole('button', { name: 'New lesson', exact: true })

function dayAttr(date) {
	return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}/${date.slice(0, 4)}`
}

async function pickDate(page, date, id = 'new-lesson-date') {
	await page.locator(`#${id}`).click()
	const cell = page.locator(`button[data-day="${dayAttr(date)}"]`).first()
	for (let step = 0; step < 4 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /next month/i }).click()
		await page.waitForTimeout(150)
	}
	for (let step = 0; step < 8 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /previous month/i }).click()
		await page.waitForTimeout(150)
	}
	await cell.click()
	await page.waitForTimeout(250)
}

async function pickTime(page, time, id = 'new-lesson-time') {
	await page.locator(`#${id}`).click()
	await page
		.getByRole('listbox', { name: 'Hours' })
		.getByRole('option', { name: time.slice(0, 2), exact: true })
		.click()
	await page
		.getByRole('listbox', { name: 'Minutes' })
		.getByRole('option', { name: time.slice(3), exact: true })
		.click()
	await page.getByRole('button', { name: 'Done' }).click()
	await page.waitForTimeout(250)
}

async function pickOption(page, triggerId, name) {
	const option = page.getByRole('option', { name, exact: true })
	for (let attempt = 0; attempt < 3; attempt += 1) {
		await page
			.getByRole('listbox')
			.waitFor({ state: 'detached', timeout: 4000 })
			.catch(() => {})
		await page.locator(`#${triggerId}`).click()
		const shown = await option
			.waitFor({ state: 'visible', timeout: 3000 })
			.then(() => true)
			.catch(() => false)
		if (shown) break
		await page.waitForTimeout(500)
	}
	await option.click()
	await page.waitForTimeout(250)
}

async function dialogFacts(page) {
	return page.getByRole('dialog').evaluate((element) => {
		const read = (id) => element.querySelector(`#${id}`)
		return {
			text: element.textContent,
			dateLabel: read('new-lesson-date')?.getAttribute('aria-label'),
			time: read('new-lesson-time')?.textContent?.trim(),
			length: element.querySelector('#new-lesson-length')?.value,
			student: read('new-lesson-student')?.textContent?.trim(),
			repeats: read('new-lesson-repeats')?.textContent?.trim(),
			zone: element.querySelector('[data-slot="new-lesson-zone"]')?.textContent,
			repeatNote: element.querySelector('[data-slot="new-lesson-repeat-note"]')?.textContent,
			overlap: element.querySelector('[data-slot="new-lesson-overlap"]')?.textContent ?? null,
			submit: Array.from(element.querySelectorAll('button[type="submit"]')).map((button) => ({
				text: button.textContent?.trim(),
				disabled: button.disabled,
			}))[0],
			focusId: document.activeElement?.id,
			bodyFade: element.querySelector('[data-slot="scroll-area-viewport"]')?.classList.contains('scroll-fade'),
		}
	})
}

async function readPart3(page, fx, nav) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, fx.week0)
	check('new lesson: the button is in the page header and enabled', await newButton(page).isEnabled())
	check(
		'new lesson: the button sits in the header actions, not in the toolbar',
		await page.evaluate(() => {
			const button = Array.from(document.querySelectorAll('button')).find(
				(node) => node.textContent?.trim() === 'New lesson'
			)
			return Boolean(button?.closest('header')) && !button?.closest('[data-slot="schedule-toolbar"]')
		})
	)
	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	const nowVn = core.zonedParts(new Date(), VN)
	const nextHour = Math.floor(nowVn.minutes / 60) + 1
	const expectedDate = nextHour >= 24 ? core.addDays(nowVn.date, 1) : nowVn.date
	const expectedTime = nextHour >= 24 ? '00:00' : `${String(nextHour).padStart(2, '0')}:00`
	let facts = await dialogFacts(page)
	check(
		'new lesson: title and description',
		facts.text.includes('New lesson') && facts.text.includes('Add a lesson to the schedule. Times are in Vietnam time.')
	)
	check('new lesson: focus starts on Student', facts.focusId === 'new-lesson-student', facts.focusId)
	check('new lesson: Student is empty', facts.student === 'Choose a student', facts.student)
	check(
		'new lesson: defaults are the next whole hour in Vietnam time',
		facts.dateLabel ===
			`Date: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${expectedDate}T12:00:00Z`))}` &&
			facts.time === expectedTime,
		`${facts.dateLabel} ${facts.time}`
	)
	check(
		'new lesson: Length starts at 60 with the card hint',
		facts.length === '60' && facts.text.includes("Taken from the student's usual lesson length. 15 to 240 minutes.")
	)
	check(
		'new lesson: Repeats defaults to Once and the button reads Add lesson',
		facts.repeats === 'Once' && facts.submit?.text === 'Add lesson',
		`${facts.repeats} ${facts.submit?.text}`
	)
	check('new lesson: the dialog body has the scroll fade', facts.bodyFade === true)
	await shot(page, 'sched-read', 'new-lesson')

	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'new lesson: empty Student gives an error and keeps focus there',
		facts.text.includes('Choose a student.') && facts.focusId === 'new-lesson-student',
		facts.focusId
	)
	await pickOption(page, 'new-lesson-student', NAME_B)
	facts = await dialogFacts(page)
	check('new lesson: choosing a student fills Length from the card', facts.length === '30', facts.length)
	await pickOption(page, 'new-lesson-student', NAME_A)
	facts = await dialogFacts(page)
	check('new lesson: choosing another student replaces an untouched Length', facts.length === '60', facts.length)
	await page.locator('#new-lesson-length').fill('45')
	await pickOption(page, 'new-lesson-student', NAME_B)
	facts = await dialogFacts(page)
	check(
		'new lesson: an edited Length is never overwritten',
		facts.length === '45' && !facts.text.includes('Taken from'),
		facts.length
	)
	await page.locator('#new-lesson-length').fill('5')
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'new lesson: Length outside 15 to 240 is refused',
		facts.text.includes('Use 15 to 240 minutes.') && facts.focusId === 'new-lesson-length',
		facts.focusId
	)
	await page.locator('#new-lesson-length').fill('60')

	await pickTime(page, '02:00')
	facts = await dialogFacts(page)
	check(
		'new lesson: the second zone is shown under Start time, with the weekday when the date differs',
		facts.zone === `${WEEKDAYS[core.weekdayOf(core.addDays(expectedDate, -1)) - 1]} 22:00 MSK`,
		facts.zone
	)
	await pickTime(page, '14:00')
	facts = await dialogFacts(page)
	check('new lesson: and without a day shift', facts.zone === '10:00 MSK', facts.zone)
	await page.locator('#new-lesson-time').click()
	const listFade = await page.evaluate(() => {
		const list = document.querySelector('[data-slot="time-picker-column-list"]')
		return list
			? {
					fade: list.classList.contains('scroll-fade'),
					size: getComputedStyle(list).getPropertyValue('--scroll-fade-size').trim(),
				}
			: null
	})
	check(
		'new lesson: Start time columns fade at 24px',
		listFade?.fade === true && listFade.size === '24px',
		JSON.stringify(listFade)
	)
	await shot(page, 'sched-read', 'time-picker')
	await page.getByRole('button', { name: 'Done' }).click()
	await page.waitForTimeout(250)
	await page.getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
	check(
		'new lesson: closing returns focus to the New lesson button',
		await page.evaluate(() => document.activeElement?.textContent?.trim() === 'New lesson')
	)

	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await pickOption(page, 'new-lesson-student', NAME_A)
	await pickDate(page, fx.thursday)
	await pickTime(page, '14:00')
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.getByText('Lesson added', { exact: true }).waitFor({ timeout: 15000 })
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	const toast = await page.getByText('Lesson added', { exact: true }).locator('xpath=..').textContent()
	check(
		'new lesson: toast names the card and the time',
		toast.includes(
			`${NAME_A}, ${new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${fx.thursday}T12:00:00Z`))} ${dayMonth(fx.thursday)}, 14:00 VN.`
		),
		toast
	)
	await page.waitForTimeout(500)
	const created = await blockLocator(page, NAME_A, fx.thursday).evaluate((element) => ({
		top:
			element.getBoundingClientRect().top -
			element.closest('[data-slot="week-grid-column"]').getBoundingClientRect().top,
		label: element.getAttribute('aria-label'),
	}))
	check(
		'new lesson: the new block stands in Thursday at 14:00 after the reload',
		Math.abs(created.top - 14 * 48) <= 1.5,
		JSON.stringify(created)
	)
	check(
		'new lesson: closing after success returns focus to the button',
		await page.evaluate(() => document.activeElement?.textContent?.trim() === 'New lesson')
	)
	await shot(page, 'sched-read', 'after-add')

	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await pickOption(page, 'new-lesson-student', NAME_A)
	await pickOption(page, 'new-lesson-repeats', 'Every week')
	await pickDate(page, fx.week1)
	await pickTime(page, '09:00')
	facts = await dialogFacts(page)
	check(
		'new lesson: Every week shows the series note and Add series',
		facts.repeatNote === 'Every Monday at 09:00 VN until you end the series.' && facts.submit?.text === 'Add series',
		`${facts.repeatNote} ${facts.submit?.text}`
	)
	await shot(page, 'sched-read', 'new-series')
	await pickDate(page, fx.pastDate)
	await dialog.getByRole('button', { name: 'Add series' }).click()
	await page.waitForTimeout(300)
	facts = await dialogFacts(page)
	check(
		'new lesson: a repeating lesson in the past is refused under Date',
		facts.text.includes('Choose today or a later date for a repeating lesson.') && facts.focusId === 'new-lesson-date',
		facts.focusId
	)
	await pickDate(page, fx.week1)
	await dialog.getByRole('button', { name: 'Add series' }).click()
	await page.getByText('Series added', { exact: true }).waitFor({ timeout: 15000 })
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	const seriesToast = await page.getByText('Series added', { exact: true }).locator('xpath=..').textContent()
	check(
		'new lesson: series toast names the weekday and time',
		seriesToast.includes(`${NAME_A} every Monday at 09:00.`),
		seriesToast
	)
	for (const monday of [fx.week1, fx.week2]) {
		await goToWeek(page, nav, monday)
		const found = await blockLocator(page, NAME_A, monday).count()
		check(`new lesson: the series shows on Monday of week ${monday}`, found === 1, String(found))
	}

	await goToWeek(page, nav, fx.week0)
	const column = page.locator(`[data-slot="week-grid-column"][data-date="${fx.wednesday}"]`)
	await column.click({ position: { x: 12, y: 15 * 48 + 6 } })
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await dialogFacts(page)
	check(
		'new lesson: a click on empty space opens the dialog on that day and time',
		facts.dateLabel?.includes(`${monthName(fx.wednesday)} ${dayNum(fx.wednesday)}, `) &&
			facts.time === '15:00' &&
			facts.student === 'Choose a student',
		`${facts.dateLabel} ${facts.time}`
	)
	await pickOption(page, 'new-lesson-student', NAME_A)
	await pickTime(page, '18:00')
	facts = await dialogFacts(page)
	check(
		'new lesson: overlapping lessons give a warning with both names',
		facts.overlap !== null &&
			facts.overlap.includes('This overlaps another lesson') &&
			facts.overlap.includes(`${NAME_A} 18:00–19:00 VN`) &&
			facts.overlap.includes(`${NAME_B} 18:30–19:30 VN`) &&
			facts.overlap.includes('You can still save.'),
		facts.overlap ?? 'no banner'
	)
	check('new lesson: the warning never disables saving', facts.submit?.disabled === false)
	await shot(page, 'sched-read', 'overlap')
	await pickTime(page, '16:00')
	facts = await dialogFacts(page)
	check('new lesson: the warning goes away with the overlap', facts.overlap === null)
	await pickTime(page, '18:00')
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.getByText('Lesson added', { exact: true }).last().waitFor({ timeout: 15000 })
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(500)
	const stacked = await page
		.locator(`[data-slot="week-grid-column"][data-date="${fx.wednesday}"] button[aria-label^="${NAME_A}, "]`)
		.count()
	check('new lesson: the overlapping lesson was saved', stacked >= 2, String(stacked))

	await page.route('**/api/schedule/lessons', (route) =>
		route.request().method() === 'POST' ? route.abort() : route.continue()
	)
	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await pickOption(page, 'new-lesson-student', NAME_B)
	await dialog.getByRole('button', { name: 'Add lesson' }).click()
	await page.getByText('Could not add the lesson. Try again.').waitFor({ timeout: 15000 })
	facts = await dialogFacts(page)
	check(
		'new lesson: a server failure keeps the dialog and the values',
		facts.student === NAME_B && facts.submit?.disabled === false,
		facts.student
	)
	await page.unroute('**/api/schedule/lessons')
	await page.getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })

	await page.route('**/api/students', async (route) => {
		await new Promise((resolve) => setTimeout(resolve, 2500))
		await route.continue()
	})
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(300)
	check('new lesson: the button is disabled while students load', await newButton(page).isDisabled())
	await page.waitForFunction(
		() => {
			const button = Array.from(document.querySelectorAll('button')).find(
				(node) => node.textContent?.trim() === 'New lesson'
			)
			return button && !button.disabled
		},
		null,
		{ timeout: 15000 }
	)
	check('new lesson: and enabled once they are loaded', await newButton(page).isEnabled())
	await page.unroute('**/api/students')

	await page.route('**/api/students', (route) => route.abort())
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(800)
	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	facts = await dialogFacts(page)
	check(
		'new lesson: students that fail to load give a banner and no Add',
		facts.text.includes('Could not load students. Close this window and try again.') && facts.submit?.disabled === true
	)
	await shot(page, 'sched-read', 'students-error')
	await page.keyboard.press('Escape')
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.unroute('**/api/students')
	nav.monday = core.mondayOf(fx.today)
}

async function read() {
	cleanupFixtures('read start', READ_LIKE)
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		await setTheme(page)
		await signIn(page)
		const fx = await readFixtures(page)
		await openSchedule(page)
		const nav = { monday: core.mondayOf(fx.today) }
		await readPart1(page, fx, nav)
		await readPart1Loading(page, fx, nav)
		await readPartError(page, fx, nav)
		await readPart2(page, fx, nav)
		await readPart3(page, fx, nav)
		const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
		check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
		cleanupFixtures('read end', READ_LIKE)
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_READ_OK')
}

const CHANGES_LIKE = 'Alex Example 2008%'
const CH_A = 'Alex Example 2008 A'
const CH_B = 'Alex Example 2008 B'
const CH_C = 'Alex Example 2008 C'
const CH_D = 'Alex Example 2008 D'

function shortDay(date) {
	return `${WEEKDAYS[core.weekdayOf(date) - 1]} ${dayMonth(date)}`
}

const slotLocator = (page, name, date, slot = 'to') =>
	page
		.locator(`[data-slot="week-grid-column"][data-date="${date}"] button[data-slot="${slot}"][aria-label^="${name}, "]`)
		.first()

async function changesFixtures(page) {
	const today = core.zonedParts(new Date(), VN).date
	const wed = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const a = await createCard(page, CH_A, 60, null)
	const b = await createCard(page, CH_B, 60, null)
	const startsOn = core.addDays(wed, -21)
	const inserted = sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on) values (${quote(a)}, 3, '18:00', 60, ${quote(startsOn)}) returning id`
	)
	check('series A with past lessons created through sql', inserted.rowCount === 1)
	const single = await api(page, 'POST', '/schedule/lessons', {
		studentId: b,
		date: wed,
		startTime: '12:00',
		durationMinutes: 60,
		repeats: 'once',
	})
	check('single B created through the api', single.status === 201, String(single.status))
	return {
		today,
		a,
		b,
		seriesId: inserted.rows?.[0]?.id,
		startsOn,
		wed,
		thursday: core.addDays(wed, 1),
		friday: core.addDays(wed, 2),
		pastWed: core.addDays(wed, -14),
		staleWed: core.addDays(wed, 7),
		laterWed: core.addDays(wed, 14),
	}
}

async function pastSnapshot(page, fx) {
	const lines = []
	for (const monday of [core.mondayOf(fx.startsOn), core.mondayOf(fx.pastWed)]) {
		const result = await api(page, 'GET', `/schedule/week?start=${monday}`)
		for (const block of result.json?.blocks ?? []) {
			if (block.studentId !== fx.a) continue
			lines.push(
				[block.key, block.startsAt, block.durationMinutes, block.status, block.movedTo, block.movedFrom].join('|')
			)
		}
	}
	return lines.sort()
}

async function dialogButtons(page) {
	return page
		.getByRole('dialog')
		.evaluate((element) => Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim()))
}

async function toastText(page, title, expected = '') {
	const found = await page
		.waitForFunction(
			({ title, expected }) =>
				Array.from(document.querySelectorAll('*'))
					.filter((node) => node.childElementCount === 0 && node.textContent === title)
					.map((node) => node.parentElement?.textContent ?? '')
					.find((text) => text.includes(expected)) ?? false,
			{ title, expected },
			{ timeout: 15000 }
		)
		.then((handle) => handle.jsonValue())
		.catch(() => null)
	if (found !== null) return found
	return (
		(await page
			.getByText(title, { exact: true })
			.last()
			.locator('xpath=..')
			.textContent()
			.catch(() => '')) ?? ''
	)
}

async function waitBlock(page, name, date, slot, fragment) {
	return page
		.waitForFunction(
			({ name, date, slot, fragment }) => {
				const element = document.querySelector(
					`[data-slot="week-grid-column"][data-date="${date}"] button[data-slot="${slot}"][aria-label^="${name}, "]`
				)
				return (element?.getAttribute('aria-label') ?? '').includes(fragment)
			},
			{ name, date, slot, fragment },
			{ timeout: 15000 }
		)
		.then(() => true)
		.catch(() => false)
}

async function blockFacts(page, name, date, slot = 'to') {
	const data = await readBlocks(page)
	return { data, block: ofCard(data, name).find((block) => block.date === date && block.slot === slot) ?? null }
}

async function closeDialog(page) {
	await page.keyboard.press('Escape')
	await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)
}

async function focusedBlock(page) {
	return page.evaluate(() => ({
		key: document.activeElement?.getAttribute('data-key') ?? null,
		slot: document.activeElement?.getAttribute('data-slot') ?? null,
		date: document.activeElement?.closest('[data-slot="week-grid-column"]')?.getAttribute('data-date') ?? null,
		tag: document.activeElement?.tagName ?? null,
	}))
}

async function changesPart1(page, fx, nav, posts) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, core.mondayOf(fx.wed))
	await slotLocator(page, CH_A, fx.wed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	let buttons = await dialogButtons(page)
	check(
		'cancel: a future planned lesson has Move lesson and Cancel lesson in the footer',
		buttons.includes('Move lesson') && buttons.includes('Cancel lesson'),
		buttons.join('|')
	)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await page.waitForTimeout(250)
	const question = dialog.locator('[data-slot="lesson-cancel-question"]')
	const asked = await question.evaluate((element) => ({
		text: element.textContent,
		role: element.getAttribute('role'),
	}))
	check(
		'cancel: the footer asks with the date and time',
		asked.text.includes(`Cancel the lesson on ${dayMonth(fx.wed)} at 18:00 VN (14:00 MSK)?`) && asked.role === 'alert',
		asked.text
	)
	buttons = await dialogButtons(page)
	check(
		'cancel: the question offers Keep and Yes, cancel instead of the buttons',
		buttons.includes('Keep') && buttons.includes('Yes, cancel') && !buttons.includes('Move lesson'),
		buttons.join('|')
	)
	await shot(page, 'sched-changes', 'cancel-question')
	await dialog.getByRole('button', { name: 'Keep', exact: true }).click()
	await page.waitForTimeout(250)
	buttons = await dialogButtons(page)
	check(
		'cancel: Keep brings the buttons back',
		buttons.includes('Move lesson') && buttons.includes('Cancel lesson') && !buttons.includes('Yes, cancel'),
		buttons.join('|')
	)
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	const cancelledToast = await toastText(page, 'Lesson cancelled')
	check(
		'cancel: toast names the lesson',
		cancelledToast.includes(`${CH_A}, ${shortDay(fx.wed)}, 18:00 VN (14:00 MSK).`),
		cancelledToast
	)
	check('cancel: the block turns cancelled on the grid', await waitBlock(page, CH_A, fx.wed, 'to', ', cancelled'))
	let facts = await blockFacts(page, CH_A, fx.wed)
	check(
		'cancel: the block stays, without fill and struck through',
		facts.block !== null &&
			facts.block.background === facts.data.transparent &&
			facts.block.decoration.includes('line-through'),
		facts.block ? `${facts.block.background}/${facts.block.decoration}` : 'no block'
	)
	await page.waitForTimeout(300)
	buttons = await dialogButtons(page)
	const cancelledText = await dialog.textContent()
	check(
		'cancel: the dialog shows the cancelled lesson with Return to schedule',
		cancelledText.includes('Cancelled') && buttons.includes('Return to schedule') && !buttons.includes('Cancel lesson'),
		buttons.join('|')
	)
	await shot(page, 'sched-changes', 'cancelled')
	await dialog.getByRole('button', { name: 'Return to schedule' }).click()
	const restoredToast = await toastText(page, 'Lesson restored')
	check(
		'restore: toast names the lesson',
		restoredToast.includes(`${CH_A}, ${shortDay(fx.wed)}, 18:00 VN (14:00 MSK).`),
		restoredToast
	)
	check('restore: the block is planned again', await waitBlock(page, CH_A, fx.wed, 'to', ', planned'))
	facts = await blockFacts(page, CH_A, fx.wed)
	check(
		'restore: the block is filled again',
		facts.block !== null && facts.block.background === facts.data.selected,
		facts.block?.background
	)
	await page.waitForTimeout(300)
	buttons = await dialogButtons(page)
	check('restore: the dialog offers Move lesson again', buttons.includes('Move lesson'), buttons.join('|'))
	await closeDialog(page)
	const focusA = await focusedBlock(page)
	check(
		'restore: closing returns focus to the block',
		focusA.slot === 'to' && focusA.date === fx.wed && focusA.key === facts.block?.key,
		JSON.stringify(focusA)
	)

	await slotLocator(page, CH_B, fx.wed).click()
	await dialog.waitFor({ timeout: 10000 })
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	const singleToast = await toastText(page, 'Lesson cancelled', CH_B)
	check(
		'single cancel: toast names B',
		singleToast.includes(`${CH_B}, ${shortDay(fx.wed)}, 12:00 VN (08:00 MSK).`),
		singleToast
	)
	check('single cancel: B is cancelled on the grid', await waitBlock(page, CH_B, fx.wed, 'to', ', cancelled'))
	await page.waitForTimeout(300)
	await dialog.getByRole('button', { name: 'Return to schedule' }).click()
	await toastText(page, 'Lesson restored', CH_B)
	check('single restore: B is planned again', await waitBlock(page, CH_B, fx.wed, 'to', ', planned'))
	await closeDialog(page)

	await goToWeek(page, nav, core.mondayOf(fx.staleWed))
	await slotLocator(page, CH_A, fx.staleWed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	const moved = await api(page, 'POST', `/schedule/series/${fx.seriesId}/occurrences/${fx.staleWed}/move`, {
		date: fx.staleWed,
		startTime: '19:00',
	})
	check('stale: the occurrence is moved an hour later behind the dialog', moved.status === 200, String(moved.status))
	const sent = posts.length
	await dialog.getByRole('button', { name: 'Cancel lesson' }).click()
	await dialog.getByRole('button', { name: 'Yes, cancel' }).click()
	const stale = await dialog
		.locator('[data-slot="lesson-stale"]')
		.waitFor({ timeout: 15000 })
		.then(() => dialog.locator('[data-slot="lesson-stale"]').textContent())
		.catch(() => null)
	check(
		'stale: a 409 shows the banner of changed data',
		stale !== null &&
			stale.includes('This lesson was changed elsewhere') &&
			stale.includes('The schedule has been refreshed.'),
		stale ?? 'no banner'
	)
	const request = posts.slice(sent).find((post) => post.url.includes(`/occurrences/${fx.staleWed}/cancel`))
	check(
		'stale: the request carried the start the teacher saw',
		request !== undefined && JSON.parse(request.body ?? '{}').expectedStartsAt === whenText(fx.staleWed, '18:00'),
		request?.body ?? 'no request'
	)
	check(
		'stale: the grid shows the new time after the refresh',
		await waitBlock(page, CH_A, fx.staleWed, 'from', 'moved to')
	)
	facts = await blockFacts(page, CH_A, fx.staleWed)
	check(
		'stale: the destination stands at 19:00',
		facts.block !== null && Math.abs(facts.block.top - 19 * 48) <= 1.5,
		facts.block ? String(facts.block.top) : 'no block'
	)
	const staleText = await dialog.textContent()
	check('stale: the dialog now shows 19:00', staleText.includes('19:00–20:00 VN'), staleText.slice(0, 200))
	await shot(page, 'sched-changes', 'stale')
	await closeDialog(page)

	await goToWeek(page, nav, core.mondayOf(fx.pastWed))
	await slotLocator(page, CH_A, fx.pastWed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	buttons = await dialogButtons(page)
	check(
		'past: no Move lesson and no Cancel lesson',
		!buttons.includes('Move lesson') && !buttons.includes('Cancel lesson'),
		buttons.join('|')
	)
	await closeDialog(page)
}

async function calendarDayState(page, date) {
	const cell = page.locator(`button[data-day="${dayAttr(date)}"]`).first()
	for (let step = 0; step < 3 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /previous month/i }).click()
		await page.waitForTimeout(150)
	}
	if ((await cell.count()) === 0) return null
	return cell.evaluate(
		(element) =>
			element.disabled ||
			element.getAttribute('aria-disabled') === 'true' ||
			element.closest('[aria-disabled="true"], [data-disabled="true"]') !== null
	)
}

async function moveFormFacts(page) {
	const group = page.getByRole('dialog').getByRole('group', { name: 'Move lesson' })
	if ((await group.count()) === 0) return null
	return group
		.evaluate((element) => ({
			text: element.textContent,
			change: element.querySelector('[data-slot="move-lesson-change"]')?.textContent ?? '',
			vn: element.querySelector('[data-slot="move-lesson-vn"]')?.textContent ?? '',
			second: element.querySelector('[data-slot="move-lesson-second"]')?.textContent ?? null,
			secondClass: element.querySelector('[data-slot="move-lesson-second"]')?.className ?? '',
			clash: element.querySelector('[data-slot="move-lesson-clash"]')?.textContent ?? null,
			submit: Array.from(element.querySelectorAll('button')).find(
				(button) => button.textContent?.trim() === 'Move lesson'
			)?.disabled,
		}))
		.catch(() => null)
}

async function changesPart2(page, fx, nav, posts) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, core.mondayOf(fx.wed))
	await slotLocator(page, CH_A, fx.wed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(400)
	let form = await moveFormFacts(page)
	const buttons = await dialogButtons(page)
	check(
		'move: Move lesson opens the form in the dialog body and hides the footer',
		form !== null && !buttons.includes('Cancel lesson'),
		buttons.join('|')
	)
	check(
		'move: the form has New date and Time, VN',
		form !== null && form.text.includes('New date') && form.text.includes('Time, VN')
	)
	check(
		'move: the change line shows was and now in VN, and the same two moments in the second zone',
		form !== null &&
			form.vn === `${shortDay(fx.wed)}, 18:00${shortDay(fx.wed)}, 18:00–19:00 VN` &&
			form.second === `${shortDay(fx.wed)}, 14:00${shortDay(fx.wed)}, 14:00–15:00 MSK`,
		`${form?.vn} | ${form?.second}`
	)
	check(
		'move: the second-zone line is micro and muted',
		form !== null && form.secondClass.includes('text-micro') && form.secondClass.includes('text-muted-foreground'),
		form?.secondClass
	)
	check(
		'move: focus moves into the form',
		await page.evaluate(() => document.activeElement?.id === 'move-lesson-date'),
		await page.evaluate(
			() =>
				`${document.activeElement?.tagName}/${document.activeElement?.getAttribute('role')}/${document.activeElement?.id}`
		)
	)
	await shot(page, 'sched-changes', 'move-form')
	await dialog.getByRole('button', { name: 'Discard changes' }).click()
	await page.waitForTimeout(300)
	const discarded = await dialogButtons(page)
	check(
		'move: Discard changes brings the footer back with focus on Move lesson',
		discarded.includes('Cancel lesson') &&
			(await moveFormFacts(page)) === null &&
			(await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Move lesson')),
		discarded.join('|')
	)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(400)

	await page.locator('#move-lesson-date').click()
	await page.waitForTimeout(300)
	const yesterday = core.addDays(fx.today, -1)
	const yesterdayOff = await calendarDayState(page, yesterday)
	check('move: days before today cannot be picked', yesterdayOff === true, String(yesterdayOff))
	const todayCell = page.locator(`button[data-day="${dayAttr(fx.today)}"]`).first()
	const todayOff = (await todayCell.count()) === 0 ? null : await todayCell.evaluate((element) => element.disabled)
	check('move: today can be picked', todayOff === false || todayOff === null, String(todayOff))
	await shot(page, 'sched-changes', 'move-calendar')
	await page.locator('#move-lesson-date').click()
	await page.waitForTimeout(300)

	const sent = posts.length
	await dialog.getByRole('group', { name: 'Move lesson' }).getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(400)
	form = await moveFormFacts(page)
	check(
		'move: the same time asks for a different date or time',
		form !== null && form.text.includes('Choose a different date or time.'),
		form?.text.slice(0, 200)
	)
	check(
		'move: and sends nothing',
		posts.slice(sent).every((post) => !post.url.includes('/move')),
		String(posts.length - sent)
	)

	await page.locator('#move-lesson-time').click()
	await page.waitForTimeout(250)
	const hour12 = await page
		.getByRole('listbox', { name: 'Hours' })
		.getByRole('option', { name: '12', exact: true })
		.getAttribute('aria-disabled')
	check('move: a taken hour is not disabled in the time list', hour12 !== 'true', String(hour12))
	await page.getByRole('listbox', { name: 'Hours' }).getByRole('option', { name: '12', exact: true }).click()
	await page.getByRole('listbox', { name: 'Minutes' }).getByRole('option', { name: '00', exact: true }).click()
	await page.getByRole('button', { name: 'Done' }).click()
	await page.waitForTimeout(400)
	form = await moveFormFacts(page)
	check(
		'move: a clash shows the lesson already at this time',
		form?.clash === `A lesson is already at this time: ${CH_B} 12:00–13:00 VN`,
		form?.clash ?? 'no clash line'
	)
	check('move: the clash does not disable Move lesson', form?.submit === false, String(form?.submit))
	await shot(page, 'sched-changes', 'move-clash')

	await pickDate(page, fx.friday, 'move-lesson-date')
	await pickTime(page, '10:00', 'move-lesson-time')
	form = await moveFormFacts(page)
	check(
		'move: the change line follows the new date',
		form !== null && form.vn.endsWith(`${shortDay(fx.friday)}, 10:00–11:00 VN`) && form.clash === null,
		form?.change
	)
	await dialog.getByRole('group', { name: 'Move lesson' }).getByRole('button', { name: 'Move lesson' }).click()
	const movedToast = await toastText(page, 'Lesson moved', CH_A)
	check(
		'move: toast names the old and the new time',
		movedToast.includes(`${CH_A}: ${shortDay(fx.wed)}, 18:00 VN to ${shortDay(fx.friday)}, 10:00 VN.`),
		movedToast
	)
	check('move: the destination stands on Friday', await waitBlock(page, CH_A, fx.friday, 'to', ', planned'))
	check('move: the original place is marked moved', await waitBlock(page, CH_A, fx.wed, 'from', 'moved to'))
	await page.waitForTimeout(400)
	const movedText = await dialog.textContent()
	check(
		'move: the dialog shows the lesson at its new place',
		movedText.includes(`moved from ${dayMonth(fx.wed)}, 18:00`) && movedText.includes('10:00–11:00 VN'),
		movedText.slice(0, 200)
	)
	let facts = await blockFacts(page, CH_A, fx.wed, 'from')
	check(
		'move: the original place is dashed and names the new day',
		facts.block !== null &&
			facts.block.outlineStyle === 'dashed' &&
			facts.block.lines[1] === `→ ${dayMonth(fx.friday)}`,
		facts.block ? `${facts.block.outlineStyle}/${facts.block.lines.join('|')}` : 'no block'
	)
	const destination = await blockFacts(page, CH_A, fx.friday, 'to')
	check(
		'move: the destination is at 10:00',
		destination.block !== null && Math.abs(destination.block.top - 10 * 48) <= 1.5,
		destination.block ? String(destination.block.top) : 'no block'
	)
	await shot(page, 'sched-changes', 'moved')
	await closeDialog(page)
	const focus = await focusedBlock(page)
	check(
		'move: after Esc focus is on the destination block',
		focus.slot === 'to' && focus.date === fx.friday && focus.key === facts.block?.key,
		JSON.stringify(focus)
	)

	await slotLocator(page, CH_B, fx.wed).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(300)
	await pickDate(page, fx.thursday, 'move-lesson-date')
	await dialog.getByRole('group', { name: 'Move lesson' }).getByRole('button', { name: 'Move lesson' }).click()
	await toastText(page, 'Lesson moved', CH_B)
	check('single move: B stands on Thursday', await waitBlock(page, CH_B, fx.thursday, 'to', ', planned'))
	await page.waitForTimeout(300)
	facts = await readBlocks(page)
	const leftB = ofCard(facts, CH_B)
	check(
		'single move: no dashed original and nothing left on Wednesday',
		leftB.every((block) => block.slot === 'to' && block.date !== fx.wed),
		leftB.map((block) => `${block.date}/${block.slot}`).join(',')
	)
	await closeDialog(page)

	await goToWeek(page, nav, core.mondayOf(fx.laterWed))
	facts = await blockFacts(page, CH_A, fx.laterWed)
	check(
		'move: a later Wednesday is untouched',
		facts.block !== null && Math.abs(facts.block.top - 18 * 48) <= 1.5 && facts.block.label.endsWith(', planned'),
		facts.block?.label ?? 'no block'
	)
}

function mediumDate(date) {
	return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(
		new Date(`${date}T12:00:00Z`)
	)
}

function appDate(date, today) {
	return date.slice(0, 4) === today.slice(0, 4) ? shortDay(date) : `${shortDay(date)} ${date.slice(0, 4)}`
}

async function seriesBox(page) {
	const box = page.getByRole('dialog').locator('[data-slot="lesson-series"]')
	if ((await box.count()) === 0) return null
	return box.evaluate((element) => ({
		text: element.textContent,
		buttons: Array.from(element.querySelectorAll('button')).map((button) => button.textContent?.trim()),
	}))
}

async function seriesDialogFacts(page) {
	return page.getByRole('dialog').evaluate((element) => ({
		text: element.textContent,
		error: element.querySelector('[data-slot="move-series-error"]')?.textContent ?? null,
		preview: element.querySelector('[data-slot="move-series-preview"]')?.textContent ?? null,
		note: element.querySelector('[data-slot="move-series-note"]')?.textContent ?? null,
		hint: element.querySelector('[data-slot="end-series-hint"]')?.textContent ?? null,
		hintClass: element.querySelector('[data-slot="end-series-hint"]')?.className ?? '',
		from: element.querySelector('#move-series-from')?.getAttribute('aria-label') ?? null,
		last: element.querySelector('#end-series-last')?.getAttribute('aria-label') ?? null,
		dayInvalid: element.querySelector('#move-series-day')?.getAttribute('aria-invalid') ?? null,
		focus: document.activeElement?.textContent?.trim() ?? '',
		focusInside: element.contains(document.activeElement),
	}))
}

async function openBlockDialog(page, name, date, slot = 'to') {
	await slotLocator(page, name, date, slot).click()
	await page.getByRole('dialog').waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
}

async function changesPart3(page, fx, nav, posts, before) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, core.mondayOf(fx.laterWed))
	await openBlockDialog(page, CH_A, fx.laterWed)
	let box = await seriesBox(page)
	check(
		'series: a future lesson of the series has the Whole series box',
		box !== null &&
			box.text.includes('Whole series') &&
			box.text.includes(`Every Wednesday at 18:00 VN · from ${appDate(fx.startsOn, fx.today)}`),
		box?.text
	)
	check(
		'series: the box offers Move series and End series',
		box !== null && box.buttons.includes('Move series') && box.buttons.includes('End series'),
		box?.buttons.join('|')
	)
	const lessonButtons = await dialogButtons(page)
	check(
		'series: the footer keeps the buttons for one lesson',
		lessonButtons.includes('Move lesson') && lessonButtons.includes('Cancel lesson'),
		lessonButtons.join('|')
	)
	await shot(page, 'sched-changes', 'whole-series')
	await closeDialog(page)

	await goToWeek(page, nav, core.mondayOf(fx.pastWed))
	await openBlockDialog(page, CH_A, fx.pastWed)
	check('series: a past lesson has no Whole series box', (await seriesBox(page)) === null)
	await closeDialog(page)
	await goToWeek(page, nav, core.mondayOf(fx.thursday))
	await openBlockDialog(page, CH_B, fx.thursday)
	check('series: a single lesson has no Whole series box', (await seriesBox(page)) === null)
	await closeDialog(page)

	await goToWeek(page, nav, core.mondayOf(fx.laterWed))
	await openBlockDialog(page, CH_A, fx.laterWed)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	check('move series: the lesson dialog is replaced by Move series', (await dialog.count()) === 1)
	let facts = await seriesDialogFacts(page)
	check(
		'move series: title and description',
		facts.text.includes('Move series') && facts.text.includes(`${CH_A}. Now every Wednesday at 18:00 VN (14:00 MSK).`),
		facts.text.slice(0, 120)
	)
	check(
		'move series: From defaults to the nearest future Wednesday',
		facts.from === `From: ${mediumDate(fx.wed)}`,
		facts.from
	)
	check('move series: focus is inside the dialog', facts.focusInside === true, facts.focus)
	check(
		'move series: the note about earlier, moved and cancelled lessons is shown',
		facts.note ===
			'Lessons before this date stay as they are. Lessons you already moved keep their new time. Cancelled lessons from this date on are reset.',
		facts.note
	)
	let sent = posts.length
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check(
		'move series: the same day and time give an error under the row',
		facts.error === 'Choose a different day or time.' && facts.dayInvalid === 'true',
		`${facts.error} ${facts.dayInvalid}`
	)
	check(
		'move series: and nothing is sent',
		posts.slice(sent).every((post) => !post.url.includes(`/series/${fx.seriesId}/move`))
	)
	await pickOption(page, 'move-series-day', 'Thursday')
	await pickTime(page, '17:00', 'move-series-time')
	facts = await seriesDialogFacts(page)
	check(
		'move series: preview of the first lesson',
		facts.preview === `First lesson${appDate(fx.thursday, fx.today)}, 17:00–18:00` && facts.error === null,
		`${facts.preview} ${facts.error}`
	)
	await shot(page, 'sched-changes', 'move-series')
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	const movedToast = await toastText(page, 'Series moved', CH_A)
	check(
		'move series: toast names the new day and the first date',
		movedToast.includes(`${CH_A} now meets on Thursdays at 17:00 from ${appDate(fx.thursday, fx.today)}.`),
		movedToast
	)
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	check(
		'move series: the week shows Thursday 17:00 instead of Wednesday',
		await waitBlock(page, CH_A, core.addDays(fx.laterWed, 1), 'to', '17:00–18:00 VN')
	)
	await page.waitForTimeout(400)
	const focus = await focusedBlock(page)
	check('move series: the gone block hands focus to the page heading', focus.tag === 'H1', JSON.stringify(focus))
	let week = await readBlocks(page)
	check(
		'move series: no Wednesday of A in that week',
		!ofCard(week, CH_A).some((block) => block.date === fx.laterWed),
		ofCard(week, CH_A)
			.map((block) => block.date)
			.join(',')
	)
	await goToWeek(page, nav, core.mondayOf(fx.wed))
	week = await readBlocks(page)
	const friday = ofCard(week, CH_A).find((block) => block.date === fx.friday)
	const thursday = ofCard(week, CH_A).find((block) => block.date === fx.thursday)
	check(
		'move series: the lesson moved in part 2 stays on Friday 10:00',
		friday !== undefined && Math.abs(friday.top - 10 * 48) <= 1.5 && friday.label.endsWith(', planned'),
		friday?.label ?? 'no block'
	)
	check(
		'move series: the first Thursday 17:00 is drawn',
		thursday !== undefined && Math.abs(thursday.top - 17 * 48) <= 1.5,
		thursday?.label ?? 'no block'
	)
	check('move series: past weeks did not change', (await pastSnapshot(page, fx)).join('\n') === before.join('\n'))

	const d = await createCard(page, CH_D, 60, null)
	const inserted = sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(d)}, 3, '18:00', 60, ${quote(core.addDays(fx.wed, -7))}, ${quote(fx.wed)}) returning id`
	)
	check('series D ending on the nearest Wednesday created through sql', inserted.rowCount === 1)
	const seriesD = inserted.rows?.[0]?.id
	await page.keyboard.press('k')
	await page.waitForTimeout(300)
	await page.keyboard.press('j')
	await page.waitForFunction(
		(expected) => document.querySelector('[data-slot="week-grid-day"]')?.dataset.date === expected,
		core.mondayOf(fx.wed),
		{ timeout: 30000 }
	)
	await page.waitForTimeout(500)
	await openBlockDialog(page, CH_D, fx.wed)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check('move series D: From is the last Wednesday of D', facts.from === `From: ${mediumDate(fx.wed)}`, facts.from)
	await pickOption(page, 'move-series-day', 'Thursday')
	facts = await seriesDialogFacts(page)
	const endsText = `This series ends on ${appDate(fx.wed, fx.today)}; no Thursday falls between From and that date.`
	check('move series D: the end before the new day is explained', facts.error === endsText, facts.error)
	check('move series D: no preview without a first lesson', facts.preview === null, facts.preview)
	sent = posts.length
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	await page.waitForTimeout(500)
	check(
		'move series D: and the request does not go out',
		posts.slice(sent).every((post) => !post.url.includes(`/series/${seriesD}/move`))
	)
	await shot(page, 'sched-changes', 'move-series-ends')
	await pickOption(page, 'move-series-day', 'Wednesday')
	await pickTime(page, '19:00', 'move-series-time')
	await page.route('**/api/schedule/series/*/move', (route) =>
		route.fulfill({
			status: 400,
			contentType: 'application/json',
			body: JSON.stringify({ error: { code: 'series_ends_before_new_day', message: 'Invalid request' } }),
		})
	)
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	await page.waitForTimeout(800)
	facts = await seriesDialogFacts(page)
	check(
		'move series D: the api code series_ends_before_new_day shows the same error',
		facts.error === `This series ends on ${appDate(fx.wed, fx.today)}; no Wednesday falls between From and that date.`,
		facts.error
	)
	await page.unroute('**/api/schedule/series/*/move')
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)
	const focusD = await focusedBlock(page)
	check(
		'move series D: closing returns focus to the block',
		focusD.date === fx.wed && focusD.slot === 'to' && focusD.key?.includes(seriesD),
		JSON.stringify(focusD)
	)

	await openBlockDialog(page, CH_A, fx.thursday)
	box = await seriesBox(page)
	check(
		'end series: the new series has its own Whole series box',
		box !== null && box.text.includes(`Every Thursday at 17:00 VN · from ${appDate(fx.thursday, fx.today)}`),
		box?.text
	)
	await dialog.getByRole('button', { name: 'End series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'End this series?' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(500)
	facts = await seriesDialogFacts(page)
	check(
		'end series: title, description and the open lesson date',
		facts.text.includes(`${CH_A}, every Thursday at 17:00 VN (13:00 MSK).`) &&
			facts.last === `Last lesson on: ${mediumDate(fx.thursday)}`,
		`${facts.text.slice(0, 120)} ${facts.last}`
	)
	check('end series: Keep series has the initial focus', facts.focus === 'Keep series', facts.focus)
	const second = core.addDays(fx.thursday, 7)
	await pickDate(page, second, 'end-series-last')
	facts = await seriesDialogFacts(page)
	check(
		'end series: the hint names the last lesson',
		facts.hint ===
			`The last lesson will be on ${appDate(second, fx.today)}. Later lessons are removed from the schedule. Earlier lessons and any lessons you moved stay where they are.` &&
			facts.hintClass.includes('text-muted-foreground'),
		facts.hint
	)
	const buttonStyle = await page
		.getByRole('dialog')
		.getByRole('button', { name: 'End series' })
		.evaluate((element) => {
			const probe = document.createElement('div')
			probe.className = 'text-destructive'
			document.body.append(probe)
			const destructive = getComputedStyle(probe).color
			probe.remove()
			return { color: getComputedStyle(element).color, destructive }
		})
	check(
		'end series: End series is an outline button with a red label',
		buttonStyle.color === buttonStyle.destructive,
		JSON.stringify(buttonStyle)
	)
	await shot(page, 'sched-changes', 'end-series')
	await page.getByRole('dialog').getByRole('button', { name: 'End series' }).click()
	const endedToast = await toastText(page, 'Series ended', CH_A)
	check(
		'end series: toast names the last lesson',
		endedToast.includes(`${CH_A}'s last lesson is on ${appDate(second, fx.today)}.`),
		endedToast
	)
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await goToWeek(page, nav, core.mondayOf(second))
	week = await readBlocks(page)
	check(
		'end series: the last Thursday stays',
		ofCard(week, CH_A).some((block) => block.date === second),
		ofCard(week, CH_A)
			.map((block) => block.date)
			.join(',')
	)
	await goToWeek(page, nav, core.mondayOf(core.addDays(second, 7)))
	week = await readBlocks(page)
	check(
		'end series: no Thursday after it',
		!ofCard(week, CH_A).some((block) => block.date === core.addDays(second, 7)),
		ofCard(week, CH_A)
			.map((block) => block.date)
			.join(',')
	)

	const c = await createCard(page, CH_C, 60, null)
	const cDate = core.addDays(fx.today, 14)
	const seriesC = await api(page, 'POST', '/schedule/lessons', {
		studentId: c,
		date: cDate,
		startTime: '15:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	check('series C starting in two weeks created through the api', seriesC.status === 201, String(seriesC.status))
	await goToWeek(page, nav, core.mondayOf(core.addDays(cDate, -7)))
	await goToWeek(page, nav, core.mondayOf(cDate))
	await openBlockDialog(page, CH_C, cDate)
	await dialog.getByRole('button', { name: 'End series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'End this series?' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	await pickDate(page, fx.today, 'end-series-last')
	facts = await seriesDialogFacts(page)
	check(
		'end series C: no lesson remains',
		facts.hint === 'No lessons of this series will remain. Any lessons you moved stay where they are.' &&
			facts.hintClass.includes('text-foreground'),
		`${facts.hint} ${facts.hintClass}`
	)
	await shot(page, 'sched-changes', 'end-series-empty')
	await page.getByRole('dialog').getByRole('button', { name: 'End series' }).click()
	const removedToast = await toastText(page, 'Series ended', CH_C)
	check(
		'end series C: toast says the series was removed',
		removedToast.includes(`${CH_C}'s series was removed from the schedule.`),
		removedToast
	)
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(500)
	week = await readBlocks(page)
	check('end series C: no blocks of C remain', ofCard(week, CH_C).length === 0, String(ofCard(week, CH_C).length))
}

async function changes() {
	cleanupFixtures('changes start')
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	const posts = []
	try {
		await setTheme(page)
		await signIn(page)
		const fx = await changesFixtures(page)
		const before = await pastSnapshot(page, fx)
		check('past weeks snapshot holds two A blocks', before.length === 2, String(before.length))
		page.on('request', (request) => {
			if (request.method() === 'POST' && request.url().includes('/api/schedule/')) {
				posts.push({ url: request.url(), body: request.postData() })
			}
		})
		await openSchedule(page)
		const nav = { monday: core.mondayOf(fx.today) }
		await changesPart1(page, fx, nav, posts)
		const afterPart1 = await pastSnapshot(page, fx)
		check('past weeks snapshot is unchanged after part 1', afterPart1.join('\n') === before.join('\n'))
		console.log('CHANGES_PART1_OK')
		await changesPart2(page, fx, nav, posts)
		const afterPart2 = await pastSnapshot(page, fx)
		check('past weeks snapshot is unchanged after part 2', afterPart2.join('\n') === before.join('\n'))
		console.log('CHANGES_PART2_OK')
		await changesPart3(page, fx, nav, posts, before)
		const afterAll = await pastSnapshot(page, fx)
		check('past weeks snapshot is unchanged after every change', afterAll.join('\n') === before.join('\n'))
		console.log('CHANGES_PART3_OK')
		const real = problems.filter(
			(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409)/.test(problem)
		)
		check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
		cleanupFixtures('changes end', CHANGES_LIKE)
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_CHANGES_OK')
}

const STUDENTS_LIKE = 'Alex Example 2009%'
const ST_A = 'Alex Example 2009 A'
const ST_B = 'Alex Example 2009 B'
const ST_C = 'Alex Example 2009 C'

function expectedWhen(iso, currentYear) {
	const parts = core.zonedParts(new Date(iso), VN)
	const year = Number(parts.date.slice(0, 4)) === currentYear ? '' : ` ${parts.date.slice(0, 4)}`
	return `${shortDay(parts.date)}${year}, ${parts.time}`
}

async function studentsFixtures(page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const a = await createCard(page, ST_A, 60, null)
	const b = await createCard(page, ST_B, 60, null)
	const c = await createCard(page, ST_C, 60, null)
	const series = await api(page, 'POST', '/schedule/lessons', {
		studentId: a,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	check('series A created', series.status === 201, String(series.status))
	const archived = await api(page, 'POST', `/students/${c}/archive`)
	check('card C archived', archived.status === 200, String(archived.status))
	return { today, wednesday, a, b, c }
}

const studentRow = (page, name) => page.locator('tbody tr', { hasText: name })

async function openStudentsList(page) {
	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	await page.getByRole('tab', { name: 'Active', exact: true }).waitFor({ timeout: 15000 })
	await studentRow(page, ST_A).first().waitFor({ timeout: 15000 })
}

async function studentsPart1(page, fx) {
	const list = await api(page, 'GET', '/students')
	const rowA = list.json.students.find((student) => student.id === fx.a)
	const rowB = list.json.students.find((student) => student.id === fx.b)
	check(
		'api: nextLessonAt of A is the first Wednesday 18:00 Vietnam',
		rowA?.nextLessonAt === whenText(fx.wednesday, '18:00')
	)
	check('api: nextLessonAt of B is null', rowB?.nextLessonAt === null)
	await openStudentsList(page)
	const heads = await page.locator('thead th').allTextContents()
	check(
		'columns are Student, Status, Rate, Lessons left, Next lesson',
		heads.map((text) => text.trim()).join('|') === 'Student|Status|Rate|Lessons left|Next lesson',
		heads.join('|')
	)
	const currentYear = Number(core.zonedParts(new Date(), VN).date.slice(0, 4))
	const cellA = studentRow(page, ST_A).first().locator('td').nth(4)
	const cellB = studentRow(page, ST_B).first().locator('td').nth(4)
	const lessonsLeftA = await studentRow(page, ST_A).first().locator('td').nth(3).textContent()
	const mainA = (await cellA.locator('span').first().textContent())?.trim()
	const wantA = expectedWhen(rowA.nextLessonAt, currentYear)
	check('row A: main line is formatted from the api value', mainA === wantA, `${mainA} / ${wantA}`)
	const handMade = `${shortDay(fx.wednesday)}${fx.wednesday.slice(0, 4) === String(currentYear) ? '' : ` ${fx.wednesday.slice(0, 4)}`}, 18:00`
	check('row A: main line equals the first Wednesday 18:00', mainA === handMade, handMade)
	check('row A: main line has no zone label and no relative words', !/VN|MSK|UTC|today|tomorrow/i.test(mainA ?? ''))
	const secondA = await secondLineOf(cellA)
	const wantSecond = expectedSecond(rowA.nextLessonAt, 'Europe/Moscow')
	check('row A: second line is the default Moscow zone', secondA === wantSecond, `${secondA} / ${wantSecond}`)
	check('row A: Moscow second line is 14:00 MSK', secondA === '14:00 MSK', String(secondA))
	const secondStyle = await cellA
		.locator('span')
		.nth(1)
		.evaluate((element) => {
			const style = getComputedStyle(element)
			return {
				size: style.fontSize,
				line: style.lineHeight,
				muted: element.className.includes('text-muted-foreground'),
				numeric: getComputedStyle(element.closest('td')).fontVariantNumeric,
			}
		})
	check(
		'row A: second line is 11px over 14px',
		secondStyle.size === '11px' && secondStyle.line === '14px',
		`${secondStyle.size}/${secondStyle.line}`
	)
	check(
		'row A: second line is muted and tabular',
		secondStyle.muted && secondStyle.numeric.includes('tabular-nums'),
		secondStyle.numeric
	)
	const cellsB = await cellB.textContent()
	check('row B: Next lesson is None with no second line', cellsB?.trim() === 'None', cellsB?.trim())
	const noneMuted = await cellB
		.locator('span')
		.evaluate((element) => element.className.includes('text-muted-foreground'))
	check('row B: None is muted', noneMuted)
	check('row A: Lessons left cell is unchanged', lessonsLeftA?.trim() === 'Set opening balance', lessonsLeftA?.trim())
	const heightA = await studentRow(page, ST_A)
		.first()
		.evaluate((row) => row.getBoundingClientRect().height)
	const heightB = await studentRow(page, ST_B)
		.first()
		.evaluate((row) => row.getBoundingClientRect().height)
	check('row heights match with and without a second line', heightA === heightB, `${heightA}/${heightB}`)
	await shot(page, 'sched-students', 'next-lesson')

	await setSecondZone(page, 'Pacific/Auckland')
	await openStudentsList(page)
	const nextDay = await secondLineOf(cellA)
	const wantNextDay = expectedSecond(rowA.nextLessonAt, 'Pacific/Auckland')
	check('another zone: the second line follows the stored zone', nextDay === wantNextDay, `${nextDay} / ${wantNextDay}`)
	check(
		'another zone: a different date starts with the weekday',
		/^[A-Z][a-z]{2} \d\d:\d\d NZ(ST|DT)$/.test(nextDay ?? ''),
		String(nextDay)
	)
	check('another zone: main line is unchanged', (await cellA.locator('span').first().textContent())?.trim() === wantA)
	await shot(page, 'sched-students', 'next-day')

	await setSecondZone(page, 'none')
	await openStudentsList(page)
	check(
		'no second zone: only the main line',
		(await cellA.locator('span').count()) === 1,
		String(await cellA.locator('span').count())
	)
	const heightNone = await studentRow(page, ST_A)
		.first()
		.evaluate((row) => row.getBoundingClientRect().height)
	check('no second zone: row height is unchanged', heightNone === heightA, `${heightNone}/${heightA}`)
	await setSecondZone(page, null)
}

async function setSecondZone(page, zone) {
	await page.evaluate((value) => {
		if (value === null) localStorage.removeItem('dv-lab.schedule.second-zone')
		else localStorage.setItem('dv-lab.schedule.second-zone', value)
	}, zone)
}

async function secondLineOf(cell) {
	const spans = cell.locator('span')
	if ((await spans.count()) < 2) return null
	return (await spans.nth(1).textContent())?.trim() ?? null
}

const LABEL_TABLE = {
	'Europe/Moscow': ['MSK'],
	'Pacific/Auckland': ['NZST', 'NZDT'],
	'Europe/Berlin': ['CET', 'CEST'],
	'Asia/Kolkata': ['IST'],
	'Asia/Yekaterinburg': ['YEKT'],
}

function expectedLabel(zone, instant) {
	const known = LABEL_TABLE[zone]
	if (!known) return zone.split('/').pop().replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()
	if (known.length === 1) return known[0]
	const year = instant.getUTCFullYear()
	const standard = Math.min(
		zoneOffset(zone, new Date(Date.UTC(year, 0, 1))),
		zoneOffset(zone, new Date(Date.UTC(year, 6, 1)))
	)
	return zoneOffset(zone, instant) > standard ? known[1] : known[0]
}

function expectedSecond(iso, zone) {
	const instant = new Date(iso)
	const parts = core.zonedParts(instant, zone)
	const day = core.zonedParts(instant, VN).date === parts.date ? '' : `${WEEKDAYS[parts.weekday - 1]} `
	return `${day}${parts.time} ${expectedLabel(zone, instant)}`
}

const searchField = (page) => page.getByRole('searchbox', { name: 'Search students' })
const headerCounts = (page) => page.getByText(/^\d+ active, \d+ archived$/).first()

async function fixtureRows(page) {
	return page.locator('tbody tr', { hasText: 'Alex Example 2009' }).count()
}

async function studentsPart2(page, fx) {
	const requests = []
	page.on('request', (request) => {
		if (request.url().includes('/api/')) requests.push(request.url())
	})
	await openStudentsList(page)
	const countsBefore = await headerCounts(page).textContent()
	check('active tab shows the search field', (await searchField(page).count()) === 1)
	const placeholder = await searchField(page).getAttribute('placeholder')
	check('search placeholder is Search students', placeholder === 'Search students', String(placeholder))
	const type = await searchField(page).getAttribute('type')
	check('search field is type search', type === 'search', String(type))
	const beforeSearch = requests.length
	await searchField(page).fill('  ALEX example 2009 a  ')
	await page.waitForTimeout(300)
	check('active: query keeps A', (await studentRow(page, ST_A).count()) === 1)
	check('active: query hides B', (await studentRow(page, ST_B).count()) === 0)
	check('active: only A of the fixtures is listed', (await fixtureRows(page)) === 1)
	check('header counts are unchanged by the filter', (await headerCounts(page).textContent()) === countsBefore)
	await searchField(page).fill('zz-no-such-student')
	await page.waitForTimeout(300)
	check(
		'active: no match shows No students found',
		(await page.getByText('No students found', { exact: true }).count()) === 1
	)
	check('active: no table when nothing matches', (await page.locator('tbody tr').count()) === 0)
	check('header counts are unchanged by an empty result', (await headerCounts(page).textContent()) === countsBefore)
	await shot(page, 'sched-students', 'no-match')
	await searchField(page).fill('2009 c')
	await page.waitForTimeout(300)
	check('active: archived card C is not on the active tab', (await studentRow(page, ST_C).count()) === 0)
	check(
		'active: No students found for an archived-only match',
		(await page.getByText('No students found', { exact: true }).count()) === 1
	)
	await page.getByRole('tab', { name: 'Archived', exact: true }).click()
	await studentRow(page, ST_C).first().waitFor({ timeout: 10000 })
	check('archived: the query is kept across tabs', (await searchField(page).inputValue()) === '2009 c')
	check('archived: C is listed by 2009 c', (await studentRow(page, ST_C).count()) === 1)
	check('archived: only C of the fixtures is listed', (await fixtureRows(page)) === 1)
	await shot(page, 'sched-students', 'archived')
	await searchField(page).fill('zz-no-such-student')
	await page.waitForTimeout(300)
	check(
		'archived: no match shows No students found',
		(await page.getByText('No students found', { exact: true }).count()) === 1
	)
	const searchRequests = requests.length - beforeSearch
	await page.getByRole('tab', { name: /^Unassigned payments/ }).click()
	await page.waitForTimeout(500)
	check('unassigned: no search field', (await searchField(page).count()) === 0)
	await page.getByRole('tab', { name: 'Active', exact: true }).click()
	await page.waitForTimeout(500)
	check(
		'back on active: the field returns with the kept query',
		(await searchField(page).inputValue()) === 'zz-no-such-student'
	)
	await searchField(page).fill('')
	await page.waitForTimeout(300)
	check(
		'empty query lists the fixtures again',
		(await studentRow(page, ST_A).count()) === 1 && (await studentRow(page, ST_B).count()) === 1
	)
	check('header counts are unchanged after clearing', (await headerCounts(page).textContent()) === countsBefore)
	check('searching on Active and Archived sends no request', searchRequests === 0, String(searchRequests))
	console.log(
		`INFO requests after the search began: ${requests
			.slice(beforeSearch)
			.map((url) => new URL(url).pathname)
			.join(', ')}`
	)
	check('the query is not in the url', !page.url().includes('?') && !page.url().includes('search'), page.url())
	const layout = await page.evaluate(() => {
		const input = document.querySelector('input[type="search"]')
		const list = document.querySelector('[role="tablist"]')
		if (!input || !list) return null
		const inputBox = input.getBoundingClientRect()
		const listBox = list.getBoundingClientRect()
		return {
			width: Math.round(inputBox.width),
			inputLeft: inputBox.left,
			listRight: listBox.right,
			inputBottom: inputBox.bottom,
			listBottom: listBox.bottom,
		}
	})
	check('search field is 288px wide on desktop', layout?.width === 288, String(layout?.width))
	check('search field sits right of the tabs', layout !== null && layout.inputLeft > layout.listRight)
	check(
		'search field and tabs share a bottom edge',
		layout !== null && Math.abs(layout.inputBottom - layout.listBottom) <= 1
	)
	await shot(page, 'sched-students', 'desktop')
}

async function studentsNarrow(page) {
	await page.setViewportSize({ width: 360, height: 800 })
	await openStudentsList(page)
	await page.waitForTimeout(500)
	const facts = await page.evaluate(() => {
		const list = document.querySelector('[role="tablist"]')
		const container = document.querySelector('[data-slot="table-container"]')
		const input = document.querySelector('input[type="search"]')
		if (!list || !container || !input) return null
		const listStyle = getComputedStyle(list)
		const containerStyle = getComputedStyle(container)
		const wrapper = list.parentElement
		return {
			listFade: list.classList.contains('scroll-fade-x'),
			listSize: listStyle.getPropertyValue('--scroll-fade-size').trim(),
			listMask: listStyle.maskImage || listStyle.webkitMaskImage,
			listOverflow: listStyle.overflowX,
			listScroll: list.scrollWidth,
			listClient: list.clientWidth,
			listBackground: listStyle.backgroundColor,
			wrapperBackground: wrapper ? getComputedStyle(wrapper).backgroundColor : '',
			containerFade: container.classList.contains('scroll-fade-x'),
			containerSize: containerStyle.getPropertyValue('--scroll-fade-size').trim(),
			inputWidth: Math.round(input.getBoundingClientRect().width),
			pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
		}
	})
	check('narrow: facts read', facts !== null)
	check('narrow: tab strip has scroll-fade-x', facts?.listFade === true)
	check('narrow: tab strip fade is 24px', facts?.listSize === '24px', facts?.listSize)
	check(
		'narrow: tab strip mask-image is set',
		Boolean(facts?.listMask) && facts.listMask !== 'none',
		facts?.listMask?.slice(0, 40)
	)
	check('narrow: tab strip scrolls sideways', facts?.listOverflow === 'auto', facts?.listOverflow)
	check(
		'narrow: background is on the wrapper, not on the masked strip',
		facts?.listBackground === 'rgba(0, 0, 0, 0)' && facts?.wrapperBackground !== 'rgba(0, 0, 0, 0)',
		`${facts?.listBackground} / ${facts?.wrapperBackground}`
	)
	check('narrow: table container has scroll-fade-x', facts?.containerFade === true)
	check('narrow: table container fade is 24px', facts?.containerSize === '24px', facts?.containerSize)
	check('narrow: search field fills the row', facts !== null && facts.inputWidth >= 300, String(facts?.inputWidth))
	check('narrow: the page itself does not scroll sideways', facts?.pageOverflow === false)
	console.log(`INFO narrow tab strip ${facts?.listScroll}/${facts?.listClient}`)
	await shot(page, 'sched-students', 'narrow')
	await page.setViewportSize({ width: 1440, height: 900 })
}

async function studentsPart3(page) {
	const posts = []
	page.on('request', (request) => {
		if (request.method() !== 'GET' && request.url().includes('/api/students')) posts.push(request.url())
	})
	await openStudentsList(page)
	await page.getByRole('button', { name: 'New student' }).click()
	const dialog = page.getByRole('dialog')
	await dialog.waitFor({ timeout: 10000 })
	await dialog.locator('#student-form-time-zone').click()
	const zoneInput = page.getByPlaceholder('Search time zones')
	await zoneInput.waitFor({ timeout: 10000 })
	await page.waitForTimeout(300)
	const firstRow = await page.getByRole('option').first().textContent()
	check('time zone field: first row is Same as teacher', firstRow?.trim() === 'Same as teacher', String(firstRow))
	check('time zone field: no None row', (await page.getByRole('option', { name: /^None/ }).count()) === 0)
	await zoneInput.fill('kolk')
	await page.waitForTimeout(300)
	const kolkata = await page.getByRole('option').allTextContents()
	check(
		'time zone search kolk finds Asia/Kolkata with IST',
		kolkata.length === 1 && kolkata[0].includes('Asia/Kolkata') && kolkata[0].includes('IST'),
		kolkata.join(' | ')
	)
	await zoneInput.fill('+7')
	await page.waitForTimeout(300)
	const seven = await page.getByRole('option').allTextContents()
	check('time zone search +7 lists zones', seven.length > 0, String(seven.length))
	check(
		'time zone search +7 lists Bangkok and Ho Chi Minh, not Kolkata',
		seven.some((text) => text.includes('Asia/Bangkok')) &&
			seven.some((text) => text.includes('Asia/Ho_Chi_Minh')) &&
			!seven.some((text) => text.includes('Asia/Kolkata')),
		String(seven.length)
	)
	await zoneInput.fill('utc+5:30')
	await page.waitForTimeout(300)
	const half = await page.getByRole('option').allTextContents()
	check(
		'time zone search 5:30 finds Asia/Kolkata',
		half.some((text) => text.includes('Asia/Kolkata'))
	)
	await zoneInput.fill('kathm')
	await page.waitForTimeout(300)
	const modern = await page.getByRole('option').allTextContents()
	check(
		'time zone search kathm finds Asia/Kathmandu with KATH',
		modern.some((text) => text.includes('Asia/Kathmandu') && text.includes('KATH')),
		modern.join(' | ')
	)
	await zoneInput.fill('zz-no-zone')
	await page.waitForTimeout(300)
	check(
		'time zone search with no match shows the empty title',
		(await page.getByText('No time zones found').count()) === 1
	)
	await shot(page, 'sched-students', 'zone-search')
	await page.keyboard.press('Escape')
	await page.getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	check('dialog closed without saving', posts.length === 0, posts.join(' | '))
	const left = await page.evaluate(() => document.querySelectorAll('tbody tr').length)
	check('list is still shown after closing the dialog', left > 0)
}

async function students() {
	cleanupFixtures('students start', STUDENTS_LIKE)
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		await setTheme(page)
		await signIn(page)
		const fx = await studentsFixtures(page)
		await studentsPart1(page, fx)
		console.log('STUDENTS_PART1_OK')
		await studentsPart2(page, fx)
		await studentsNarrow(page)
		console.log('STUDENTS_PART2_OK')
		await studentsPart3(page)
		console.log('STUDENTS_PART3_OK')
		const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
		check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
		cleanupFixtures('students end', STUDENTS_LIKE)
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_STUDENTS_OK')
}

const GRID_LIKE = 'Alex Example 2130%'
const GRID_A = 'Alex Example 2130 A'
const GRID_B = 'Alex Example 2130 B'
const GCAL_LINE_PROBE = 'var(--gcal-line)'

async function gridFixtures(page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const thursday = core.addDays(wednesday, 1)
	const cancelledWednesday = core.addDays(wednesday, 63)
	const a = await createCard(page, GRID_A, 60, null)
	const b = await createCard(page, GRID_B, 60, null)
	const make = async (studentId, date, startTime, durationMinutes) => {
		const result = await api(page, 'POST', '/schedule/lessons', {
			studentId,
			date,
			startTime,
			durationMinutes,
			repeats: 'once',
		})
		check(
			`lesson ${date} ${startTime} for ${durationMinutes} min created`,
			result.status === 201,
			String(result.status)
		)
		return result.json?.lesson
	}
	await make(a, wednesday, '18:00', 60)
	await make(a, thursday, '09:00', 30)
	await make(a, thursday, '11:00', 40)
	await make(a, thursday, '14:00', 45)
	await make(a, thursday, '16:00', 60)
	const doomed = await make(b, cancelledWednesday, '12:00', 60)
	const cancelled = await api(page, 'POST', `/schedule/lessons/${encodeURIComponent(doomed.id)}/cancel`, {
		expectedStartsAt: doomed.startsAt,
	})
	check('lesson in the far week cancelled', cancelled.status === 200, String(cancelled.status))
	return { today, wednesday, thursday, cancelledWednesday }
}

async function gutterGeometry(page) {
	return page.evaluate((linePaint) => {
		const rect = (element) => element.getBoundingClientRect()
		const gutter = document.querySelector('[data-slot="week-grid-gutter"]')
		const corner = document.querySelector('[data-slot="week-grid-corner"]')
		const column = document.querySelector('[data-slot="week-grid-column"]')
		const day = document.querySelector('[data-slot="week-grid-day"]')
		const line = (hour) => document.querySelector(`[data-slot="week-grid-line"][data-hour="${hour}"]`)
		const cells = (element) =>
			Array.from(element.querySelectorAll('span')).map((span) => ({
				text: span.textContent,
				left: rect(span).left,
				right: rect(span).right,
				width: rect(span).width,
			}))
		const probe = document.createElement('div')
		probe.style.borderLeft = `1px solid ${linePaint}`
		document.body.append(probe)
		const expectedBorder = getComputedStyle(probe).borderLeftColor
		probe.remove()
		const rowZero = gutter.children[0]
		const rowEight = gutter.children[8]
		return {
			gutterLeft: rect(gutter).left,
			gutterRight: rect(gutter).right,
			gutterWidth: rect(gutter).width,
			cornerWidth: rect(corner).width,
			gridLeft: rect(column).left,
			rowEight: cells(rowEight),
			rowEightCenter: rect(rowEight).top + rect(rowEight).height / 2,
			lineEightTop: rect(line(8)).top,
			lineEightLeft: rect(line(8)).left,
			rowZeroTop: rect(rowZero).top,
			lineZeroTop: rect(line(0)).top,
			corner: cells(corner),
			dayLeft: rect(day).left,
			dayBorderWidth: getComputedStyle(day).borderLeftWidth,
			dayBorderColor: getComputedStyle(day).borderLeftColor,
			expectedBorder,
		}
	}, GCAL_LINE_PROBE)
}

async function gridPart1(page) {
	await openSchedule(page)
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	const near = (value, expected, tolerance = 0.6) => Math.abs(value - expected) <= tolerance
	let geo = await gutterGeometry(page)
	check(
		'gutter is 100px wide',
		near(geo.gutterWidth, 100) && near(geo.cornerWidth, 100),
		`${geo.gutterWidth}/${geo.cornerWidth}`
	)
	const [second, vn] = geo.rowEight
	check(
		'row 08:00: second zone left, Vietnam right',
		second?.text === '04:00' && vn?.text === '08:00',
		JSON.stringify(geo.rowEight)
	)
	check('row 08:00: two columns of 36px', near(second.width, 36) && near(vn.width, 36), `${second.width}/${vn.width}`)
	check('row 08:00: gap between the columns is 8px', near(vn.left - second.right, 8), String(vn.left - second.right))
	check(
		'row 08:00: Vietnam is 8px from the grid line',
		near(geo.gridLeft - vn.right, 8),
		String(geo.gridLeft - vn.right)
	)
	check(
		'row 08:00: 12px from the card edge to the second zone',
		near(second.left - geo.gutterLeft, 12),
		String(second.left - geo.gutterLeft)
	)
	const [cornerSecond, cornerVn] = geo.corner
	check(
		'corner names MSK and VN',
		geo.corner.map((item) => item.text).join(' ') === 'MSK VN',
		JSON.stringify(geo.corner)
	)
	check(
		'corner columns match the row columns',
		near(cornerSecond.left, second.left) && near(cornerVn.left, vn.left) && near(cornerVn.width, 36),
		JSON.stringify(geo.corner)
	)
	check(
		'hour line starts at the grid edge',
		near(geo.lineEightLeft, geo.gridLeft),
		`${geo.lineEightLeft}/${geo.gridLeft}`
	)
	check(
		'hour label 08:00 is centred on its line',
		near(geo.rowEightCenter, geo.lineEightTop + 0.5, 1.5),
		`${geo.rowEightCenter}/${geo.lineEightTop}`
	)
	check(
		'first label sits under the top line',
		near(geo.rowZeroTop, geo.lineZeroTop, 1.5),
		`${geo.rowZeroTop}/${geo.lineZeroTop}`
	)
	check(
		'day header has a hairline in line with the body separators',
		near(geo.dayLeft, geo.gridLeft) && geo.dayBorderWidth === '1px' && geo.dayBorderColor === geo.expectedBorder,
		`${geo.dayLeft}/${geo.gridLeft} ${geo.dayBorderWidth} ${geo.dayBorderColor}`
	)
	const midnight = await page.evaluate(() =>
		Array.from(document.querySelectorAll('[data-slot="week-grid-gutter"] > div')[4].querySelectorAll('span')).map(
			(span) => span.textContent
		)
	)
	check('midnight row of the second zone shows the weekday', midnight.join(' ') === 'Mon 04:00', midnight.join(' '))
	await shot(page, 'sched-grid', 'gutter')

	await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'none'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	geo = await gutterGeometry(page)
	check(
		'no second zone: one column of 36px',
		geo.rowEight.length === 1 && near(geo.rowEight[0].width, 36),
		JSON.stringify(geo.rowEight)
	)
	check(
		'no second zone: the label is 08:00, 8px from the line',
		geo.rowEight[0].text === '08:00' && near(geo.gridLeft - geo.rowEight[0].right, 8),
		String(geo.gridLeft - geo.rowEight[0].right)
	)
	check(
		'no second zone: one caption VN',
		geo.corner.length === 1 && geo.corner[0].text === 'VN',
		JSON.stringify(geo.corner)
	)
	check('no second zone: the gutter is still 100px', near(geo.gutterWidth, 100), String(geo.gutterWidth))
	await shot(page, 'sched-grid', 'gutter-none')
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	console.log(failures() === 0 ? 'GRID_PART1_OK' : 'GRID_PART1_FAIL')
}

async function toolbarFacts(page) {
	const targets = {
		Today: page.getByRole('button', { name: 'Today', exact: true }),
		'Previous week': page.getByRole('button', { name: 'Previous week' }),
		'Next week': page.getByRole('button', { name: 'Next week' }),
		'Second time zone': page.locator('[aria-label="Second time zone"]'),
		'Calendar view': page.getByRole('combobox', { name: 'Calendar view' }),
	}
	const facts = {}
	for (const [name, locator] of Object.entries(targets)) {
		facts[name] = await locator.evaluate((element) => {
			const style = getComputedStyle(element)
			return { height: element.getBoundingClientRect().height, radius: parseFloat(style.borderTopLeftRadius) }
		})
	}
	return facts
}

async function gridPart2(page, fx, nav) {
	const toolbar = await toolbarFacts(page)
	for (const [name, item] of Object.entries(toolbar)) {
		check(
			`toolbar: ${name} is 28px and round`,
			Math.abs(item.height - 28) <= 0.6 && item.radius >= item.height / 2,
			JSON.stringify(item)
		)
	}
	await shot(page, 'sched-grid', 'toolbar')

	await goToWeek(page, nav, core.mondayOf(fx.wednesday))
	const data = await readBlocks(page)
	const onThursday = data.blocks
		.filter((block) => block.date === fx.thursday && block.label.startsWith(`${GRID_A}, `))
		.sort((left, right) => left.top - right.top)
	check('four lessons on the fixture Thursday', onThursday.length === 4, String(onThursday.length))
	const [thirty, forty, fortyFive, sixty] = onThursday
	check(
		'30 minutes: one line "Name, HH:MM"',
		thirty?.lines.length === 1 && thirty.lines[0] === `${GRID_A}, 09:00`,
		JSON.stringify(thirty?.lines)
	)
	check('30 minutes: not lower than 22px', thirty !== undefined && thirty.height >= 21.5, String(thirty?.height))
	check(
		'40 minutes: one line "Name, HH:MM"',
		forty?.lines.length === 1 && forty.lines[0] === `${GRID_A}, 11:00`,
		JSON.stringify(forty?.lines)
	)
	check(
		'45 minutes: name and range',
		fortyFive?.lines.length === 2 && fortyFive.lines[1] === '14:00–14:45',
		JSON.stringify(fortyFive?.lines)
	)
	check(
		'60 minutes: name and range',
		sixty?.lines.length === 2 && sixty.lines[1] === '16:00–17:00',
		JSON.stringify(sixty?.lines)
	)
	check('week summary counts the lessons', /^\d+ lessons with \d+ students?$/.test(data.description), data.description)
	await shot(page, 'sched-grid', 'blocks')

	const block = blockLocator(page, GRID_A, fx.wednesday)
	await block.scrollIntoViewIfNeeded()
	await block.hover()
	await page.waitForFunction(() => document.querySelector('[data-slot="event-tooltip"]') !== null, null, {
		timeout: 1500,
	})
	await page.waitForTimeout(250)
	const tip = await page.evaluate(() => {
		const content = document.querySelector('[data-slot="event-tooltip"]')
		const info = (element) => {
			const style = getComputedStyle(element)
			return {
				cls: element.className,
				size: style.fontSize,
				line: style.lineHeight,
				weight: style.fontWeight,
				numeric: style.fontVariantNumeric,
			}
		}
		const kids = Array.from(content.children)
		return {
			name: info(kids[0]),
			date: info(kids[1]),
			main: info(content.querySelector('[data-slot="time-main"]')),
			second: info(content.querySelector('[data-slot="time-second"]')),
			status: info(kids[kids.length - 1]),
		}
	})
	const has = (item, ...names) => names.every((name) => item.cls.split(/\s+/).includes(name))
	check(
		'tooltip: name is body, semibold',
		has(tip.name, 'text-body', 'font-semibold') && tip.name.size === '13px' && tip.name.weight === '600',
		JSON.stringify(tip.name)
	)
	check(
		'tooltip: date is body and muted',
		has(tip.date, 'text-body', 'text-muted-foreground') && !has(tip.date, 'text-caption') && tip.date.size === '13px',
		JSON.stringify(tip.date)
	)
	check(
		'tooltip: Vietnam range is body and tabular',
		has(tip.main, 'text-body', 'tabular-nums') && !has(tip.main, 'text-caption') && tip.main.size === '13px',
		JSON.stringify(tip.main)
	)
	check(
		'tooltip: second zone is micro and muted',
		has(tip.second, 'text-micro', 'text-muted-foreground') && tip.second.size === '11px' && tip.second.line === '14px',
		JSON.stringify(tip.second)
	)
	check(
		'tooltip: status is body',
		has(tip.status, 'text-body') && !has(tip.status, 'text-caption') && tip.status.size === '13px',
		JSON.stringify(tip.status)
	)
	checkPair('tooltip', await pairOf(page.locator('[data-slot="event-tooltip"]')), '18:00–19:00 VN', '14:00–15:00 MSK')
	await shot(page, 'sched-grid', 'tooltip')
	await page.mouse.move(4, 4)
	await page.waitForTimeout(400)

	await goToWeek(page, nav, core.mondayOf(fx.cancelledWednesday))
	const far = await readBlocks(page)
	check(
		'far week: only the cancelled lesson is shown',
		far.blocks.length === 1 && far.blocks[0].label.endsWith(', cancelled'),
		JSON.stringify(far.blocks.map((item) => item.label))
	)
	check(
		'far week: summary names the cancellation',
		far.description === 'No lessons this week · 1 cancelled',
		far.description
	)
	await shot(page, 'sched-grid', 'cancelled-week')
}

async function grid() {
	cleanupFixtures('grid start', GRID_LIKE)
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		await setTheme(page)
		await signIn(page)
		const fx = await gridFixtures(page)
		await gridPart1(page)
		const nav = { monday: core.mondayOf(core.zonedParts(new Date(), VN).date) }
		await gridPart2(page, fx, nav)
		const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
		check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
		cleanupFixtures('grid end', GRID_LIKE)
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_GRID_OK')
}

const FORMS_LIKE = 'Alex Example 2131%'
const FORMS_A = 'Alex Example 2131 A'
const FORMS_B = 'Alex Example 2131 B'
const FORMS_C = 'Alex Example 2131 C'
const FORMS_D = 'Alex Example 2131 D'
const FORMS_E = 'Alex Example 2131 E'
const FORMS_F = 'Alex Example 2131 F'

async function formsFixtures(page) {
	const today = core.zonedParts(new Date(), VN).date
	const wednesday = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const make = async (name, startTime) => {
		const id = await createCard(page, name, 60, null)
		const result = await api(page, 'POST', '/schedule/lessons', {
			studentId: id,
			date: wednesday,
			startTime,
			durationMinutes: 60,
			repeats: 'weekly',
		})
		check(`series ${name} at ${startTime} created`, result.status === 201, String(result.status))
		return id
	}
	await make(FORMS_A, '18:00')
	await make(FORMS_B, '02:00')
	await make(FORMS_C, '22:00')
	await createCard(page, FORMS_D, 60, null)
	await createCard(page, FORMS_E, 60, null)
	await createCard(page, FORMS_F, 60, null)
	return { today, wednesday }
}

async function formsSeriesBox(page) {
	return page
		.getByRole('dialog')
		.locator('[data-slot="lesson-series"]')
		.evaluate((element) => {
			const rect = (node) => node.getBoundingClientRect()
			const main = element.querySelector('[data-slot="lesson-series-main"]')
			const second = element.querySelector('[data-slot="lesson-series-second"]')
			const actions = element.querySelector('[data-slot="lesson-series-actions"]')
			const title = element.querySelector('p')
			const style = (node) => (node ? getComputedStyle(node) : null)
			return {
				title: title?.textContent,
				titleWeight: style(title)?.fontWeight,
				titleSize: style(title)?.fontSize,
				main: main?.textContent,
				mainClass: main?.className ?? '',
				second: second?.textContent ?? null,
				secondClass: second?.className ?? '',
				secondSize: style(second)?.fontSize ?? null,
				secondBottom: second ? rect(second).bottom : rect(main).bottom,
				mainBottom: rect(main).bottom,
				actionsTop: rect(actions).top,
				buttons: Array.from(actions.querySelectorAll('button')).map((button) => button.textContent?.trim()),
			}
		})
}

async function formsSeriesDialogs(page, name, expected) {
	const dialog = page.getByRole('dialog')
	const label = expected.label
	const box = await formsSeriesBox(page)
	check(
		`${label}: Whole series box is a column with Move series and End series under the text`,
		box.title === 'Whole series' &&
			box.titleWeight === '600' &&
			box.buttons.join('|') === 'Move series|End series' &&
			box.actionsTop >= box.secondBottom,
		JSON.stringify({ title: box.title, buttons: box.buttons, top: box.actionsTop, bottom: box.secondBottom })
	)
	check(
		`${label}: caption line is caption and names the series in VN`,
		box.mainClass.includes('text-caption') && box.main.includes(`Every Wednesday at ${expected.time} VN · from `),
		box.main
	)
	check(
		`${label}: second zone line is micro and reads "${expected.line}"`,
		box.second === expected.line && box.secondClass.includes('text-micro') && box.secondSize === '11px',
		`${box.second} ${box.secondClass} ${box.secondSize}`
	)
	await dialog.getByRole('button', { name: 'End series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'End this series?' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	let facts = await seriesDialogFacts(page)
	check(
		`${label}: End series description is "${name}, every ${expected.when}."`,
		facts.text.includes(`${name}, every ${expected.when}.`),
		facts.text.slice(0, 140)
	)
	check(
		`${label}: End series hint is caption and muted`,
		facts.hint !== null &&
			facts.hint.startsWith('The last lesson will be on ') &&
			facts.hintClass.includes('text-caption') &&
			facts.hintClass.includes('text-muted-foreground'),
		`${facts.hint} ${facts.hintClass}`
	)
	return facts
}

async function formsPart1(page, fx, nav) {
	const dialog = page.getByRole('dialog')
	await openSchedule(page)
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.wednesday))

	await openBlockDialog(page, FORMS_A, fx.wednesday)
	await formsSeriesDialogs(page, FORMS_A, {
		label: 'A',
		time: '18:00',
		when: 'Wednesday at 18:00 VN (14:00 MSK)',
		line: 'Every Wednesday at 14:00 MSK',
	})
	await pickDate(page, fx.today, 'end-series-last')
	let facts = await seriesDialogFacts(page)
	check(
		'A: End series with no lessons left says so, in caption and foreground',
		facts.hint === 'No lessons of this series will remain. Any lessons you moved stay where they are.' &&
			facts.hintClass.includes('text-caption') &&
			facts.hintClass.includes('text-foreground'),
		`${facts.hint} ${facts.hintClass}`
	)
	await shot(page, 'sched-forms', 'end-series-empty')
	await page.getByRole('dialog').getByRole('button', { name: 'Keep series' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)

	await openBlockDialog(page, FORMS_A, fx.wednesday)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check(
		'A: Move series description is "Now every Wednesday at 18:00 VN (14:00 MSK)."',
		facts.text.includes(`${FORMS_A}. Now every Wednesday at 18:00 VN (14:00 MSK).`),
		facts.text.slice(0, 140)
	)
	await pickTime(page, '17:00', 'move-series-time')
	await pickOption(page, 'move-series-day', 'Thursday')
	const move = await page.getByRole('dialog').evaluate((element) => {
		const label = element.querySelector('[data-slot="move-series-preview-label"]')
		const preview = element.querySelector('[data-slot="move-series-preview"]')
		const zone = element.querySelector('[data-slot="move-series-zone"]')
		const note = element.querySelector('[data-slot="move-series-note"]')
		const sizes = (node) => (node ? getComputedStyle(node).fontSize : null)
		return {
			labelClass: label?.className ?? '',
			labelSize: sizes(label),
			valueSize: sizes(preview?.lastElementChild),
			zoneClass: zone?.className ?? '',
			zone: zone?.textContent ?? null,
			zoneSize: sizes(zone),
			noteClass: note?.className ?? '',
			noteSize: sizes(note),
		}
	})
	check(
		'A: "First lesson" is body, 13px',
		move.labelClass.includes('text-body') && move.labelSize === '13px' && move.valueSize === '13px',
		JSON.stringify(move)
	)
	check(
		'A: the second-zone line under New start time is caption, 12px',
		move.zoneClass.includes('text-caption') && move.zoneSize === '12px' && move.zone === '13:00 MSK',
		`${move.zone} ${move.zoneClass} ${move.zoneSize}`
	)
	check(
		'A: the rule under the preview is caption, 12px',
		move.noteClass.includes('text-caption') && move.noteSize === '12px',
		`${move.noteClass} ${move.noteSize}`
	)
	await shot(page, 'sched-forms', 'move-series')
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)

	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	await pickTime(page, '18:00')
	await pickOption(page, 'new-lesson-repeats', 'Every week')
	const created = await page.getByRole('dialog').evaluate((element) => {
		const zone = element.querySelector('[data-slot="new-lesson-zone"]')
		const repeat = element.querySelector('[data-slot="new-lesson-repeat-note"]')
		return {
			zone: zone?.textContent ?? null,
			zoneClass: zone?.className ?? '',
			zoneSize: zone ? getComputedStyle(zone).fontSize : null,
			repeat: repeat?.textContent ?? null,
			repeatClass: repeat?.className ?? '',
		}
	})
	check(
		'new lesson: the line under Start time is caption, 12px',
		created.zoneClass.includes('text-caption') && created.zoneSize === '12px' && created.zone === '14:00 MSK',
		`${created.zone} ${created.zoneClass} ${created.zoneSize}`
	)
	check(
		'new lesson: Repeats names the series in VN until it is ended',
		/^Every [A-Z][a-z]+day at 18:00 VN until you end the series\.$/.test(created.repeat ?? '') &&
			created.repeatClass.includes('text-caption'),
		`${created.repeat} ${created.repeatClass}`
	)
	await shot(page, 'sched-forms', 'new-lesson-repeats')
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)

	await openBlockDialog(page, FORMS_B, fx.wednesday)
	await formsSeriesDialogs(page, FORMS_B, {
		label: 'B (Moscow, previous day)',
		time: '02:00',
		when: 'Wednesday at 02:00 VN (Tue 22:00 MSK)',
		line: 'Every Tuesday at 22:00 MSK',
	})
	await shot(page, 'sched-forms', 'end-series-shifted')
	await page.getByRole('dialog').getByRole('button', { name: 'Keep series' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(400)
	await openBlockDialog(page, FORMS_B, fx.wednesday)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check(
		'B: Move series description carries the day of the second zone',
		facts.text.includes(`${FORMS_B}. Now every Wednesday at 02:00 VN (Tue 22:00 MSK).`),
		facts.text.slice(0, 140)
	)
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })

	await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'Pacific/Auckland'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	await page.waitForTimeout(400)
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.wednesday))
	await openBlockDialog(page, FORMS_C, fx.wednesday)
	const auckland = await formsSeriesBox(page)
	check(
		'C (Auckland): the second zone line starts with the other weekday',
		/^Every Thursday at \d\d:\d\d /.test(auckland.second ?? '') && auckland.secondClass.includes('text-micro'),
		auckland.second ?? 'none'
	)
	await dialog.getByRole('button', { name: 'End series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'End this series?' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	facts = await seriesDialogFacts(page)
	check(
		'C (Auckland): End series description carries the short weekday of the second zone',
		new RegExp(`${FORMS_C}, every Wednesday at 22:00 VN \\(Thu \\d\\d:\\d\\d [^)]+\\)\\.`).test(facts.text),
		facts.text.slice(0, 140)
	)
	await page.getByRole('dialog').getByRole('button', { name: 'Keep series' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)

	await page.goto(`${BASE}/students`)
	await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
	const row = page.locator('tbody tr', { hasText: FORMS_D })
	await row.waitFor({ timeout: 15000 })
	const noneSpans = await row.evaluate((element) =>
		Array.from(element.querySelectorAll('span'))
			.filter((span) => span.textContent === 'None')
			.map((span) => span.className)
	)
	check(
		'students: Next lesson of a card without lessons reads "None", muted',
		noneSpans.length === 1 && noneSpans[0].includes('text-muted-foreground'),
		noneSpans.join('|')
	)
	check('students: no lowercase "none" anywhere', (await page.getByText('none', { exact: true }).count()) === 0)
	console.log('FORMS_PART1_OK')
}

async function valueFacts(page, selector, valueSelector) {
	return page.evaluate(
		({ selector, valueSelector }) => {
			const root = document.querySelector(selector)
			const node = valueSelector ? root.querySelector(valueSelector) : root
			const style = getComputedStyle(node)
			const rect = node.getBoundingClientRect()
			const wrapper = node.closest('span[class*="text-box"]')
			return {
				text: node.textContent?.trim() ?? '',
				lineHeight: style.lineHeight,
				overflow: `${style.overflowX}/${style.overflowY}`,
				height: Math.round(rect.height * 100) / 100,
				clientHeight: node.clientHeight,
				scrollHeight: node.scrollHeight,
				trim: wrapper ? getComputedStyle(wrapper).getPropertyValue('text-box-trim') : 'none',
			}
		},
		{ selector, valueSelector }
	)
}

function valueClear(facts) {
	return facts.height >= 20 && facts.scrollHeight <= facts.clientHeight && facts.lineHeight === '20px'
}

async function listFade(page) {
	return page.evaluate(() => {
		const viewports = Array.from(document.querySelectorAll('[data-slot="scroll-area-viewport"]')).filter(
			(element) => element.closest('[role="listbox"]') !== null || element.querySelector('[role="listbox"]') !== null
		)
		const viewport = viewports[viewports.length - 1]
		return {
			size: getComputedStyle(viewport).getPropertyValue('--scroll-fade-size').trim(),
			height: viewport.getBoundingClientRect().height,
			fade: getComputedStyle(viewport).maskImage !== 'none',
		}
	})
}

async function formsPart2(page, fx, nav) {
	const dialog = page.getByRole('dialog')
	await openSchedule(page)
	nav.monday = core.mondayOf(fx.today)

	await newButton(page).click()
	await dialog.waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	await pickOption(page, 'new-lesson-student', FORMS_D)
	await pickTime(page, '09:15')
	const time = await valueFacts(page, '#new-lesson-time', '[data-slot="time-picker-value"]')
	check(
		'new lesson: the "09:15" value is whole, 20px line, not clipped',
		time.text === '09:15' && valueClear(time),
		JSON.stringify(time)
	)
	const date = await valueFacts(page, '#new-lesson-date', '[data-slot="date-field-value"]')
	check('new lesson: the date value is whole, 20px line, not clipped', valueClear(date), JSON.stringify(date))
	const student = await valueFacts(page, '#new-lesson-student', 'span[class*="truncate"]')
	check(
		'new lesson: the Select value is whole, 20px line, not clipped',
		student.text === FORMS_D && valueClear(student),
		JSON.stringify(student)
	)
	await shot(page, 'sched-forms', 'values')

	await page.mouse.move(4, 4)
	await page.waitForTimeout(300)
	const rest = await page.evaluate(() => {
		const trigger = document.querySelector('#new-lesson-time')
		return {
			triggerHeight: trigger.getBoundingClientRect().height,
			triggerFill: getComputedStyle(trigger.querySelector('span[aria-hidden]')).backgroundColor,
		}
	})
	await page.locator('#new-lesson-time').click()
	await page.getByRole('listbox', { name: 'Hours' }).waitFor({ timeout: 5000 })
	await page.waitForTimeout(300)
	const open = await page.evaluate(() => {
		const footer = document.querySelector('[data-slot="time-picker-footer"]')
		const label = document.querySelector('[data-slot="time-picker-column-label"]')
		return {
			footer: getComputedStyle(footer).padding,
			label: getComputedStyle(label).paddingBottom,
		}
	})
	const panel = { ...rest, ...open }
	check(
		'time picker: 36px trigger without a fill, footer p-2, column label pb-1',
		panel.triggerHeight === 36 &&
			panel.footer === '8px' &&
			panel.label === '4px' &&
			panel.triggerFill === 'rgba(0, 0, 0, 0)',
		JSON.stringify(panel)
	)
	await shot(page, 'sched-forms', 'time-picker')
	await page.keyboard.press('Escape')
	await page.waitForTimeout(300)

	await page.locator('#new-lesson-repeats').click()
	await page.getByRole('listbox').waitFor({ timeout: 5000 })
	await page.waitForTimeout(500)
	const shortList = await listFade(page)
	check(
		'select: a short list (Repeats) gets the compact 24px fade',
		shortList.height < 200 && shortList.size === '24px',
		JSON.stringify(shortList)
	)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(400)
	await page.locator('#new-lesson-student').click()
	await page.getByRole('listbox').waitFor({ timeout: 5000 })
	await page.waitForTimeout(500)
	const longList = await listFade(page)
	check(
		'select: a long list (Student) keeps the 48px fade',
		longList.height >= 200 && longList.size === '48px' && longList.fade,
		JSON.stringify(longList)
	)
	await shot(page, 'sched-forms', 'select-long')
	await page.keyboard.press('Escape')
	await page.waitForTimeout(400)
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)

	await page.locator('[aria-label="Second time zone"]').click()
	await page
		.getByRole('searchbox', { name: 'Search time zones' })
		.or(page.getByLabel('Search time zones'))
		.first()
		.waitFor({ timeout: 5000 })
	await page.waitForTimeout(500)
	const zoneInput = await valueFacts(page, 'input[aria-label="Search time zones"]')
	check(
		'combobox: the search value is whole and not clipped',
		zoneInput.height >= 20 && zoneInput.scrollHeight <= zoneInput.clientHeight,
		JSON.stringify(zoneInput)
	)
	const zoneList = await listFade(page)
	check(
		'combobox: the time zone popup uses the compact 24px fade it is drawn with',
		zoneList.size === '24px' && zoneList.fade,
		JSON.stringify(zoneList)
	)
	await page.keyboard.press('Escape')
	await page.waitForTimeout(400)

	await openSchedule(page)
	nav.monday = core.mondayOf(fx.today)
	await goToWeek(page, nav, core.mondayOf(fx.wednesday))
	await openBlockDialog(page, FORMS_A, fx.wednesday)
	await dialog.getByRole('button', { name: 'Move series' }).click()
	await page.getByRole('dialog').filter({ hasText: 'Lessons before this date stay' }).waitFor({ timeout: 10000 })
	await page.waitForTimeout(400)
	await page.getByRole('dialog').getByRole('button', { name: 'Move series' }).click()
	await page.waitForTimeout(400)
	const invalid = await page.evaluate(() => {
		const probe = document.createElement('div')
		probe.style.color = 'var(--destructive)'
		document.body.append(probe)
		const destructive = getComputedStyle(probe).color
		probe.remove()
		const time = document.querySelector('#move-series-time')
		const day = document.querySelector('#move-series-day')
		return {
			timeInvalid: time.getAttribute('aria-invalid'),
			dayInvalid: day.getAttribute('aria-invalid'),
			ring: getComputedStyle(time.querySelector('span[aria-hidden]')).boxShadow,
			destructive,
		}
	})
	check(
		'move series: an invalid time has aria-invalid and a destructive ring, like the day',
		invalid.timeInvalid === 'true' && invalid.dayInvalid === 'true' && invalid.ring.includes(invalid.destructive),
		JSON.stringify(invalid)
	)
	await shot(page, 'sched-forms', 'move-series-invalid')
	await page.getByRole('dialog').getByRole('button', { name: 'Discard changes' }).click()
	await dialog.waitFor({ state: 'detached', timeout: 10000 })
	await page.waitForTimeout(300)

	await openBlockDialog(page, FORMS_A, fx.wednesday)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.getByRole('group', { name: 'Move lesson' }).waitFor({ timeout: 5000 })
	await page.waitForTimeout(400)
	await pickTime(page, '19:15', 'move-lesson-time')
	const moveForm = await moveFormFacts(page)
	check(
		'move lesson: was and now in VN on one line, the second zone on a micro line under it',
		moveForm !== null &&
			moveForm.vn === `${shortDay(fx.wednesday)}, 18:00${shortDay(fx.wednesday)}, 19:15–20:15 VN` &&
			moveForm.second === `${shortDay(fx.wednesday)}, 14:00${shortDay(fx.wednesday)}, 15:15–16:15 MSK` &&
			moveForm.secondClass.includes('text-micro'),
		`${moveForm?.vn} | ${moveForm?.second}`
	)
	await shot(page, 'sched-forms', 'move-lesson')
	await dialog.getByRole('button', { name: 'Discard changes' }).click()
	await page.waitForTimeout(300)
	await closeDialog(page)
	console.log('FORMS_PART2_OK')
}

async function forms() {
	cleanupFixtures('forms start', FORMS_LIKE)
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		await setTheme(page)
		await signIn(page)
		const fx = await formsFixtures(page)
		const nav = { monday: core.mondayOf(fx.today) }
		await formsPart1(page, fx, nav)
		await formsPart2(page, fx, nav)
		const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
		check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
	} finally {
		await browser.close()
		cleanupFixtures('forms end', FORMS_LIKE)
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_FORMS_OK')
}

const ZONE_KEYS = ['dv-lab.schedule.second-zone', 'dv-lab.time-zones.favorites']
const OFFSET_TEXT = /UTC[+−-]\d|GMT[+−-]\d/

async function clearZoneStorage(page) {
	await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), ZONE_KEYS)
}

async function listSequence(page) {
	return page.evaluate(() => {
		const list = document.querySelector('[role="listbox"]')
		if (!list) return []
		return Array.from(list.children)
			.map((child) => (child.textContent ?? '').trim())
			.filter((text) => text !== '')
	})
}

async function pageHasOffsetText(page) {
	return page.evaluate((source) => new RegExp(source).test(document.body.innerText), OFFSET_TEXT.source)
}

async function zones() {
	const { browser, page, problems } = await launch({ width: 1440, height: 900 })
	try {
		await setTheme(page)
		await signIn(page)
		await openSchedule(page)
		await clearZoneStorage(page)
		await page.reload()
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
		await page.waitForTimeout(400)
		const button = page.locator('[aria-label="Second time zone"]')
		const search = page.getByPlaceholder('Search time zones')
		const options = page.getByRole('option')

		check('schedule: no offset text such as UTC+7 or GMT-3', !(await pageHasOffsetText(page)))
		let state = await readCorner(page)
		check('corner names MSK and VN', state.corner.join(' ') === 'MSK VN', state.corner.join(' '))
		check('toolbar button says MSK', (await button.textContent())?.trim() === 'MSK')
		await page.goto(`${BASE}/students`)
		await page.getByRole('heading', { name: 'Students', level: 1 }).waitFor({ timeout: 30000 })
		check('students: no offset text such as UTC+7 or GMT-3', !(await pageHasOffsetText(page)))

		await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'Asia/Hovd'))
		await openSchedule(page)
		state = await readCorner(page)
		check('zone without a usual abbreviation shows four city letters', state.corner[0] === 'HOVD', state.corner.join(' '))
		const cornerFit = await page.evaluate(() => {
			const span = document.querySelector('[data-slot="week-grid-corner"] span')
			return span ? { scroll: span.scrollWidth, client: span.clientWidth } : null
		})
		check(
			'the four-letter label fits the 36px corner column',
			cornerFit !== null && cornerFit.scroll <= cornerFit.client,
			JSON.stringify(cornerFit)
		)
		check('toolbar button says HOVD', (await button.textContent())?.trim() === 'HOVD')
		await page.evaluate(() => localStorage.removeItem('dv-lab.schedule.second-zone'))
		await openSchedule(page)

		await button.click()
		await search.waitFor({ timeout: 10000 })
		await page.waitForTimeout(500)
		const sequence = await listSequence(page)
		check(
			'popup: None, Favorites with Moscow and Almaty, then All time zones',
			sequence[0] === 'NoneHide the second zone' &&
				sequence[1] === 'Favorites' &&
				sequence[2]?.startsWith('Europe/Moscow') &&
				sequence[3]?.startsWith('Asia/Almaty') &&
				sequence[4] === 'All time zones',
			sequence.slice(0, 6).join(' | ')
		)
		const headings = await page.evaluate(() => {
			const find = (text) =>
				Array.from(document.querySelectorAll('[role="presentation"]')).find((element) => element.textContent === text)
			const favorites = find('Favorites')
			if (!favorites) return null
			const style = getComputedStyle(favorites)
			return { cls: favorites.className, size: style.fontSize, top: style.paddingTop, bottom: style.paddingBottom }
		})
		check(
			'popup: Favorites heading is micro, 8px above and 4px below',
			headings !== null &&
				headings.cls.includes('text-micro') &&
				headings.cls.includes('text-muted-foreground') &&
				headings.size === '11px' &&
				headings.top === '8px' &&
				headings.bottom === '4px',
			JSON.stringify(headings)
		)
		const noneStar = await options.first().locator('[data-slot="time-zone-star"]').count()
		check('popup: None has no star', noneStar === 0)
		const checkedRow = await options.filter({ hasText: 'Europe/Moscow' }).first().getAttribute('aria-selected')
		check('popup: the chosen zone is marked selected', checkedRow === 'true', String(checkedRow))
		const moscowStar = options.filter({ hasText: 'Europe/Moscow' }).first().locator('[data-slot="time-zone-star"]')
		check(
			'popup: a favorite has a pressed, labelled star',
			(await moscowStar.getAttribute('aria-pressed')) === 'true' &&
				(await moscowStar.getAttribute('aria-label')) === 'Remove Europe/Moscow from favorites'
		)
		await shot(page, 'sched-zones', 'popup')

		const berlinRow = options.filter({ hasText: 'Europe/Berlin' }).first()
		await berlinRow.scrollIntoViewIfNeeded()
		await berlinRow.hover()
		const berlinStar = berlinRow.locator('[data-slot="time-zone-star"]')
		check(
			'popup: Berlin star is named Add to favorites and not pressed',
			(await berlinStar.getAttribute('aria-label')) === 'Add Europe/Berlin to favorites' &&
				(await berlinStar.getAttribute('aria-pressed')) === 'false'
		)
		await berlinStar.click()
		await page.waitForTimeout(400)
		check('star: the popup stays open', (await search.count()) === 1)
		check('star: the chosen zone does not change', (await button.textContent())?.trim() === 'MSK')
		const afterStar = await listSequence(page)
		check(
			'star: Berlin moved into Favorites after Almaty',
			afterStar[1] === 'Favorites' && afterStar[4]?.startsWith('Europe/Berlin') && afterStar[5] === 'All time zones',
			afterStar.slice(0, 7).join(' | ')
		)
		const storedFavorites = await page.evaluate(() => localStorage.getItem('dv-lab.time-zones.favorites'))
		check(
			'star: favorites are kept in the browser in order',
			storedFavorites === JSON.stringify(['Europe/Moscow', 'Asia/Almaty', 'Europe/Berlin']),
			String(storedFavorites)
		)

		await search.fill('CET')
		await page.waitForTimeout(300)
		const cet = await options.allTextContents()
		check('search CET finds Europe/Berlin', cet.some((text) => text.startsWith('Europe/Berlin')), cet.slice(0, 4).join(' | '))
		const flat = await listSequence(page)
		check('search: groups and headings are gone', !flat.includes('Favorites') && !flat.includes('All time zones'))
		const berlinFirst = await options.first().textContent()
		check('search: favorites come first', berlinFirst?.startsWith('Europe/Berlin') === true, String(berlinFirst))
		await search.fill('zzzz')
		await page.waitForTimeout(300)
		check(
			'search zzzz: empty copy',
			(await page.getByText('No time zones found').isVisible()) &&
				(await page.getByText('Try a city, a country or an abbreviation like CET.').isVisible())
		)
		await search.fill('+5:30')
		await page.waitForTimeout(300)
		const half = await options.allTextContents()
		check('search +5:30 finds Asia/Kolkata', half.some((text) => text.startsWith('Asia/Kolkata')), half.slice(0, 3).join(' | '))
		await search.fill('kolk')
		await page.waitForTimeout(300)
		await search.press('Enter')
		await page.waitForTimeout(400)
		check('choosing Kolkata: toolbar says IST', (await button.textContent())?.trim() === 'IST')
		state = await readCorner(page)
		check('choosing Kolkata: corner says IST VN', state.corner.join(' ') === 'IST VN', state.corner.join(' '))
		check('choosing Kolkata: nothing but a zone is written', state.stored === 'Asia/Kolkata', String(state.stored))
		check('the search field is empty on reopening', await (async () => {
			await button.click()
			await search.waitFor({ timeout: 10000 })
			const empty = (await search.inputValue()) === ''
			await page.keyboard.press('Escape')
			await page.waitForTimeout(400)
			return empty
		})())

		await page.reload()
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
		await page.waitForTimeout(400)
		check('after a reload the choice is kept', (await button.textContent())?.trim() === 'IST')
		check(
			'after a reload the favorites are kept',
			(await page.evaluate(() => localStorage.getItem('dv-lab.time-zones.favorites'))) === JSON.stringify(['Europe/Moscow', 'Asia/Almaty', 'Europe/Berlin'])
		)

		await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'Pacific/Auckland'))
		await page.reload()
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
		await page.waitForTimeout(400)
		await button.click()
		await search.waitFor({ timeout: 10000 })
		await page.waitForTimeout(700)
		const visible = await page.evaluate(() => {
			const row = Array.from(document.querySelectorAll('[role="option"]')).find((element) =>
				element.textContent?.startsWith('Pacific/Auckland')
			)
			const viewport = row?.closest('[data-slot="scroll-area-viewport"]')
			if (!row || !viewport) return null
			const box = row.getBoundingClientRect()
			const view = viewport.getBoundingClientRect()
			return { top: box.top - view.top, bottom: view.bottom - box.bottom, selected: row.getAttribute('aria-selected') }
		})
		check(
			'opening scrolls the chosen zone into view',
			visible !== null && visible.top >= 0 && visible.bottom >= 0 && visible.selected === 'true',
			JSON.stringify(visible)
		)
		await shot(page, 'sched-zones', 'scrolled')
		await page.keyboard.press('Escape')
		await page.waitForTimeout(400)

		await page.evaluate(() => localStorage.setItem('dv-lab.time-zones.favorites', '{"broken":'))
		await page.evaluate(() => localStorage.setItem('dv-lab.schedule.second-zone', 'not-a-zone'))
		await page.reload()
		await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
		await page.waitForTimeout(400)
		await button.click()
		await search.waitFor({ timeout: 10000 })
		await page.waitForTimeout(400)
		const fallback = await listSequence(page)
		check(
			'unreadable values fall back to the defaults',
			(await button.textContent())?.trim() === 'MSK' && fallback[2]?.startsWith('Europe/Moscow') && fallback[3]?.startsWith('Asia/Almaty'),
			fallback.slice(0, 4).join(' | ')
		)
		await page.keyboard.press('Escape')
		const real = problems.filter((problem) => !problem.includes('net::ERR_FAILED'))
		check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
	} finally {
		await clearZoneStorage(page).catch(() => {})
		await browser.close()
	}
	if (failures() === 0) console.log('SCHEDULE_WEB_ZONES_OK')
}

const sections = { fade, frame, read, changes, students, grid, forms, zones }

if (!sections[section]) {
	console.log(`usage: schedule-web.mjs ${Object.keys(sections).join('|')} [dark]`)
	process.exit(2)
}

try {
	await sections[section]()
} catch (error) {
	check('section completed', false, String(error).slice(0, 200))
}
process.exit(failures())
