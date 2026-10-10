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

const sections = { fade }

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
