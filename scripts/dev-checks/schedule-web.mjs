import * as core from '../../packages/core/src/index.ts'
import { BASE, check, failures, launch, shot, signIn, sql } from './web.mjs'

const section = process.argv[2]
const dark = process.argv.includes('dark')

const fixtureWhere = `display_name like 'Alex Example 20%' and import_key is null`

const cleanupText = `do $$ begin
if to_regclass('lesson_exceptions') is not null then
delete from lesson_exceptions where series_id in (select id from lesson_series where student_id in (select id from students where ${fixtureWhere}));
end if;
if to_regclass('lessons') is not null then
delete from lessons where student_id in (select id from students where ${fixtureWhere});
end if;
if to_regclass('lesson_series') is not null then
delete from lesson_series where student_id in (select id from students where ${fixtureWhere});
end if;
delete from students where ${fixtureWhere};
end $$`

export function cleanupFixtures(label) {
	const before = sql(`select count(*)::int as n from students where ${fixtureWhere}`)
	const found = before.rows?.[0]?.n ?? 0
	const result = sql(cleanupText)
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
			}
		})
		check('Select list viewport found', select !== null)
		check('Select list has scroll-fade', select?.fade === true)
		check('Select list fade size is 48px', select?.size === '48px', select?.size)
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
	check(`${label} corner names VN and MSK`, data.corner.join(' ') === 'VN MSK', data.corner.join(' '))
	check(`${label} 08:00 VN is 04:00 MSK`, data.gutter8.join(' ') === '08:00 04:00', data.gutter8.join(' '))
	check(`${label} midnight row shows the weekday`, data.gutter4.join(' ') === '04:00 Mon', data.gutter4.join(' '))
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
	const settle = () => page.waitForTimeout(250)
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

function berlinFacts(monday) {
	const instant = core.zonedInstant(monday, '08:00', VN)
	const hour = new Intl.DateTimeFormat('en-GB', {
		timeZone: 'Europe/Berlin',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(instant)
	const name = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
		.formatToParts(core.zonedInstant(monday, '12:00', VN))
		.find((part) => part.type === 'timeZoneName').value
	const offset = name.replace('GMT', '')
	return { hour, offset, toolbar: `UTC${offset}` }
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
		`${label} popup rows are 36px`,
		geometry !== null && geometry.rows.every((height) => Math.abs(height - 36) <= 0.6),
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
	const hint = await page.getByText('Try a city, a country or an offset like UTC+7.').isVisible()
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
		`${label} button shows the Berlin offset`,
		(await button.textContent())?.trim() === facts.toolbar,
		await button.textContent()
	)
	let state = await readCorner(page)
	check(
		`${label} corner shows the short offset`,
		state.corner.join(' ') === `VN ${facts.offset}`,
		state.corner.join(' ')
	)
	check(
		`${label} 08:00 VN is ${facts.hour} in Berlin`,
		state.gutter8.join(' ') === `08:00 ${facts.hour}`,
		state.gutter8.join(' ')
	)
	check(`${label} choice is stored`, state.stored === 'Europe/Berlin', state.stored)
	for (let step = 0; step < 3; step += 1) await page.getByRole('button', { name: 'Next week' }).click()
	await page.waitForTimeout(300)
	const later = core.addDays(monday, 21)
	const laterFacts = berlinFacts(later)
	state = await readCorner(page)
	check(
		`${label} offset follows the Monday of the week`,
		(await button.textContent())?.trim() === laterFacts.toolbar && state.corner[1] === laterFacts.offset,
		`${await button.textContent()} ${state.corner.join(' ')}`
	)
	check(
		`${label} gutter follows the Monday of the week`,
		state.gutter8.join(' ') === `08:00 ${laterFacts.hour}`,
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
			(await button.textContent())?.trim() === 'MSK' && state.corner.join(' ') === 'VN MSK',
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

const sections = { fade, frame }

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
