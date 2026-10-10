import { randomUUID } from 'node:crypto'

import * as core from '../../packages/core/src/index.ts'
import { call, quote, sql, startApi, studentCookie, teacherCookie } from './api.mjs'

const VN = core.SCHEDULE_TIME_ZONE
const PORT = 4201
const FIXTURE_PREFIX = 'Alex Example 20'
const FIXTURE_NAME = 'Alex Example 2004'
let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures += 1
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const todayVn = () => core.zonedParts(new Date(), VN).date
const firstAfter = (date, weekday) => core.firstOnOrAfter(core.addDays(date, 1), weekday)
const instant = (date, time) => core.zonedInstant(date, time, VN).toISOString()

function removeCards(where) {
	const cards = `select id from students where ${where}`
	const series = `select id from lesson_series where student_id in (${cards})`
	let removed = 0
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

async function createCard(api, cookie, ids, displayName) {
	const res = await call(api, 'POST', '/students', {
		cookie,
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
	ids.push(res.json.student.id)
	return res.json.student.id
}

const createLesson = (api, cookie, body) => call(api, 'POST', '/schedule/lessons', { cookie, body })

const readWeek = (api, cookie, start) =>
	call(api, 'GET', `/schedule/week?start=${encodeURIComponent(start)}`, { cookie })

async function sectionRead(api, cookie, ids) {
	const name = `${FIXTURE_NAME} A`
	const studentId = await createCard(api, cookie, ids, name)
	const today = todayVn()
	const wednesday = firstAfter(today, 3)
	const friday = firstAfter(today, 5)
	const past = core.addDays(today, -10)

	const weekly = await createLesson(api, cookie, {
		studentId,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	const series = weekly.json?.series
	check(
		'weekly create gives 201 series on weekday 3 at 18:00 from the chosen Wednesday',
		weekly.status === 201 && series?.weekday === 3 && series?.startTime === '18:00' && series?.startsOn === wednesday,
		`status ${weekly.status}`
	)
	const seriesId = series?.id
	console.log(`series ${seriesId}`)

	const once = await createLesson(api, cookie, {
		studentId,
		date: friday,
		startTime: '09:00',
		durationMinutes: 45,
		repeats: 'once',
	})
	const lessonId = once.json?.lesson?.id
	check(
		'once create gives 201 lesson',
		once.status === 201 &&
			once.json?.lesson?.startsAt === instant(friday, '09:00') &&
			once.json?.lesson?.status === 'scheduled',
		`status ${once.status}`
	)
	const pastOnce = await createLesson(api, cookie, {
		studentId,
		date: past,
		startTime: '12:00',
		durationMinutes: 60,
		repeats: 'once',
	})
	const pastLessonId = pastOnce.json?.lesson?.id
	check('once create in the past gives 201', pastOnce.status === 201, `status ${pastOnce.status}`)

	const firstMonday = core.mondayOf(wednesday)
	const sqlInstant = sql(`select ((date ${quote(wednesday)} + time '18:00') at time zone 'Asia/Ho_Chi_Minh') as t`)
		.rows[0].t
	const weeks = [0, 1, 2].map((index) => core.addDays(firstMonday, index * 7))
	for (const [index, monday] of weeks.entries()) {
		const res = await readWeek(api, cookie, monday)
		const date = core.addDays(wednesday, index * 7)
		const own = (res.json?.blocks ?? []).filter(
			(block) => block.ref.kind === 'series' && block.ref.seriesId === seriesId
		)
		const block = own[0]
		const expected = instant(date, '18:00')
		check(
			`week ${monday} has one series block at ${date} 18:00`,
			res.status === 200 &&
				own.length === 1 &&
				block.startsAt === expected &&
				block.status === 'scheduled' &&
				block.studentName === name &&
				block.studentStatus === 'active' &&
				block.key === `s:${seriesId}:${date}` &&
				block.changeable === true &&
				(res.json?.series ?? []).some((rule) => rule.id === seriesId && rule.startTime === '18:00'),
			`status ${res.status} blocks ${own.length}`
		)
		if (index === 0) {
			check('first series block equals SQL instant', block?.startsAt === new Date(sqlInstant).toISOString())
		}
	}
	const before = core.addDays(firstMonday, -7)
	const beforeWeek = await readWeek(api, cookie, before)
	check(
		`week ${before} before the series has no series block`,
		beforeWeek.status === 200 &&
			!(beforeWeek.json?.blocks ?? []).some((block) => block.ref.kind === 'series' && block.ref.seriesId === seriesId)
	)

	const lessonMonday = core.mondayOf(friday)
	const checked = [...new Set([before, ...weeks, lessonMonday])]
	let lessonWeeks = 0
	let lessonInOwnWeek = false
	for (const monday of checked) {
		const res = await readWeek(api, cookie, monday)
		const found = (res.json?.blocks ?? []).filter((block) => block.key === `l:${lessonId}`)
		if (found.length > 0) lessonWeeks += 1
		if (monday === lessonMonday && found.length === 1 && found[0].startsAt === instant(friday, '09:00')) {
			lessonInOwnWeek = found[0].durationMinutes === 45 && found[0].changeable === true
		}
	}
	check(`single lesson shows only in its week of ${checked.length} weeks`, lessonWeeks === 1 && lessonInOwnWeek)

	const pastWeek = await readWeek(api, cookie, core.mondayOf(past))
	const pastBlock = (pastWeek.json?.blocks ?? []).find((block) => block.key === `l:${pastLessonId}`)
	check('past lesson block is not changeable', pastWeek.status === 200 && pastBlock?.changeable === false)

	const stored = sql(`select start_time::text as t from lesson_series where id = ${quote(seriesId)}`).rows[0]?.t
	check('series start_time is stored as 18:00:00', stored === '18:00:00', String(stored))

	const repeat = await createLesson(api, cookie, {
		studentId,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	const seriesCount = sql(`select count(*)::int as n from lesson_series where student_id = ${quote(studentId)}`).rows[0]
		.n
	check(
		'repeated weekly request gives 200 with the same series and no second row',
		repeat.status === 200 && repeat.json?.series?.id === seriesId && seriesCount === 1,
		`status ${repeat.status} series ${seriesCount}`
	)

	const todayMidnight = await createLesson(api, cookie, {
		studentId,
		date: today,
		startTime: '00:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	check(
		'weekly today at 00:00 starts a week later',
		todayMidnight.status === 201 && todayMidnight.json?.series?.startsOn === core.addDays(today, 7),
		`status ${todayMidnight.status} startsOn ${todayMidnight.json?.series?.startsOn}`
	)

	const refusals = [
		[
			'weekly on yesterday',
			() =>
				createLesson(api, cookie, {
					studentId,
					date: core.addDays(today, -1),
					startTime: '18:00',
					durationMinutes: 60,
					repeats: 'weekly',
				}),
			400,
		],
		['week start on Tuesday', () => readWeek(api, cookie, core.addDays(firstMonday, 1)), 400],
		['week start 1999-12-27', () => readWeek(api, cookie, '1999-12-27'), 400],
		['week start 2101-01-03', () => readWeek(api, cookie, '2101-01-03'), 400],
		['week start x', () => readWeek(api, cookie, 'x'), 400],
		[
			'startTime 24:00',
			() =>
				createLesson(api, cookie, {
					studentId,
					date: friday,
					startTime: '24:00',
					durationMinutes: 60,
					repeats: 'once',
				}),
			400,
		],
		[
			'durationMinutes 10',
			() =>
				createLesson(api, cookie, {
					studentId,
					date: friday,
					startTime: '10:00',
					durationMinutes: 10,
					repeats: 'once',
				}),
			400,
		],
		[
			'unknown studentId',
			() =>
				createLesson(api, cookie, {
					studentId: randomUUID(),
					date: friday,
					startTime: '10:00',
					durationMinutes: 60,
					repeats: 'once',
				}),
			400,
		],
		[
			'POST without Origin',
			() =>
				call(api, 'POST', '/schedule/lessons', {
					cookie,
					origin: false,
					body: { studentId, date: friday, startTime: '10:00', durationMinutes: 60, repeats: 'once' },
				}),
			403,
		],
		['GET week without cookie', () => call(api, 'GET', `/schedule/week?start=${firstMonday}`), 401],
	]
	for (const [label, send, status] of refusals) {
		const res = await send()
		check(`${label} gives ${status}`, res.status === status, `got ${res.status}`)
	}

	const student = await studentCookie(api)
	const asStudent = await call(api, 'GET', `/schedule/week?start=${firstMonday}`, { cookie: student })
	check('student session gives 403', asStudent.status === 403, `got ${asStudent.status}`)

	const archived = await call(api, 'POST', `/students/${studentId}/archive`, { cookie })
	const onArchived = await createLesson(api, cookie, {
		studentId,
		date: friday,
		startTime: '10:00',
		durationMinutes: 60,
		repeats: 'once',
	})
	check(
		'archived card gives 400',
		archived.status === 200 && onArchived.status === 400,
		`archive ${archived.status} create ${onArchived.status}`
	)
	const lessonsAfter = sql(`select count(*)::int as n from lessons where student_id = ${quote(studentId)}`).rows[0].n
	check('refused requests stored no lessons', lessonsAfter === 2, `lessons ${lessonsAfter}`)

	return 'SCHEDULE_API_READ_OK'
}

async function sectionNext(api, cookie, ids) {
	const withLessons = await createCard(api, cookie, ids, `${FIXTURE_NAME} B`)
	const withoutLessons = await createCard(api, cookie, ids, `${FIXTURE_NAME} C`)
	const today = todayVn()
	const wednesday = firstAfter(today, 3)
	const tuesday = firstAfter(today, 2)
	const weekly = await createLesson(api, cookie, {
		studentId: withLessons,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	if (weekly.status !== 201) throw new Error(`series create returned ${weekly.status}`)
	const seriesId = weekly.json.series.id
	const movedTo = instant(tuesday, '10:00')
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(wednesday)}, 'moved', ${quote(movedTo)}, 60)`
	)
	const mondayNoon = core.zonedInstant(core.addDays(tuesday, -1), '12:00', VN)
	const cancelledAt = mondayNoon.getTime() > Date.now() ? mondayNoon.toISOString() : instant(tuesday, '08:00')
	sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(withLessons)}, ${quote(cancelledAt)}, 60, 'cancelled')`
	)
	console.log(`series ${seriesId} moved from ${wednesday} to ${tuesday} 10:00, cancelled lesson at ${cancelledAt}`)

	const list = await call(api, 'GET', '/students', { cookie })
	const rows = list.json?.students ?? []
	const rowB = rows.find((row) => row.id === withLessons)
	const rowC = rows.find((row) => row.id === withoutLessons)
	check(
		'list gives the moved Tuesday 10:00 as next lesson for the card with lessons',
		list.status === 200 && rowB?.nextLessonAt === movedTo,
		`got ${rowB?.nextLessonAt}`
	)
	check(
		'list gives null next lesson for the card without lessons',
		rowC !== undefined && rowC.nextLessonAt === null,
		`got ${rowC?.nextLessonAt}`
	)
	check(
		'every list row carries nextLessonAt',
		rows.length > 0 && rows.every((row) => row.nextLessonAt === null || typeof row.nextLessonAt === 'string')
	)

	const detail = await call(api, 'GET', `/students/${withLessons}`, { cookie })
	check(
		'card detail gives the same next lesson',
		detail.status === 200 && detail.json?.student?.nextLessonAt === movedTo,
		`got ${detail.json?.student?.nextLessonAt}`
	)

	const now = Date.now()
	const thisMonday = core.mondayOf(today)
	const blocks = []
	for (const monday of [thisMonday, core.addDays(thisMonday, 7)]) {
		const res = await readWeek(api, cookie, monday)
		if (res.status !== 200) throw new Error(`week ${monday} returned ${res.status}`)
		blocks.push(...res.json.blocks.filter((block) => block.studentId === withLessons))
	}
	const future = blocks
		.filter((block) => block.status === 'scheduled' && new Date(block.startsAt).getTime() >= now)
		.map((block) => block.startsAt)
		.sort()
	check(
		'earliest future scheduled week block equals nextLessonAt',
		future[0] === movedTo && future[0] === rowB?.nextLessonAt,
		`earliest ${future[0]}`
	)
	check(
		'week shows the cancelled lesson and the moved ghost but neither is next',
		blocks.some((block) => block.status === 'cancelled' && block.startsAt === cancelledAt) &&
			blocks.some((block) => block.status === 'moved' && block.movedTo === movedTo)
	)

	return 'SCHEDULE_API_NEXT_OK'
}

const SECTIONS = { read: sectionRead, next: sectionNext }

const section = process.argv[2]
const run = SECTIONS[section]
if (!run) {
	console.log(`usage: node scripts/dev-checks/schedule-api.mjs ${Object.keys(SECTIONS).join('|')}`)
	process.exit(2)
}

removeTails()
const ids = []
let api = null
let done = null
try {
	api = await startApi({ port: PORT })
	const cookie = await teacherCookie(api)
	done = await run(api, cookie, ids)
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
