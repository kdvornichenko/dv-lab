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
	const longer = await createLesson(api, cookie, {
		studentId,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 90,
		repeats: 'weekly',
	})
	check(
		'weekly request with another length gives 201 with a second series of that length',
		longer.status === 201 && longer.json?.series?.id !== seriesId && longer.json?.series?.durationMinutes === 90,
		`status ${longer.status} ${JSON.stringify(longer.json?.series ?? null)}`
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

const CHANGES_NAME = 'Alex Example 2006'

const post = (api, cookie, path, body = {}) => call(api, 'POST', `/schedule${path}`, { cookie, body })

const occurrencePath = (seriesId, date, action) => `/series/${seriesId}/occurrences/${date}/${action}`

async function weekBlocks(api, cookie, monday) {
	const res = await readWeek(api, cookie, monday)
	if (res.status !== 200) throw new Error(`week ${monday} returned ${res.status}`)
	return res.json.blocks
}

async function seriesBlocks(api, cookie, date, seriesId) {
	const blocks = await weekBlocks(api, cookie, core.mondayOf(date))
	return blocks.filter((block) => block.ref.kind === 'series' && block.ref.seriesId === seriesId)
}

async function pastSnapshot(ctx) {
	const weeks = []
	for (const offset of [-21, -14, -7]) {
		const blocks = await weekBlocks(ctx.api, ctx.cookie, core.addDays(ctx.thisMonday, offset))
		weeks.push(blocks.filter((block) => block.ref.kind === 'series' && block.ref.seriesId === ctx.s1))
	}
	return JSON.stringify(weeks)
}

function countRows(ctx) {
	const list = ctx.ids.map(quote).join(', ')
	const row = sql(
		`select (select count(*)::int from lesson_series where student_id in (${list})) as series, (select count(*)::int from lessons where student_id in (${list})) as lessons, (select count(*)::int from lesson_exceptions e join lesson_series s on s.id = e.series_id where s.student_id in (${list})) as exceptions`
	).rows[0]
	ctx.counts.push(row)
	return row
}

function exceptionRow(seriesId, originalOn) {
	return sql(
		`select kind, starts_at from lesson_exceptions where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`
	).rows[0]
}

function insertSeries(studentId, weekday, startTime, startsOn, endsOn) {
	const end = endsOn === null ? 'null' : quote(endsOn)
	return sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(studentId)}, ${weekday}, ${quote(startTime)}, 60, ${quote(startsOn)}, ${end}) returning id`
	).rows[0].id
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

async function partPastOrigin(ctx) {
	const { api, cookie, today } = ctx
	const cardC = await createCard(api, cookie, ctx.ids, `${CHANGES_NAME} C`)
	const yesterday = core.addDays(today, -1)
	const natural = instant(yesterday, '07:00')
	const target = instant(core.addDays(today, 2), '07:00')
	const s9 = insertSeries(cardC, core.weekdayOf(yesterday), '07:00', core.addDays(yesterday, -7), null)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(s9)}, ${quote(yesterday)}, 'moved', ${quote(target)}, 60)`
	)
	countRows(ctx)
	const key = `s:${s9}:${yesterday}`
	const placed = async () => {
		const blocks = [
			...(await seriesBlocks(api, cookie, yesterday, s9)),
			...(await seriesBlocks(api, cookie, core.addDays(today, 2), s9)),
		]
		const unique = new Map(blocks.map((block) => [`${block.key}|${block.startsAt}|${block.status}`, block]))
		return [...unique.values()].filter((block) => block.key === key)
	}
	const cancelled = await post(api, cookie, occurrencePath(s9, yesterday, 'cancel'), { expectedStartsAt: target })
	check(
		'cancel of a lesson moved from yesterday to the future gives 200 on the moved time',
		cancelled.status === 200 &&
			cancelled.json?.occurrence?.status === 'cancelled' &&
			cancelled.json?.occurrence?.startsAt === target,
		`status ${cancelled.status} ${JSON.stringify(cancelled.json ?? null)}`
	)
	countRows(ctx)
	let blocks = await placed()
	check(
		'the cancelled lesson stands on the moved place, changeable, and yesterday keeps the ghost',
		blocks.length === 2 &&
			blocks.some(
				(block) =>
					block.status === 'cancelled' &&
					block.startsAt === target &&
					block.movedFrom === natural &&
					block.changeable === true
			) &&
			blocks.some((block) => block.status === 'moved' && block.startsAt === natural && block.movedTo === target),
		JSON.stringify(blocks.map((block) => [block.status, block.startsAt, block.changeable]))
	)
	const restored = await post(api, cookie, occurrencePath(s9, yesterday, 'restore'), { expectedStartsAt: target })
	check(
		'restore of that lesson gives 200 and returns it to the moved place',
		restored.status === 200 &&
			restored.json?.occurrence?.status === 'moved' &&
			restored.json?.occurrence?.startsAt === target,
		`status ${restored.status} ${JSON.stringify(restored.json ?? null)}`
	)
	countRows(ctx)
	blocks = await placed()
	check(
		'after restore the lesson is planned on the moved place again',
		blocks.some((block) => block.status === 'scheduled' && block.startsAt === target) &&
			exceptionRow(s9, yesterday)?.kind === 'moved'
	)
}

