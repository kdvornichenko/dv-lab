import { randomUUID } from 'node:crypto'

import * as core from '../../packages/core/src/index.ts'
import { call, quote, sql, startApi, studentCookie, teacherCookie } from './api.mjs'

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

const createLesson = (ctx, studentId, date, startTime) =>
	post(ctx, '/lessons', { studentId, date, startTime, durationMinutes: 60, repeats: 'once' })

async function onceLesson(ctx, studentId, date, startTime) {
	const res = await createLesson(ctx, studentId, date, startTime)
	if (res.status !== 201) throw new Error(`single lesson create returned ${res.status}`)
	return res.json.lesson.id
}

function lessonMarks(lessonId) {
	return sql(`select kind from lesson_marks where lesson_id = ${quote(lessonId)}`).rows
}

async function expectStatus(label, send, status, code) {
	const res = await send()
	check(
		`${label} gives ${status}${code ? ` ${code}` : ''}`,
		res.status === status && (code === undefined || res.json?.error?.code === code),
		`got ${res.status} ${JSON.stringify(res.json?.error ?? '')}`
	)
	return res
}

async function marksPart2(ctx, first) {
	const { seriesId, date, key, studentId } = first
	const path = occurrencePath(seriesId, date, 'mark')
	const noShow = await post(ctx, path, { kind: 'no_show' })
	check(
		'mark no_show gives outcome no_show in the answer and the week',
		noShow.status === 200 &&
			noShow.json?.mark?.outcome === 'no_show' &&
			(await blockOf(ctx, date, key))[0]?.outcome === 'no_show',
		`status ${noShow.status}`
	)
	const none = await post(ctx, path, { kind: 'none' })
	const rows = seriesMarks(seriesId, date)
	const block = (await blockOf(ctx, date, key))[0]
	check(
		'mark none gives outcome planned and keeps the row with kind none',
		none.status === 200 &&
			none.json?.mark?.kind === 'none' &&
			none.json?.mark?.outcome === 'planned' &&
			block?.outcome === 'planned' &&
			block?.mark === 'none' &&
			rows.length === 1 &&
			rows[0].kind === 'none',
		`status ${none.status} rows ${rows.length}`
	)

	const pastDay = core.addDays(ctx.today, -3)
	const pastLesson = await onceLesson(ctx, studentId, pastDay, '09:00')
	const single = await post(ctx, `/lessons/${pastLesson}/mark`, {
		kind: 'done',
		expectedStartsAt: instant(pastDay, '09:00'),
	})
	check(
		'mark done of a past single lesson gives 200',
		single.status === 200 &&
			single.json?.mark?.ref?.kind === 'single' &&
			single.json?.mark?.ref?.lessonId === pastLesson &&
			single.json?.mark?.outcome === 'done' &&
			(await blockOf(ctx, pastDay, `l:${pastLesson}`))[0]?.outcome === 'done',
		`status ${single.status}`
	)
	check('past single lesson has one mark row', lessonMarks(pastLesson).length === 1)

	const futureDay = core.addDays(ctx.today, 3)
	const futureLesson = await onceLesson(ctx, studentId, futureDay, '09:00')
	for (const kind of ['done', 'none']) {
		await expectStatus(
			`mark ${kind} of a future single lesson`,
			() => post(ctx, `/lessons/${futureLesson}/mark`, { kind }),
			400,
			'lesson_not_started'
		)
	}
	check('future single lesson has no mark row', lessonMarks(futureLesson).length === 0)
	await expectStatus(
		'mark with a stale expectedStartsAt',
		() => post(ctx, path, { kind: 'done', expectedStartsAt: instant(date, '09:00') }),
		409,
		'lesson_changed'
	)
	await expectStatus(
		'mark of an unknown lesson',
		() => post(ctx, `/lessons/${randomUUID()}/mark`, { kind: 'done' }),
		404,
		'not_found'
	)
	await expectStatus('mark with kind held', () => post(ctx, path, { kind: 'held' }), 400, 'invalid_request')
	const student = await studentCookie(ctx.api)
	await expectStatus('mark as a student', () => post(ctx, path, { kind: 'done' }, student), 403)
	const after = seriesMarks(seriesId, date)
	check('refused marks keep the row with kind none', after.length === 1 && after[0].kind === 'none')
}

