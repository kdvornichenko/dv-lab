import * as core from '../../packages/core/src/index.ts'
import { BASE, api, check, failures, launch, shot, signIn, sql } from './web.mjs'

const section = process.argv[2]
const dark = process.argv.includes('dark')

const fixtureWhere = (like) => `display_name like '${like}' and import_key is null`

const cleanupText = (like) => `do $$ begin
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
	check('week 0: second zone is in the label', Boolean(a0) && a0.label.includes('MSK'), a0?.label)
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
			tip.text.includes('18:00–19:00 VN · 14:00–15:00 MSK') &&
			tip.text.endsWith('Planned'),
		tip?.text
	)
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
		'dialog: description has the date, both zones',
		facts.text.includes(`${fullDate(fx.wednesday)} · 18:00–19:00 VN · 14:00–15:00 MSK`),
		facts.text.slice(0, 160)
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
		'dialog: no actions in this plan for a future lesson',
		!facts.buttons.some((text) => /Move|Cancel|Restore|Return/.test(text ?? ''))
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
		/Moved/.test(movedText) && movedText.includes(`moved to ${dayMonth(fx.movedTo)}, 10:00 VN`),
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
			toText.includes(`moved from ${dayMonth(fx.movedFrom)}, 18:00`),
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
		backText.includes(`moved to ${dayMonth(fx.movedTo)}, 10:00 VN`),
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
		crossText.includes(`moved from ${dayMonth(fx.farFrom)}, 18:00`) && crossText.includes('11:00–12:00 VN'),
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
}

const newButton = (page) => page.getByRole('button', { name: 'New lesson', exact: true })

function dayAttr(date) {
	return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}/${date.slice(0, 4)}`
}

async function pickDate(page, date) {
	await page.locator('#new-lesson-date').click()
	const cell = page.locator(`button[data-day="${dayAttr(date)}"]`).first()
	for (let step = 0; step < 4 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /next month/i }).click()
		await page.waitForTimeout(150)
	}
	for (let step = 0; step < 4 && (await cell.count()) === 0; step += 1) {
		await page.getByRole('button', { name: /previous month/i }).click()
		await page.waitForTimeout(150)
	}
	await cell.click()
	await page.waitForTimeout(250)
}

async function pickTime(page, time) {
	await page.locator('#new-lesson-time').click()
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
		'new lesson: the second zone is shown under Start time with the day',
		facts.zone === '22:00 MSK, the day before',
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
			`${NAME_A}, ${new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${fx.thursday}T12:00:00Z`))} ${dayMonth(fx.thursday)}, 14:00.`
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
		facts.repeatNote === 'Every Monday at 09:00 until you end the series.' && facts.submit?.text === 'Add series',
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
			facts.overlap.includes(`${NAME_A} 18:00–19:00`) &&
			facts.overlap.includes(`${NAME_B} 18:30–19:30`) &&
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

const sections = { fade, frame, read }

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