async function partOccurrence(ctx) {
	const { api, cookie, s1, dW, today } = ctx
	const at = (date) => instant(date, '18:00')
	const key = (date) => `s:${s1}:${date}`
	const friday = core.addDays(dW, 2)
	const mondayNext = core.addDays(dW, 5)
	const dW7 = core.addDays(dW, 7)
	const dW14 = core.addDays(dW, 14)

	const moved = await post(api, cookie, occurrencePath(s1, dW, 'move'), { date: friday, startTime: '10:00' })
	check(
		'move dW to Friday 10:00 gives 200 moved',
		moved.status === 200 &&
			moved.json?.occurrence?.status === 'moved' &&
			moved.json?.occurrence?.startsAt === instant(friday, '10:00'),
		`status ${moved.status}`
	)
	countRows(ctx)
	let week = await seriesBlocks(api, cookie, dW, s1)
	const ghost = week.find((block) => block.key === key(dW) && block.status === 'moved')
	const destination = week.find((block) => block.key === key(dW) && block.status === 'scheduled')
	check(
		'week dW has the moved ghost and the Friday destination',
		week.length === 2 &&
			ghost?.startsAt === at(dW) &&
			ghost?.movedTo === instant(friday, '10:00') &&
			destination?.startsAt === instant(friday, '10:00') &&
			destination?.movedFrom === at(dW)
	)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'next Wednesday is unchanged',
		week.length === 1 && week[0].key === key(dW7) && week[0].status === 'scheduled' && week[0].startsAt === at(dW7)
	)

	const across = await post(api, cookie, occurrencePath(s1, dW14, 'move'), {
		date: mondayNext,
		startTime: '12:00',
		expectedStartsAt: at(dW14),
	})
	check('move dW+14 to Monday of week dW+7 gives 200', across.status === 200, `status ${across.status}`)
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 has the destination from dW+14 and its own Wednesday',
		week.length === 2 &&
			week.some(
				(block) =>
					block.key === key(dW14) &&
					block.status === 'scheduled' &&
					block.startsAt === instant(mondayNext, '12:00') &&
					block.movedFrom === at(dW14)
			) &&
			week.some((block) => block.key === key(dW7) && block.status === 'scheduled')
	)
	week = await seriesBlocks(api, cookie, dW14, s1)
	check(
		'week dW+14 has the ghost of the moved Wednesday',
		week.length === 1 && week[0].status === 'moved' && week[0].movedTo === instant(mondayNext, '12:00')
	)

	const cancelled = await post(api, cookie, occurrencePath(s1, dW7, 'cancel'))
	check(
		'cancel dW+7 gives 200 cancelled',
		cancelled.status === 200 && cancelled.json?.occurrence?.status === 'cancelled',
		`status ${cancelled.status}`
	)
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 shows the cancelled Wednesday',
		week.some((block) => block.key === key(dW7) && block.status === 'cancelled' && block.startsAt === at(dW7))
	)
	await expectStatus('second cancel of dW+7', () => post(api, cookie, occurrencePath(s1, dW7, 'cancel')), 409)
	const restored = await post(api, cookie, occurrencePath(s1, dW7, 'restore'), { expectedStartsAt: at(dW7) })
	check(
		'restore dW+7 gives 200 scheduled',
		restored.status === 200 && restored.json?.occurrence?.status === 'scheduled',
		`status ${restored.status}`
	)
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 shows the Wednesday scheduled again',
		week.some((block) => block.key === key(dW7) && block.status === 'scheduled' && block.startsAt === at(dW7))
	)
	check('exception row of dW+7 stays with kind restored', exceptionRow(s1, dW7)?.kind === 'restored')
	await expectStatus(
		'restore of a scheduled occurrence',
		() => post(api, cookie, occurrencePath(s1, dW7, 'restore')),
		409
	)

	const cancelMoved = await post(api, cookie, occurrencePath(s1, dW14, 'cancel'), {
		expectedStartsAt: instant(mondayNext, '12:00'),
	})
	check('cancel the moved dW+14 gives 200', cancelMoved.status === 200, `status ${cancelMoved.status}`)
	countRows(ctx)
	const mondayNoon = instant(mondayNext, '12:00')
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 shows the moved dW+14 cancelled on Monday 12:00 with Return to schedule allowed',
		week.some(
			(block) =>
				block.key === key(dW14) &&
				block.status === 'cancelled' &&
				block.startsAt === mondayNoon &&
				block.movedFrom === at(dW14) &&
				block.changeable === true
		)
	)
	week = await seriesBlocks(api, cookie, dW14, s1)
	check(
		'week dW+14 keeps the ghost of the moved Wednesday',
		week.length === 1 && week[0].status === 'moved' && week[0].startsAt === at(dW14) && week[0].movedTo === mondayNoon
	)
	const history = exceptionRow(s1, dW14)
	check(
		'cancelled dW+14 keeps the moved time in its row',
		history?.kind === 'cancelled' &&
			history?.starts_at !== null &&
			new Date(history.starts_at).toISOString() === mondayNoon
	)
	await expectStatus(
		'restore dW+14 with the natural time as expectedStartsAt',
		() => post(api, cookie, occurrencePath(s1, dW14, 'restore'), { expectedStartsAt: at(dW14) }),
		409
	)
	const back = await post(api, cookie, occurrencePath(s1, dW14, 'restore'), { expectedStartsAt: mondayNoon })
	check(
		'restore dW+14 returns it to Monday 12:00',
		back.status === 200 && back.json?.occurrence?.status === 'moved' && back.json?.occurrence?.startsAt === mondayNoon,
		`status ${back.status} ${JSON.stringify(back.json?.occurrence ?? null)}`
	)
	countRows(ctx)
	const restoredRow = exceptionRow(s1, dW14)
	check(
		'restored dW+14 row is moved with the Monday time',
		restoredRow?.kind === 'moved' && new Date(restoredRow.starts_at).toISOString() === mondayNoon
	)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 shows the dW+14 lesson planned on Monday 12:00 again',
		week.some((block) => block.key === key(dW14) && block.status === 'scheduled' && block.startsAt === mondayNoon)
	)
	const homeAgain = await post(api, cookie, occurrencePath(s1, dW14, 'move'), { date: dW14, startTime: '18:00' })
	check(
		'move dW+14 back to its Wednesday gives 200 scheduled',
		homeAgain.status === 200 && homeAgain.json?.occurrence?.status === 'scheduled',
		`status ${homeAgain.status}`
	)
	countRows(ctx)
	const homeRow = exceptionRow(s1, dW14)
	check('restored dW+14 row has no time left', homeRow?.kind === 'restored' && homeRow?.starts_at === null)
	const plainCancel = await post(api, cookie, occurrencePath(s1, dW14, 'cancel'), { expectedStartsAt: at(dW14) })
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW14, s1)
	check(
		'cancel after the move back stands on the natural Wednesday',
		plainCancel.status === 200 &&
			week.length === 1 &&
			week[0].status === 'cancelled' &&
			week[0].startsAt === at(dW14) &&
			week[0].movedTo === null &&
			exceptionRow(s1, dW14)?.starts_at === null
	)
	const plainBack = await post(api, cookie, occurrencePath(s1, dW14, 'restore'), { expectedStartsAt: at(dW14) })
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW14, s1)
	check(
		'restore dW+14 gives the Wednesday on its place',
		plainBack.status === 200 &&
			plainBack.json?.occurrence?.status === 'scheduled' &&
			week.length === 1 &&
			week[0].status === 'scheduled' &&
			week[0].startsAt === at(dW14) &&
			exceptionRow(s1, dW14)?.kind === 'restored',
		`status ${plainBack.status}`
	)

	await partPastOrigin(ctx)

	const home = await post(api, cookie, occurrencePath(s1, dW, 'move'), { date: dW, startTime: '18:00' })
	check(
		'move dW back to Wednesday 18:00 gives 200 scheduled',
		home.status === 200 && home.json?.occurrence?.status === 'scheduled' && home.json?.occurrence?.startsAt === at(dW),
		`status ${home.status}`
	)
	countRows(ctx)
	check('exception row of dW has kind restored', exceptionRow(s1, dW)?.kind === 'restored')
	week = await seriesBlocks(api, cookie, dW, s1)
	check('week dW shows one Wednesday block', week.length === 1 && week[0].status === 'scheduled')

	const past = core.addDays(dW, -14)
	const nowParts = core.zonedParts(new Date(), VN)
	const refusals = [
		[
			'move of a Thursday originalOn',
			() => post(api, cookie, occurrencePath(s1, core.addDays(dW, 1), 'move'), { date: friday, startTime: '11:00' }),
			409,
		],
		[
			'move of a past Wednesday',
			() => post(api, cookie, occurrencePath(s1, past, 'move'), { date: friday, startTime: '11:00' }),
			400,
			'lesson_in_past',
		],
		['cancel of a past Wednesday', () => post(api, cookie, occurrencePath(s1, past, 'cancel')), 400, 'lesson_in_past'],
		[
			'move into today 00:00',
			() => post(api, cookie, occurrencePath(s1, dW7, 'move'), { date: today, startTime: '00:00' }),
			400,
			'target_in_past',
		],
		[
			'cancel with expectedStartsAt one hour early',
			() => post(api, cookie, occurrencePath(s1, dW7, 'cancel'), { expectedStartsAt: instant(dW7, '17:00') }),
			409,
		],
		[
			'move to yesterday',
			() => post(api, cookie, occurrencePath(s1, dW7, 'move'), { date: core.addDays(today, -1), startTime: '18:00' }),
			400,
			'target_in_past',
		],
		[
			'move to the current time',
			() => post(api, cookie, occurrencePath(s1, dW7, 'move'), { date: nowParts.date, startTime: nowParts.time }),
			400,
			'target_in_past',
		],
		[
			'move of an unknown series',
			() => post(api, cookie, occurrencePath(randomUUID(), dW, 'move'), { date: friday, startTime: '11:00' }),
			404,
		],
		[
			'move with originalOn abc',
			() => post(api, cookie, occurrencePath(s1, 'abc', 'move'), { date: friday, startTime: '11:00' }),
			404,
		],
		[
			'cancel without a JSON body',
			() => call(api, 'POST', `/schedule${occurrencePath(s1, dW7, 'cancel')}`, { cookie }),
			400,
		],
	]
	for (const [label, send, status, code] of refusals) await expectStatus(label, send, status, code)
	countRows(ctx)

	const rows = sql(`select count(*)::int as n from lesson_exceptions where series_id = ${quote(s1)}`).rows[0].n
	check('S1 keeps 3 exception rows', rows === 3, `rows ${rows}`)
	check('past weeks snapshot is unchanged after occurrence changes', (await pastSnapshot(ctx)) === ctx.snapshot)
	return 'OCCURRENCE_OK'
}