async function sectionMarks(ctx) {
	const first = await marksPart1(ctx)
	await marksPart2(ctx, first)
	return 'SCHEDULE_LEDGER_MARKS_OK'
}

async function pastSeriesOccurrence(ctx, studentId) {
	const date = core.addDays(ctx.today, -5)
	const seriesId = pastSeries(studentId, date, '11:00')
	const key = `s:${seriesId}:${date}`
	const startsAt = instant(date, '11:00')
	const block = async () => (await blockOf(ctx, date, key))[0]
	const markRow = () => seriesMarks(seriesId, date)
	const path = (action) => occurrencePath(seriesId, date, action)
	return {
		label: 'series occurrence',
		startsAt,
		block,
		markRow,
		path,
		cancelOutcome: (res) => res.json?.occurrence?.outcome,
	}
}

async function pastSingleLesson(ctx, studentId) {
	const date = core.addDays(ctx.today, -4)
	const lessonId = await onceLesson(ctx, studentId, date, '11:00')
	const startsAt = instant(date, '11:00')
	const block = async () => (await blockOf(ctx, date, `l:${lessonId}`))[0]
	const markRow = () => lessonMarks(lessonId)
	const path = (action) => `/lessons/${lessonId}/${action}`
	const cancelOutcome = (res) => (res.json?.lesson?.status === 'cancelled' ? 'cancelled' : res.json?.lesson?.status)
	return { label: 'single lesson', startsAt, block, markRow, path, cancelOutcome }
}

async function pastFlow(ctx, target) {
	const { label, startsAt, block, markRow, path } = target
	await expectStatus(`mark done of the past ${label}`, () => post(ctx, path('mark'), { kind: 'done' }), 200)
	const cancelled = await post(ctx, path('cancel'), { expectedStartsAt: startsAt })
	let shown = await block()
	let rows = markRow()
	check(
		`cancel of the marked past ${label} gives 200 and keeps the done mark`,
		cancelled.status === 200 &&
			target.cancelOutcome(cancelled) === 'cancelled' &&
			shown?.outcome === 'cancelled' &&
			shown?.mark === 'done' &&
			rows.length === 1 &&
			rows[0].kind === 'done',
		`status ${cancelled.status} ${JSON.stringify(shown?.outcome)} rows ${rows.length}`
	)
	check(
		`cancelled past ${label} can be restored and cannot be marked`,
		shown?.actions?.restore === true && shown?.actions?.mark === false && shown?.actions?.cancel === false,
		JSON.stringify(shown?.actions ?? null)
	)
	for (const kind of ['none', 'no_show']) {
		await expectStatus(
			`mark ${kind} of the cancelled past ${label}`,
			() => post(ctx, path('mark'), { kind }),
			409,
			'lesson_changed'
		)
	}
	rows = markRow()
	check(`cancelled past ${label} keeps the done mark`, rows.length === 1 && rows[0].kind === 'done')
	const restored = await post(ctx, path('restore'), { expectedStartsAt: startsAt })
	shown = await block()
	check(
		`restore of the past ${label} gives 200 and outcome done again`,
		restored.status === 200 && shown?.outcome === 'done' && shown?.mark === 'done',
		`status ${restored.status} ${JSON.stringify(shown?.outcome)}`
	)
	await expectStatus(
		`move of the started ${label}`,
		() => post(ctx, path('move'), { date: core.addDays(ctx.today, 2), startTime: '12:00' }),
		400,
		'lesson_in_past'
	)
}

async function sectionPast(ctx) {
	const studentId = await createCard(ctx, 'Alex Example 2114')
	await pastFlow(ctx, await pastSeriesOccurrence(ctx, studentId))
	await pastFlow(ctx, await pastSingleLesson(ctx, studentId))
	return 'SCHEDULE_LEDGER_PAST_OK'
}

const isServerError = (status) => status >= 500

