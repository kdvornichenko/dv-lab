import * as core from '../../packages/core/src/index.ts'
import { call, quote, sql, startApi, teacherCookie } from './api.mjs'

const VN = core.SCHEDULE_TIME_ZONE
const PORT = 4202
const FIXTURE_PREFIX = 'Alex Example 211'
let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures += 1
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const todayVn = () => core.zonedParts(new Date(), VN).date
const instant = (date, time) => core.zonedInstant(date, time, VN).toISOString()

function removeCards(where) {
	const cards = `select id from students where ${where}`
	const series = `select id from lesson_series where student_id in (${cards})`
	const singles = `select id from lessons where student_id in (${cards})`
	let removed = 0
	removed += sql(`delete from lesson_marks where series_id in (${series}) or lesson_id in (${singles})`).rowCount
	removed += sql(`delete from lesson_exceptions where series_id in (${series})`).rowCount
	removed += sql(`delete from lessons where student_id in (${cards})`).rowCount
	removed += sql(`delete from lesson_series where student_id in (${cards})`).rowCount
	removed += sql(`delete from students where ${where}`).rowCount
	return removed
}

function removeTails() {
	const removed = removeCards(`display_name like ${quote(`${FIXTURE_PREFIX}%`)} and import_key is null`)
	console.log(`fixture tails removed ${removed}`)
}

function removeOwn(ids) {
	if (ids.length === 0) return
	removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
}

async function createCard(ctx, displayName) {
	const res = await call(ctx.api, 'POST', '/students', {
		cookie: ctx.cookie,
		body: {
			displayName,
			rateMinor: null,
			currency: null,
			defaultLessonMinutes: 60,
			parent: null,
			level: null,
			goals: null,
			timeZone: null,
		},
	})
	if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
	ctx.ids.push(res.json.student.id)
	return res.json.student.id
}

function insertSeries(studentId, weekday, startTime, startsOn) {
	return sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(studentId)}, ${weekday}, ${quote(startTime)}, 60, ${quote(startsOn)}, null) returning id`
	).rows[0].id
}

function pastSeries(studentId, date, startTime) {
	return insertSeries(studentId, core.weekdayOf(date), startTime, core.addDays(date, -14))
}

const post = (ctx, path, body = {}, cookie = ctx.cookie) => call(ctx.api, 'POST', `/schedule${path}`, { cookie, body })

const occurrencePath = (seriesId, date, action) => `/series/${seriesId}/occurrences/${date}/${action}`

async function weekBlocks(ctx, date) {
	const monday = core.mondayOf(date)
	const res = await call(ctx.api, 'GET', `/schedule/week?start=${monday}`, { cookie: ctx.cookie })
	if (res.status !== 200) throw new Error(`week ${monday} returned ${res.status}`)
	return res.json.blocks
}

async function blockOf(ctx, date, key) {
	return (await weekBlocks(ctx, date)).filter((block) => block.key === key)
}

function seriesMarks(seriesId, originalOn) {
	return sql(
		`select kind from lesson_marks where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`
	).rows
}

const sameActions = (actions, expected) => JSON.stringify(actions) === JSON.stringify(expected)

async function marksPart1(ctx) {
	const studentId = await createCard(ctx, 'Alex Example 2110')
	const date = core.addDays(ctx.today, -6)
	const seriesId = pastSeries(studentId, date, '10:00')
	const key = `s:${seriesId}:${date}`
	const startsAt = instant(date, '10:00')
	const marked = await post(ctx, occurrencePath(seriesId, date, 'mark'), { kind: 'done', expectedStartsAt: startsAt })
	check(
		'mark done of a past series occurrence gives 200 with kind done and outcome done',
		marked.status === 200 &&
			marked.json?.mark?.kind === 'done' &&
			marked.json?.mark?.outcome === 'done' &&
			marked.json?.mark?.ref?.kind === 'series' &&
			marked.json?.mark?.ref?.seriesId === seriesId &&
			marked.json?.mark?.ref?.originalOn === date,
		`status ${marked.status} ${JSON.stringify(marked.json ?? null)}`
	)
	const blocks = await blockOf(ctx, date, key)
	const block = blocks[0]
	check(
		'week shows the occurrence with outcome done, mark done and actions from core',
		blocks.length === 1 &&
			block.outcome === 'done' &&
			block.mark === 'done' &&
			sameActions(block.actions, { move: false, cancel: true, restore: false, mark: true }),
		JSON.stringify(blocks.map((item) => [item.outcome, item.mark, item.actions]))
	)
	check(
		'week block carries the ledger of the card',
		block?.ledger?.lessonMinutes === 60 && block?.ledger?.noShowDeducts === true && block?.ledger?.openingOn === null,
		JSON.stringify(block?.ledger ?? null)
	)
	const again = await post(ctx, occurrencePath(seriesId, date, 'mark'), { kind: 'done' })
	const rows = seriesMarks(seriesId, date)
	check(
		'repeated done keeps one lesson_marks row',
		again.status === 200 && rows.length === 1 && rows[0].kind === 'done',
		`status ${again.status} rows ${rows.length}`
	)
	if (failures === ctx.before) console.log('MARKS_PART1_OK')
	return { studentId, seriesId, date, key, startsAt }
}

async function sectionMarks(ctx) {
	await marksPart1(ctx)
	return 'MARKS_PART1_OK'
}

const SECTIONS = { marks: sectionMarks }

const section = process.argv[2]
const run = SECTIONS[section]
if (!run) {
	console.log(`usage: node scripts/dev-checks/ledger-api.mjs ${Object.keys(SECTIONS).join('|')}`)
	process.exit(2)
}

removeTails()
const ids = []
let api = null
let done = null
try {
	api = await startApi({ port: PORT })
	const cookie = await teacherCookie(api)
	done = await run({ api, cookie, ids, today: todayVn(), before: failures })
	check('api log has no fixture name', !api.logs().includes('Alex Example'))
} catch (err) {
	failures += 1
	console.log(`FAIL ${section} crashed ${err instanceof Error ? err.message : String(err)}`)
} finally {
	if (api) await api.stop()
	removeOwn(ids)
}
if (failures === 0 && done) console.log(done)
else console.log(`${section} failures ${failures}`)
process.exit(failures === 0 && done ? 0 : 1)