async function raced(send) {
	const results = await Promise.all([send(), send()])
	return results.map((res) => res.status).sort((left, right) => left - right)
}

async function partSingle(ctx) {
	const { api, cookie, s1, dW, today, studentId } = ctx
	const lessonPath = (id, action) => `/lessons/${id}/${action}`
	const thursday = core.addDays(dW, 1)
	const nextThursday = core.addDays(dW, 8)
	const created = await createLesson(api, cookie, {
		studentId,
		date: thursday,
		startTime: '09:00',
		durationMinutes: 45,
		repeats: 'once',
	})
	if (created.status !== 201) throw new Error(`single lesson create returned ${created.status}`)
	const l1 = created.json.lesson.id
	const pastAt = new Date(Date.now() - 2 * 86400000).toISOString()
	const l2 = sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(pastAt)}, 60, 'scheduled') returning id`
	).rows[0].id
	countRows(ctx)
	const lessonBlocks = async (date) =>
		(await weekBlocks(api, cookie, core.mondayOf(date))).filter((block) => block.key === `l:${l1}`)

	const moved = await post(api, cookie, lessonPath(l1, 'move'), {
		date: nextThursday,
		startTime: '14:00',
		expectedStartsAt: instant(thursday, '09:00'),
	})
	check(
		'move L1 to next Thursday 14:00 gives 200',
		moved.status === 200 &&
			moved.json?.lesson?.startsAt === instant(nextThursday, '14:00') &&
			moved.json?.lesson?.durationMinutes === 45,
		`status ${moved.status}`
	)
	countRows(ctx)
	const oldWeek = await lessonBlocks(thursday)
	const newWeek = await lessonBlocks(nextThursday)
	check(
		'L1 shows only on its new place',
		oldWeek.length === 0 &&
			newWeek.length === 1 &&
			newWeek[0].startsAt === instant(nextThursday, '14:00') &&
			newWeek[0].status === 'scheduled'
	)
	await expectStatus(
		'move L1 into today 00:00',
		() => post(api, cookie, lessonPath(l1, 'move'), { date: today, startTime: '00:00' }),
		400
	)
	const cancelled = await post(api, cookie, lessonPath(l1, 'cancel'))
	check(
		'cancel L1 gives 200 cancelled',
		cancelled.status === 200 && cancelled.json?.lesson?.status === 'cancelled',
		`status ${cancelled.status}`
	)
	countRows(ctx)
	check('week shows L1 cancelled', (await lessonBlocks(nextThursday))[0]?.status === 'cancelled')
	const restored = await post(api, cookie, lessonPath(l1, 'restore'), {
		expectedStartsAt: instant(nextThursday, '14:00'),
	})
	check(
		'restore L1 gives 200 scheduled',
		restored.status === 200 && restored.json?.lesson?.status === 'scheduled',
		`status ${restored.status}`
	)
	countRows(ctx)
	check('week shows L1 scheduled', (await lessonBlocks(nextThursday))[0]?.status === 'scheduled')
	await expectStatus(
		'cancel L1 with a stale expectedStartsAt',
		() => post(api, cookie, lessonPath(l1, 'cancel'), { expectedStartsAt: instant(thursday, '09:00') }),
		409
	)
	const lessonRace = await raced(() => post(api, cookie, lessonPath(l1, 'cancel')))
	check('two parallel cancels of L1 give one 200 and one 409', lessonRace.join() === '200,409', lessonRace.join())
	countRows(ctx)
	await expectStatus(
		'move of the cancelled L1',
		() => post(api, cookie, lessonPath(l1, 'move'), { date: nextThursday, startTime: '15:00' }),
		409
	)
	await expectStatus(
		'move of the past L2',
		() => post(api, cookie, lessonPath(l2, 'move'), { date: nextThursday, startTime: '16:00' }),
		400,
		'lesson_in_past'
	)
	await expectStatus('cancel of the past L2', () => post(api, cookie, lessonPath(l2, 'cancel')), 400, 'lesson_in_past')
	await expectStatus(
		'move of an unknown lesson',
		() => post(api, cookie, lessonPath(randomUUID(), 'move'), { date: nextThursday, startTime: '16:00' }),
		404
	)
	await expectStatus('restore of an unknown lesson', () => post(api, cookie, lessonPath(randomUUID(), 'restore')), 404)
	await expectStatus('cancel of lesson id abc', () => post(api, cookie, lessonPath('abc', 'cancel')), 404)
	const pastRow = sql(`select starts_at, status from lessons where id = ${quote(l2)}`).rows[0]
	check(
		'past L2 row is unchanged',
		pastRow?.status === 'scheduled' && new Date(pastRow.starts_at).toISOString() === pastAt
	)

	const dW35 = core.addDays(dW, 35)
	const occurrenceRace = await raced(() => post(api, cookie, occurrencePath(s1, dW35, 'cancel')))
	check(
		'two parallel cancels of S1 dW+35 give one 200 and one 409',
		occurrenceRace.join() === '200,409',
		occurrenceRace.join()
	)
	countRows(ctx)
	check('S1 dW+35 exception row is cancelled', exceptionRow(s1, dW35)?.kind === 'cancelled')
	return 'SINGLE_OK'
}

function seriesRow(id) {
	return sql(
		`select weekday, start_time::text as start_time, duration_minutes, starts_on::text as starts_on, ends_on::text as ends_on from lesson_series where id = ${quote(id)}`
	).rows[0]
}

function seriesCount(ctx) {
	return countRows(ctx).series
}

async function partSeries(ctx) {
	const { api, cookie, s1, dW, today, thisMonday, studentId } = ctx
	const at = (date) => instant(date, '18:00')
	const key = (date) => `s:${s1}:${date}`
	const day = (offset) => core.addDays(dW, offset)
	const cardB = await createCard(api, cookie, ctx.ids, `${CHANGES_NAME} B`)

	const prep = [
		['move dW to Friday 10:00 again', occurrencePath(s1, dW, 'move'), { date: day(2), startTime: '10:00' }],
		[
			'move dW+14 to Monday of week dW+7 12:00 again',
			occurrencePath(s1, day(14), 'move'),
			{ date: day(5), startTime: '12:00' },
		],
		['move dW+21 to Tuesday 09:00', occurrencePath(s1, day(21), 'move'), { date: day(20), startTime: '09:00' }],
		['cancel dW+28', occurrencePath(s1, day(28), 'cancel'), {}],
	]
	for (const [label, path, body] of prep) await expectStatus(label, () => post(api, cookie, path, body), 200)

	const snapshotBefore = await pastSnapshot(ctx)
	const before = countRows(ctx)
	const cutBody = { from: day(14), weekday: 4, startTime: '17:00' }
	const cut = await post(api, cookie, `/series/${s1}/move`, cutBody)
	const created = cut.json?.series
	check(
		'move S1 from dW+14 to Thursday 17:00 gives 200 with the new series',
		cut.status === 200 &&
			created?.id !== s1 &&
			created?.weekday === 4 &&
			created?.startTime === '17:00' &&
			created?.durationMinutes === 60 &&
			created?.startsOn === day(15) &&
			created?.endsOn === null,
		`status ${cut.status} ${JSON.stringify(created ?? null)}`
	)
	const n = created?.id
	const snapshotAfterCut = await pastSnapshot(ctx)
	const after = countRows(ctx)
	check('old series ends on dW+13', seriesRow(s1)?.ends_on === day(13), seriesRow(s1)?.ends_on)
	check(
		'cut adds one series and two lessons and keeps every exception row',
		after.series === before.series + 1 &&
			after.lessons === before.lessons + 2 &&
			after.exceptions === before.exceptions,
		JSON.stringify({ before, after })
	)
	const lessonAt = (iso) =>
		sql(
			`select count(*)::int as n from lessons where student_id = ${quote(studentId)} and starts_at = ${quote(iso)} and status = 'scheduled' and duration_minutes = 60`
		).rows[0].n
	check(
		'moved occurrences after From became lessons at their destination times',
		lessonAt(instant(day(5), '12:00')) === 1 && lessonAt(instant(day(20), '09:00')) === 1
	)

	const cardBlocks = async (date) =>
		(await weekBlocks(api, cookie, core.mondayOf(date))).filter((block) => block.studentId === studentId)
	const ofSeries = (blocks, id) => blocks.filter((block) => block.ref.kind === 'series' && block.ref.seriesId === id)
	let blocks = await cardBlocks(day(21))
	const tuesday = blocks.filter((block) => block.startsAt === instant(day(20), '09:00'))
	check(
		'week dW+21 has no Wednesday, has the new Thursday 17:00 and one Tuesday 09:00 lesson',
		ofSeries(blocks, s1).length === 0 &&
			ofSeries(blocks, n).some(
				(block) => block.startsAt === instant(day(22), '17:00') && block.status === 'scheduled'
			) &&
			tuesday.length === 1 &&
			tuesday[0].ref.kind === 'single'
	)
	blocks = await cardBlocks(day(28))
	check(
		'week dW+28 has no cancelled Wednesday and has the new Thursday',
		ofSeries(blocks, s1).length === 0 &&
			ofSeries(blocks, n).some((block) => block.startsAt === instant(day(29), '17:00'))
	)
	blocks = await cardBlocks(day(35))
	check(
		'week dW+35 drops the cancelled exception of S1',
		ofSeries(blocks, s1).length === 0 && ofSeries(blocks, n).length === 1
	)
	blocks = await cardBlocks(dW)
	const own = ofSeries(blocks, s1)
	check(
		'week dW keeps the moved ghost and the Friday destination of S1',
		own.length === 2 &&
			own.some((block) => block.key === key(dW) && block.status === 'moved' && block.startsAt === at(dW)) &&
			own.some(
				(block) => block.key === key(dW) && block.status === 'scheduled' && block.startsAt === instant(day(2), '10:00')
			)
	)
	blocks = await cardBlocks(day(7))
	const monday = blocks.filter((block) => block.startsAt === instant(day(5), '12:00'))
	check(
		'week dW+7 keeps the restored Wednesday and one Monday 12:00 lesson',
		ofSeries(blocks, s1).some((block) => block.key === key(day(7)) && block.status === 'scheduled') &&
			monday.length === 1 &&
			monday[0].ref.kind === 'single'
	)

	const seriesBefore = seriesCount(ctx)
	await expectStatus('repeat of the same cut', () => post(api, cookie, `/series/${s1}/move`, cutBody), 409)
	check('repeated cut adds no series', seriesCount(ctx) === seriesBefore)

	const todayWeekday = core.weekdayOf(today)
	const s2 = insertSeries(cardB, todayWeekday, '00:00', core.addDays(today, -14), null)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind) values (${quote(s2)}, ${quote(today)}, 'cancelled')`
	)
	await expectStatus(
		'cut with From today after the started lesson of today',
		() => post(api, cookie, `/series/${s2}/move`, { from: today, weekday: (todayWeekday % 7) + 1, startTime: '10:00' }),
		400,
		'series_today_passed'
	)
	await expectStatus(
		'cut to the same day and time',
		() => post(api, cookie, `/series/${n}/move`, { from: day(15), weekday: 4, startTime: '17:00' }),
		400
	)
	await expectStatus(
		'cut from yesterday',
		() => post(api, cookie, `/series/${n}/move`, { from: core.addDays(today, -1), weekday: 5, startTime: '10:00' }),
		400
	)
	const s3 = insertSeries(cardB, 1, '10:00', core.addDays(thisMonday, -21), core.addDays(thisMonday, -7))
	await expectStatus(
		'cut of a series ended last week',
		() => post(api, cookie, `/series/${s3}/move`, { from: today, weekday: 2, startTime: '10:00' }),
		409
	)
	const s4 = insertSeries(cardB, 3, '18:00', core.addDays(dW, -14), dW)
	const s4Before = JSON.stringify(seriesRow(s4))
	const s4Series = seriesCount(ctx)
	const s4Cut = await post(api, cookie, `/series/${s4}/move`, { from: dW, weekday: 4, startTime: '10:00' })
	check(
		'cut of a series that ends before the new day gives 400 series_ends_before_new_day',
		s4Cut.status === 400 && s4Cut.json?.error?.code === 'series_ends_before_new_day',
		`status ${s4Cut.status} ${JSON.stringify(s4Cut.json)}`
	)
	check(
		'refused cut keeps S4 and the series count',
		JSON.stringify(seriesRow(s4)) === s4Before && seriesCount(ctx) === s4Series
	)
	await expectStatus('cut of an unknown series', () => post(api, cookie, `/series/${randomUUID()}/move`, cutBody), 404)

	const endCount = seriesCount(ctx)
	const ended = await post(api, cookie, `/series/${n}/end`, { lastOn: day(22) })
	check(
		'End of the new series on its second date gives 200',
		ended.status === 200 && ended.json?.series?.id === n && ended.json?.series?.endsOn === day(22),
		`status ${ended.status} ${JSON.stringify(ended.json?.series ?? null)}`
	)
	check(
		'new series shows on its second date and not after',
		ofSeries(await cardBlocks(day(22)), n).length === 1 && ofSeries(await cardBlocks(day(29)), n).length === 0
	)
	await expectStatus(
		'End with lastOn after the end',
		() => post(api, cookie, `/series/${n}/end`, { lastOn: day(29) }),
		400
	)
	await expectStatus(
		'End with lastOn yesterday',
		() => post(api, cookie, `/series/${n}/end`, { lastOn: core.addDays(today, -1) }),
		400
	)
	await expectStatus(
		'End of an unknown series',
		() => post(api, cookie, `/series/${randomUUID()}/end`, { lastOn: today }),
		404
	)
	const later = core.addDays(today, 14)
	const future = await createLesson(api, cookie, {
		studentId: cardB,
		date: later,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	const s5 = future.json?.series
	if (future.status !== 201 || s5?.startsOn !== later) throw new Error(`future series create returned ${future.status}`)
	const countWithFuture = seriesCount(ctx)
	const emptied = await post(api, cookie, `/series/${s5.id}/end`, { lastOn: today })
	check(
		'End of a series that starts in two weeks gives endsOn = startsOn - 1',
		emptied.status === 200 && emptied.json?.series?.endsOn === core.addDays(later, -1),
		`status ${emptied.status} ${JSON.stringify(emptied.json?.series ?? null)}`
	)
	let futureBlocks = 0
	for (const offset of [0, 7]) {
		const week = await weekBlocks(api, cookie, core.mondayOf(core.addDays(later, offset)))
		futureBlocks += ofSeries(week, s5.id).length
	}
	check('emptied series has no blocks', futureBlocks === 0)
	check(
		'End keeps the lesson_series rows',
		seriesCount(ctx) === countWithFuture && countWithFuture === endCount + 1,
		`${endCount} ${countWithFuture}`
	)

	check(
		'past weeks snapshot is unchanged by the cut',
		snapshotBefore === ctx.snapshot && snapshotAfterCut === snapshotBefore
	)
	check('past weeks snapshot is unchanged after every change', (await pastSnapshot(ctx)) === ctx.snapshot)
	return 'SERIES_OK'
}

const CHANGE_PARTS = [partOccurrence, partSingle, partSeries]

async function sectionChanges(api, cookie, ids) {
	const studentId = await createCard(api, cookie, ids, `${CHANGES_NAME} A`)
	const today = todayVn()
	const thisMonday = core.mondayOf(today)
	const s1 = insertSeries(studentId, 3, '18:00', core.addDays(thisMonday, -19), null)
	console.log(`series S1 ${s1}`)
	const ctx = { api, cookie, ids, studentId, today, thisMonday, s1, dW: firstAfter(today, 3), counts: [] }
	ctx.snapshot = await pastSnapshot(ctx)
	check('past weeks snapshot holds one S1 block per week', JSON.parse(ctx.snapshot).flat().length === 3)
	countRows(ctx)
	for (const part of CHANGE_PARTS) {
		const before = failures
		const token = await part(ctx)
		if (failures === before) console.log(token)
	}
	const shrank = ctx.counts.some(
		(row, index) =>
			index > 0 &&
			(row.series < ctx.counts[index - 1].series ||
				row.lessons < ctx.counts[index - 1].lessons ||
				row.exceptions < ctx.counts[index - 1].exceptions)
	)
	check(`row counts never decreased over ${ctx.counts.length} samples`, !shrank)
	return 'SCHEDULE_API_CHANGES_OK'
}

const SECTIONS = {
	read: { run: sectionRead, port: PORT },
	next: { run: sectionNext, port: PORT },
	changes: { run: sectionChanges, port: 4202 },
}

const section = process.argv[2]
const chosen = SECTIONS[section]
if (!chosen) {
	console.log(`usage: node scripts/dev-checks/schedule-api.mjs ${Object.keys(SECTIONS).join('|')}`)
	process.exit(2)
}
const run = chosen.run

removeTails()
const ids = []
let api = null
let done = null
try {
	api = await startApi({ port: chosen.port })
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