async function racePart1(ctx) {
	const studentId = await createCard(ctx, 'Alex Example 2112')
	const date = core.addDays(ctx.today, -6)
	const seriesId = pastSeries(studentId, date, '08:00')
	const key = `s:${seriesId}:${date}`
	const kinds = ['done', 'no_show', 'none', 'done', 'no_show']
	const answers = await Promise.all(kinds.map((kind) => post(ctx, occurrencePath(seriesId, date, 'mark'), { kind })))
	const statuses = answers.map((res) => res.status)
	check(
		'five parallel marks give only 200 or 409',
		statuses.every((status) => status === 200 || status === 409) && !statuses.some(isServerError),
		statuses.join()
	)
	const rows = seriesMarks(seriesId, date)
	const block = (await blockOf(ctx, date, key))[0]
	const expected = { done: 'done', no_show: 'no_show', none: 'planned' }
	check(
		'one mark row after the parallel marks and the week agrees with it',
		rows.length === 1 &&
			kinds.includes(rows[0].kind) &&
			block?.mark === rows[0].kind &&
			block?.outcome === expected[rows[0].kind],
		`rows ${rows.length} ${rows[0]?.kind} ${block?.mark} ${block?.outcome}`
	)

	const second = core.addDays(date, -7)
	const markAndCancel = await Promise.all([
		post(ctx, occurrencePath(seriesId, second, 'mark'), { kind: 'done' }),
		post(ctx, occurrencePath(seriesId, second, 'cancel')),
	])
	await raceAgreement(
		ctx,
		'series occurrence',
		markAndCancel,
		() => seriesMarks(seriesId, second),
		async () => (await blockOf(ctx, second, `s:${seriesId}:${second}`))[0]
	)

	const lessonDay = core.addDays(ctx.today, -2)
	const lessonId = await onceLesson(ctx, studentId, lessonDay, '08:00')
	const lessonRace = await Promise.all([
		post(ctx, `/lessons/${lessonId}/mark`, { kind: 'done' }),
		post(ctx, `/lessons/${lessonId}/cancel`),
	])
	await raceAgreement(
		ctx,
		'single lesson',
		lessonRace,
		() => lessonMarks(lessonId),
		async () => (await blockOf(ctx, lessonDay, `l:${lessonId}`))[0]
	)
	if (failures === ctx.before) console.log('RACE_PART1_OK')
}

async function raceAgreement(ctx, label, [mark, cancel], markRow, block) {
	const statuses = [mark.status, cancel.status]
	check(
		`parallel mark and cancel of a ${label} give only 200 or 409`,
		statuses.every((status) => status === 200 || status === 409),
		statuses.join()
	)
	const rows = markRow()
	if (mark.status === 200) {
		check(
			`accepted mark of the ${label} is stored`,
			rows.length === 1 && rows[0].kind === 'done',
			`rows ${rows.length}`
		)
	}
	const shown = await block()
	const expected = cancel.status === 200 ? 'cancelled' : mark.status === 200 ? 'done' : 'planned'
	check(
		`week block of the ${label} agrees after the race`,
		shown?.outcome === expected,
		`${shown?.outcome} ${expected}`
	)
}

function startedToday(ctx) {
	const midnight = core.zonedInstant(ctx.today, '00:00', VN).getTime()
	const hourAgo = Math.floor((Date.now() - 3600000) / 1000) * 1000
	return new Date(Math.max(midnight, hourAgo)).toISOString()
}

