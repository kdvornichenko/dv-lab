import { randomUUID } from 'node:crypto'

import * as core from '../../packages/core/src/index.ts'
import { TEACHER_LOGIN, call, quote, sql, startApi, studentCookie, teacherCookie } from './api.mjs'

const VN = core.SCHEDULE_TIME_ZONE
const PORT = 4202
const FIXTURE_PREFIXES = ['Alex Example 211', 'Alex Example 212']
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
	removed += sql(`delete from payments where student_id in (${cards})`).rowCount
	removed += sql(`delete from lesson_exceptions where series_id in (${series})`).rowCount
	removed += sql(`delete from lessons where student_id in (${cards})`).rowCount
	removed += sql(`delete from lesson_series where student_id in (${cards})`).rowCount
	removed += sql(`delete from students where ${where}`).rowCount
	return removed
}

function removeTails() {
	let removed = 0
	for (const prefix of FIXTURE_PREFIXES) {
		removed += removeCards(`display_name like ${quote(`${prefix}%`)} and import_key is null`)
	}
	console.log(`fixture tails removed ${removed}`)
}

function removeOwn(ids) {
	if (ids.length === 0) return
	removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
}

const cardBody = (displayName) => ({
	displayName,
	rateMinor: null,
	currency: null,
	defaultLessonMinutes: 60,
	parent: null,
	level: null,
	goals: null,
	timeZone: null,
})

