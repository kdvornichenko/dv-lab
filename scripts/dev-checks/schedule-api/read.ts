import { randomUUID } from 'node:crypto'

import * as core from '../../../packages/core/src/index.ts'
import { FIXTURE_NAME, check, createCard, createLesson, firstAfter, instant, readWeek, todayVn } from './context.ts'
import { call, quote, sql, studentCookie } from './io.ts'
import type { Reply, WeekPayload } from './types.ts'
import type { Refusal } from './types.ts'
import type { Api, ScheduleBlock } from './types.ts'

export async function sectionRead(api: Api, cookie: string, ids: string[]) {
	const { studentId, friday, past, wednesday, seriesId, name, today } = await createWeeklyReadFixture(api, cookie, ids)
	const { lessonId, pastLessonId } = await createSingleReadFixtures(api, cookie, studentId, friday, past)
	const { before, weeks, firstMonday } = await readSeriesWindow(wednesday, api, cookie, seriesId, name)
	await readSingleWindow(friday, before, weeks, api, cookie, lessonId, past, pastLessonId)
	await readSeriesIdempotency(seriesId, api, cookie, studentId, wednesday)
	await readMidnightSeries(api, cookie, studentId, today)
	await readRefusals(api, cookie, studentId, today, firstMonday, friday)
	await readArchivedCard(api, studentId, cookie, friday)
	return 'SCHEDULE_API_READ_OK'
}

async function createWeeklyReadFixture(api: Api, cookie: string, ids: string[]) {
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
	return { studentId, friday, past, wednesday, seriesId, name, today }
}

async function createSingleReadFixtures(api: Api, cookie: string, studentId: string, friday: string, past: string) {
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
	return { lessonId, pastLessonId }
}

async function readSeriesWindow(wednesday: string, api: Api, cookie: string, seriesId: string, name: string) {
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
				block.outcome === 'planned' &&
				block.studentName === name &&
				block.studentStatus === 'active' &&
				block.key === `s:${seriesId}:${date}` &&
				block.actions?.move === true &&
				(res.json?.series ?? []).some((rule) => rule.id === seriesId && rule.startTime === '18:00'),
			`status ${res.status} blocks ${own.length}`
		)
		inspectBlockShape(res, monday)
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
	return { before, weeks, firstMonday }
}

async function readSingleWindow(
	friday: string,
	before: string,
	weeks: Awaited<ReturnType<typeof readSeriesWindow>>['weeks'],
	api: Api,
	cookie: string,
	lessonId: string,
	past: string,
	pastLessonId: string
) {
	const lessonMonday = core.mondayOf(friday)
	const checked = [...new Set([before, ...weeks, lessonMonday])]
	let lessonWeeks = 0
	let lessonInOwnWeek = false
	for (const monday of checked) {
		const res = await readWeek(api, cookie, monday)
		const found = (res.json?.blocks ?? []).filter((block) => block.key === `l:${lessonId}`)
		if (found.length > 0) lessonWeeks += 1
		if (monday === lessonMonday && found.length === 1 && found[0].startsAt === instant(friday, '09:00')) {
			lessonInOwnWeek = found[0].durationMinutes === 45 && found[0].actions?.move === true
		}
	}
	check(`single lesson shows only in its week of ${checked.length} weeks`, lessonWeeks === 1 && lessonInOwnWeek)
	const pastWeek = await readWeek(api, cookie, core.mondayOf(past))
	const pastBlock = (pastWeek.json?.blocks ?? []).find((block) => block.key === `l:${pastLessonId}`)
	check(
		'past lesson block can be moved and cancelled',
		pastWeek.status === 200 && pastBlock?.actions?.move === true && pastBlock?.actions?.cancel === true
	)
}

async function readSeriesIdempotency(seriesId: string, api: Api, cookie: string, studentId: string, wednesday: string) {
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
}

async function readMidnightSeries(api: Api, cookie: string, studentId: string, today: string) {
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
}

async function readRefusals(
	api: Api,
	cookie: string,
	studentId: string,
	today: string,
	firstMonday: string,
	friday: string
) {
	const refusals: Refusal[] = [
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
}

async function readArchivedCard(api: Api, studentId: string, cookie: string, friday: string) {
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
}

function inspectBlockShape(res: Reply<WeekPayload>, monday: string) {
	check(
		`week ${monday} blocks carry no status or changeable key`,
		(res.json?.blocks ?? []).length > 0 &&
			res.json.blocks.every((item) => !('status' in item) && !('changeable' in item) && 'outcome' in item)
	)
}