async function movedIntoToday(ctx, name) {
	const studentId = await createCard(ctx, name)
	const originalOn = core.addDays(ctx.today, 8)
	const seriesId = insertSeries(studentId, core.weekdayOf(originalOn), '19:00', core.addDays(originalOn, -21))
	const startsAt = startedToday(ctx)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(originalOn)}, 'moved', ${quote(startsAt)}, 60)`
	)
	return { studentId, seriesId, originalOn, startsAt }
}

const cutBody = (ctx) => ({ from: ctx.today, weekday: core.weekdayOf(core.addDays(ctx.today, 2)), startTime: '10:00' })

async function todayBlocks(ctx, studentId) {
	return (await weekBlocks(ctx, ctx.today)).filter((block) => block.studentId === studentId)
}

function cutLessonMarks(studentId, startsAt) {
	return sql(
		`select l.id, m.kind from lessons l left join lesson_marks m on m.lesson_id = l.id where l.student_id = ${quote(studentId)} and l.starts_at = ${quote(startsAt)}`
	).rows
}

function sharedStarts(blocks) {
	const starts = blocks.map((block) => block.startsAt)
	return starts.length !== new Set(starts).size
}

async function cutFlow(ctx, name, label, send) {
	const fixture = await movedIntoToday(ctx, name)
	const { studentId, seriesId, originalOn, startsAt } = fixture
	sql(
		`insert into lesson_marks (series_id, original_on, kind) values (${quote(seriesId)}, ${quote(originalOn)}, 'done')`
	)
	const before = (await todayBlocks(ctx, studentId)).filter((block) => block.startsAt === startsAt)
	check(
		`before ${label} the moved lesson stands today with outcome done`,
		before.length === 1 && before[0].ref.kind === 'series' && before[0].outcome === 'done',
		JSON.stringify(before.map((block) => [block.ref.kind, block.outcome]))
	)
	const res = await send(fixture)
	check(`${label} gives 200`, res.status === 200, `got ${res.status} ${JSON.stringify(res.json?.error ?? '')}`)
	const rows = cutLessonMarks(studentId, startsAt)
	check(
		`${label} copies the done mark to the new lessons row`,
		rows.length === 1 && rows[0].kind === 'done',
		JSON.stringify(rows.map((row) => row.kind))
	)
	const old = seriesMarks(seriesId, originalOn)
	check(`${label} keeps the old mark row`, old.length === 1 && old[0].kind === 'done')
	const blocks = await todayBlocks(ctx, studentId)
	const at = blocks.filter((block) => block.startsAt === startsAt)
	check(
		`after ${label} the week shows the lesson once with outcome done`,
		at.length === 1 && at[0].ref.kind === 'single' && at[0].outcome === 'done' && !sharedStarts(blocks),
		JSON.stringify(at.map((block) => [block.ref.kind, block.outcome]))
	)
}

async function sectionCut(ctx) {
	await cutFlow(ctx, 'Alex Example 2111', 'series move', ({ seriesId }) =>
		post(ctx, `/series/${seriesId}/move`, cutBody(ctx))
	)
	await cutFlow(ctx, 'Alex Example 2111 E', 'series end', ({ seriesId }) =>
		post(ctx, `/series/${seriesId}/end`, { lastOn: ctx.today })
	)
	return 'SCHEDULE_LEDGER_CUT_OK'
}

async function racePart3(ctx) {
	const { studentId, seriesId, originalOn, startsAt } = await movedIntoToday(ctx, 'Alex Example 2113')
	const [mark, move] = await Promise.all([
		post(ctx, occurrencePath(seriesId, originalOn, 'mark'), { kind: 'done' }),
		post(ctx, `/series/${seriesId}/move`, cutBody(ctx)),
	])
	const statuses = [mark.status, move.status]
	check(
		'parallel mark and series move give only 200 or 409',
		statuses.every((status) => status === 200 || status === 409),
		statuses.join()
	)
	const blocks = await todayBlocks(ctx, studentId)
	const at = blocks.filter((block) => block.startsAt === startsAt)
	check('after the race no two blocks share a start', !sharedStarts(blocks) && at.length === 1, `blocks ${at.length}`)
	if (mark.status === 200) {
		check('accepted mark survives the series move once', at[0]?.outcome === 'done', `${at[0]?.outcome}`)
	}
	if (mark.status === 200 && move.status === 200) {
		const rows = cutLessonMarks(studentId, startsAt)
		check('the new lessons row carries the done mark', rows.length === 1 && rows[0].kind === 'done')
	}
}

async function sectionRace(ctx) {
	await racePart1(ctx)
	await racePart3(ctx)
	return 'SCHEDULE_LEDGER_RACE_OK'
}

const SECTIONS = { marks: sectionMarks, past: sectionPast, cut: sectionCut, race: sectionRace }

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