async function createCard(ctx, displayName) {
	const res = await call(ctx.api, 'POST', '/students', { cookie: ctx.cookie, body: cardBody(displayName) })
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

const createLesson = (ctx, studentId, date, startTime, durationMinutes = 60) =>
	post(ctx, '/lessons', { studentId, date, startTime, durationMinutes, repeats: 'once' })

async function onceLesson(ctx, studentId, date, startTime, durationMinutes = 60) {
	const res = await createLesson(ctx, studentId, date, startTime, durationMinutes)
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

async function setOpening(ctx, studentId, lessonsHundredths, on) {
	const res = await call(ctx.api, 'PUT', `/students/${studentId}/opening-balance`, {
		cookie: ctx.cookie,
		body: { lessonsHundredths, on },
	})
	if (res.status !== 200) throw new Error(`opening balance returned ${res.status}`)
}

async function balances(ctx, studentId) {
	const list = await call(ctx.api, 'GET', '/students', { cookie: ctx.cookie })
	const profile = await call(ctx.api, 'GET', `/students/${studentId}`, { cookie: ctx.cookie })
	const row = list.json?.students?.find((student) => student.id === studentId)
	return { list: row?.balanceMinutes, profile: profile.json?.student?.balanceMinutes, detail: profile.json?.student }
}

async function expectBalance(ctx, studentId, label, expected) {
	const got = await balances(ctx, studentId)
	check(
		`${label}: balance ${expected} in the list and the profile`,
		got.list === expected && got.profile === expected,
		`list ${got.list} profile ${got.profile}`
	)
	return got
}

const markSingle = (ctx, lessonId, kind) => post(ctx, `/lessons/${lessonId}/mark`, { kind })

async function stepOk(label, send) {
	const res = await send()
	if (res.status !== 200 && res.status !== 201) {
		failures += 1
		console.log(`FAIL ${label} returned ${res.status} ${JSON.stringify(res.json?.error ?? '')}`)
	}
	return res
}

async function sectionBalance(ctx) {
	const studentId = await createCard(ctx, 'Alex Example 2120')
	const opening = core.addDays(ctx.today, -3)
	const dayAfter = core.addDays(opening, 1)
	await setOpening(ctx, studentId, 0, opening)
	const hour = await onceLesson(ctx, studentId, dayAfter, '10:00')
	const long = await onceLesson(ctx, studentId, core.addDays(opening, 2), '10:00', 90)
	const night = await onceLesson(ctx, studentId, dayAfter, '00:30')
	const openingDay = await onceLesson(ctx, studentId, opening, '10:00')
	const nightAt = core.zonedInstant(dayAfter, '00:30', VN)
	check(
		'the 00:30 Vietnam lesson is still the opening day in Moscow and UTC',
		core.zonedParts(nightAt, 'Europe/Moscow').date === opening &&
			nightAt.toISOString().slice(0, 10) === opening &&
			core.scheduleDate(nightAt) === dayAfter
	)
	await expectBalance(ctx, studentId, 'opening 0 with unmarked lessons', 0)
	await stepOk('done of the 60 minute lesson', () => markSingle(ctx, hour, 'done'))
	await expectBalance(ctx, studentId, 'done of the 60 minute lesson', -60)
	await stepOk('done of the 90 minute lesson', () => markSingle(ctx, long, 'done'))
	await expectBalance(ctx, studentId, 'done of the 90 minute lesson', -150)
	await stepOk('done of the opening day lesson', () => markSingle(ctx, openingDay, 'done'))
	await expectBalance(ctx, studentId, 'done on the opening day does not count', -150)
	await stepOk('done of the night lesson', () => markSingle(ctx, night, 'done'))
	await expectBalance(ctx, studentId, 'done of the night lesson after the opening day', -210)
	await stepOk('none of the 90 minute lesson', () => markSingle(ctx, long, 'none'))
	await expectBalance(ctx, studentId, 'none of the 90 minute lesson', -120)
	await stepOk('no_show of the 90 minute lesson', () => markSingle(ctx, long, 'no_show'))
	await expectBalance(ctx, studentId, 'no_show of the 90 minute lesson deducts by default', -210)
	await stepOk('cancel of the started 90 minute lesson', () => post(ctx, `/lessons/${long}/cancel`))
	await expectBalance(ctx, studentId, 'cancel of the started 90 minute lesson', -120)
	const kept = lessonMarks(long)
	check('cancel keeps the no_show mark row', kept.length === 1 && kept[0].kind === 'no_show')
	await stepOk('restore of the 90 minute lesson', () => post(ctx, `/lessons/${long}/restore`))
	await expectBalance(ctx, studentId, 'restore of the 90 minute lesson', -210)
	await stepOk('payment after the opening day', () =>
		call(ctx.api, 'POST', '/payments', {
			cookie: ctx.cookie,
			body: {
				studentId,
				paidOn: ctx.today,
				amountMinor: 100000,
				currency: 'RUB',
				lessonsHundredths: 200,
				note: null,
			},
		})
	)
	await expectBalance(ctx, studentId, 'payment of 2 lessons after the opening day', -210 + 2 * 60)
	const seriesOn = core.addDays(opening, 2)
	const seriesId = insertSeries(studentId, core.weekdayOf(seriesOn), '14:00', core.addDays(seriesOn, -14))
	await stepOk('done of a series occurrence', () =>
		post(ctx, occurrencePath(seriesId, seriesOn, 'mark'), { kind: 'done' })
	)
	await expectBalance(ctx, studentId, 'done of a series occurrence', -150)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(seriesOn)}, 'moved', ${quote(instant(opening, '15:00'))}, 60)`
	)
	await expectBalance(ctx, studentId, 'the marked occurrence moved onto the opening day stops counting', -90)
	return 'SCHEDULE_LEDGER_BALANCE_OK'
}

const patchCard = (ctx, studentId, body) =>
	call(ctx.api, 'PATCH', `/students/${studentId}`, { cookie: ctx.cookie, body })

async function sectionFlag(ctx) {
	const name = 'Alex Example 2121'
	const studentId = await createCard(ctx, name)
	const opening = core.addDays(ctx.today, -3)
	await setOpening(ctx, studentId, 200, opening)
	const lessonId = await onceLesson(ctx, studentId, core.addDays(opening, 1), '10:00')
	await stepOk('no_show of the past lesson', () => markSingle(ctx, lessonId, 'no_show'))
	const first = await expectBalance(ctx, studentId, 'no_show with the flag on', 60)
	check('new card has noShowDeducts true', first.detail?.noShowDeducts === true)

	const off = await patchCard(ctx, studentId, { ...cardBody(name), noShowDeducts: false })
	check(
		'PATCH with noShowDeducts false gives 200 and the flag off',
		off.status === 200 && off.json?.student?.noShowDeducts === false,
		`status ${off.status} ${JSON.stringify(off.json?.student?.noShowDeducts)}`
	)
	const offBalance = await expectBalance(ctx, studentId, 'flag off returns the no_show deduction', 120)
	check('profile shows the flag off', offBalance.detail?.noShowDeducts === false)
	const rows = lessonMarks(lessonId)
	check('flag off keeps the no_show mark row', rows.length === 1 && rows[0].kind === 'no_show')

	const renamed = await patchCard(ctx, studentId, cardBody(`${name} B`))
	check(
		'PATCH without noShowDeducts gives 200 and keeps the flag off',
		renamed.status === 200 &&
			renamed.json?.student?.noShowDeducts === false &&
			renamed.json?.student?.displayName === `${name} B`,
		`status ${renamed.status} ${JSON.stringify(renamed.json?.student?.noShowDeducts)}`
	)
	await expectBalance(ctx, studentId, 'PATCH without the field leaves the column', 120)

	const on = await patchCard(ctx, studentId, { ...cardBody(`${name} B`), noShowDeducts: true })
	check('PATCH with noShowDeducts true gives 200', on.status === 200 && on.json?.student?.noShowDeducts === true)
	await expectBalance(ctx, studentId, 'flag on deducts the no_show again', 60)

	const created = await call(ctx.api, 'POST', '/students', {
		cookie: ctx.cookie,
		body: cardBody('Alex Example 2121 C'),
	})
	if (created.status === 201) ctx.ids.push(created.json.student.id)
	check(
		'POST without noShowDeducts gives the flag true',
		created.status === 201 && created.json?.student?.noShowDeducts === true,
		`status ${created.status}`
	)
	const wrong = await patchCard(ctx, studentId, { ...cardBody(`${name} B`), noShowDeducts: 'no' })
	check('PATCH with a non-boolean flag gives 400', wrong.status === 400, `status ${wrong.status}`)
	return 'SCHEDULE_LEDGER_FLAG_OK'
}

function removeTeacherSettings() {
	sql(
		`delete from teacher_settings where account_id in (select id from accounts where login = ${quote(TEACHER_LOGIN)} and role = 'teacher')`
	)
}

function insertLesson(studentId, startsAt) {
	return sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(startsAt)}, 60, 'scheduled') returning id`
	).rows[0].id
}

function soonToday(ctx) {
	const end = core.zonedInstant(core.addDays(ctx.today, 1), '00:00', VN).getTime() - 60000
	const inTwoHours = Math.floor((Date.now() + 7200000) / 1000) * 1000
	return new Date(Math.min(end, inTwoHours)).toISOString()
}

async function getToday(ctx, cookie = ctx.cookie) {
	return call(ctx.api, 'GET', '/today', { cookie })
}

async function todayCards(ctx, names) {
	const ids = {}
	for (const [key, name] of Object.entries(names)) ids[key] = await createCard(ctx, name)
	return ids
}

const blockKeys = (blocks) => new Set(blocks.map((block) => block.key))

const fixtureOrder = (rows, ids) => {
	const own = new Map(Object.entries(ids).map(([key, id]) => [id, key]))
	return rows.flatMap((row) => (own.has(row.id) ? [own.get(row.id)] : [])).join(',')
}

async function todayFixtures(ctx) {
	const opening = core.addDays(ctx.today, -3)
	const yesterday = core.addDays(ctx.today, -1)
	const tomorrow = core.addDays(ctx.today, 1)
	const card = await todayCards(ctx, {
		P: 'Alex Example 2122',
		Q: 'Alex Example 2123',
		R: 'Alex Example 2124',
		S: 'Alex Example 2125',
		T: 'Alex Example 2126',
		U: 'Alex Example 2127',
		A: 'Alex Example 2128',
		O: 'Alex Example 2129',
	})
	await setOpening(ctx, card.P, 200, opening)
	await setOpening(ctx, card.Q, 1000, opening)
	await setOpening(ctx, card.S, 0, opening)
	await setOpening(ctx, card.T, 0, opening)
	await setOpening(ctx, card.U, 0, opening)
	await setOpening(ctx, card.O, 1000, core.addDays(ctx.today, -2))
	const pDone = await onceLesson(ctx, card.P, core.addDays(opening, 1), '10:00')
	await stepOk('done of the P lesson', () => markSingle(ctx, pDone, 'done'))
	const sDone = await onceLesson(ctx, card.S, core.addDays(opening, 1), '11:00')
	await stepOk('done of the S lesson', () => markSingle(ctx, sDone, 'done'))
	await stepOk('archive of T', () =>
		call(ctx.api, 'POST', `/students/${card.T}/archive`, { cookie: ctx.cookie, body: {} })
	)

	const started = insertLesson(card.Q, startedToday(ctx))
	const upcoming = insertLesson(card.Q, soonToday(ctx))
	const qSeries = insertSeries(card.Q, core.weekdayOf(yesterday), '10:00', core.addDays(yesterday, -14))
	const marked = await onceLesson(ctx, card.Q, yesterday, '08:00')
	await stepOk('done of the yesterday lesson', () => markSingle(ctx, marked, 'done'))
	const cancelled = await onceLesson(ctx, card.Q, yesterday, '12:00')
	await stepOk('cancel of the yesterday lesson', () => post(ctx, `/lessons/${cancelled}/cancel`))

	const rSeries = insertSeries(card.R, core.weekdayOf(ctx.today), '12:00', core.addDays(ctx.today, -14))
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(rSeries)}, ${quote(ctx.today)}, 'moved', ${quote(instant(tomorrow, '10:00'))}, 60)`
	)

	const archivedLesson = await onceLesson(ctx, card.A, yesterday, '14:00')
	await stepOk('archive of the card with a lesson', () =>
		call(ctx.api, 'POST', `/students/${card.A}/archive`, { cookie: ctx.cookie, body: {} })
	)
	const openingDayLesson = await onceLesson(ctx, card.O, core.addDays(ctx.today, -2), '15:00')
	const afterOpeningLesson = await onceLesson(ctx, card.O, yesterday, '15:00')
	return {
		card,
		yesterday,
		keys: {
			started: `l:${started}`,
			upcoming: `l:${upcoming}`,
			qSeries: `s:${qSeries}:${yesterday}`,
			marked: `l:${marked}`,
			cancelled: `l:${cancelled}`,
			ghost: `s:${rSeries}:${ctx.today}`,
			archived: `l:${archivedLesson}`,
			openingDay: `l:${openingDayLesson}`,
			afterOpening: `l:${afterOpeningLesson}`,
		},
		seriesIds: [qSeries, rSeries],
	}
}

function todayChecks(ctx, res, fixtures) {
	const { keys, card, seriesIds } = fixtures
	const body = res.json ?? {}
	const lessons = body.lessons ?? []
	const earlier = body.earlier ?? []
	check('GET /today gives 200', res.status === 200, `status ${res.status}`)
	check('date is today in Vietnam', body.date === ctx.today, `${body.date}`)
	check('paysSoonLessons is 2 without a settings row', body.paysSoonLessons === 2, `${body.paysSoonLessons}`)
	const byKey = new Map(lessons.map((block) => [block.key, block]))
	const started = byKey.get(keys.started)
	check(
		'started unmarked lesson today is planned and can be marked',
		started?.outcome === 'planned' && started?.actions?.mark === true,
		JSON.stringify([started?.outcome, started?.actions])
	)
	const upcoming = byKey.get(keys.upcoming)
	check(
		'upcoming lesson today cannot be marked yet',
		upcoming?.outcome === 'planned' && upcoming?.actions?.mark === false,
		JSON.stringify([upcoming?.outcome, upcoming?.actions])
	)
	const ghost = byKey.get(keys.ghost)
	check(
		'occurrence moved from today to tomorrow is a ghost without actions',
		ghost?.outcome === 'moved' &&
			sameActions(ghost?.actions, { move: false, cancel: false, restore: false, mark: false }),
		JSON.stringify([ghost?.outcome, ghost?.actions])
	)
	const earlierKeys = blockKeys(earlier)
	check('yesterday unmarked series occurrence is in earlier', earlierKeys.has(keys.qSeries))
	check('yesterday marked lesson is not in earlier', !earlierKeys.has(keys.marked))
	check('yesterday cancelled lesson is not in earlier', !earlierKeys.has(keys.cancelled))
	check('lesson of an archived card is not in earlier', !earlierKeys.has(keys.archived))
	check('lesson on the opening day is not in earlier', !earlierKeys.has(keys.openingDay))
	check('lesson the day after the opening day is in earlier', earlierKeys.has(keys.afterOpening))
	const dayStart = core.zonedInstant(ctx.today, '00:00', VN).getTime()
	const times = earlier.map((block) => new Date(block.startsAt).getTime())
	check(
		'earlier is before today and oldest first',
		times.every((time, index) => time < dayStart && (index === 0 || times[index - 1] <= time))
	)
	check(
		'earlier has no ghosts and no marked or cancelled lessons',
		earlier.every((block) => block.outcome === 'planned')
	)
	const shownSeries = new Set((body.series ?? []).map((series) => series.id))
	check(
		'series of the shown lessons are in the answer',
		seriesIds.every((id) => shownSeries.has(id))
	)
	check('series have no duplicates', shownSeries.size === (body.series ?? []).length)
	const order = fixtureOrder(body.paysSoon ?? [], card)
	check('paysSoon among the fixtures is S, U, P', order === 'S,U,P', order)
}

async function sectionToday(ctx) {
	removeTeacherSettings()
	try {
		const fixtures = await todayFixtures(ctx)
		todayChecks(ctx, await getToday(ctx), fixtures)
		const saved = await call(ctx.api, 'PATCH', '/settings', { cookie: ctx.cookie, body: { paysSoonLessons: 0 } })
		check('PATCH /settings 0 gives 200', saved.status === 200, `status ${saved.status}`)
		const zero = await getToday(ctx)
		check('paysSoonLessons is 0 after the save', zero.json?.paysSoonLessons === 0)
		const order = fixtureOrder(zero.json?.paysSoon ?? [], fixtures.card)
		check('paysSoon among the fixtures with N = 0 is S, U', order === 'S,U', order)
		const student = await studentCookie(ctx.api)
		const denied = await getToday(ctx, student)
		check('GET /today as a student gives 403', denied.status === 403, `status ${denied.status}`)
		const anonymous = await call(ctx.api, 'GET', '/today')
		check('GET /today without a session gives 401', anonymous.status === 401, `status ${anonymous.status}`)
		check('GET /today is not cached', (zero.headers.get('cache-control') ?? '').includes('no-store'))
	} finally {
		removeTeacherSettings()
	}
	return 'SCHEDULE_LEDGER_TODAY_OK'
}

const SECTIONS = {
	marks: sectionMarks,
	past: sectionPast,
	cut: sectionCut,
	race: sectionRace,
	balance: sectionBalance,
	flag: sectionFlag,
	today: sectionToday,
}

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
