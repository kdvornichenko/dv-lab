import * as core from '../../../packages/core/src/index.ts'
import { call, quote, sql } from '../schedule-api/io.ts'
import type { WeekPayload, TodayPayload, Refusal } from './types.ts'
import type { Context, RequestBody, Reply, ScheduleBlock, ScheduleLessonActions } from './types.ts'

export const VN = core.SCHEDULE_TIME_ZONE

export const PORT = 4202

export const FIXTURE_PREFIXES = ['Alex Example 211', 'Alex Example 212']

export let failures = 0

export function check(name: string, ok: boolean, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		recordFailure()
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

export const todayVn = () => core.zonedParts(new Date(), VN).date

export const instant = (date: string, time: string) => core.zonedInstant(date, time, VN).toISOString()

export function removeCards(where: string) {
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

export function removeTails() {
	let removed = 0
	for (const prefix of FIXTURE_PREFIXES) {
		removed += removeCards(`display_name like ${quote(`${prefix}%`)} and import_key is null`)
	}
	console.log(`fixture tails removed ${removed}`)
}

export function removeOwn(ids: string[]) {
	if (ids.length === 0) return
	removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
}

export const cardBody = (displayName: string) => ({
	displayName,
	rateMinor: null,
	currency: null,
	defaultLessonMinutes: 60,
	parent: null,
	level: null,
	goals: null,
	timeZone: null,
})

export async function createCard(ctx: Context, displayName: string) {
	const res = await call(ctx.api, 'POST', '/students', { cookie: ctx.cookie, body: cardBody(displayName) })
	if (res.status !== 201) throw new Error(`card create returned ${res.status}`)
	ctx.ids.push(res.json.student.id)
	return res.json.student.id
}

export function insertSeries(studentId: string, weekday: number, startTime: string, startsOn: string) {
	return sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(studentId)}, ${weekday}, ${quote(startTime)}, 60, ${quote(startsOn)}, null) returning id`
	).rows[0].id
}

export function pastSeries(studentId: string, date: string, startTime: string) {
	return insertSeries(studentId, core.weekdayOf(date), startTime, core.addDays(date, -14))
}

export const post = (ctx: Context, path: string, body = {}, cookie = ctx.cookie) =>
	call(ctx.api, 'POST', `/schedule${path}`, { cookie, body })

export const occurrencePath = (seriesId: string, date: string, action: string) =>
	`/series/${seriesId}/occurrences/${date}/${action}`

export async function weekBlocks(ctx: Context, date: string) {
	const monday = core.mondayOf(date)
	const res = await call<WeekPayload>(ctx.api, 'GET', `/schedule/week?start=${monday}`, { cookie: ctx.cookie })
	if (res.status !== 200) throw new Error(`week ${monday} returned ${res.status}`)
	return res.json.blocks
}

export async function blockOf(ctx: Context, date: string, key: string) {
	return (await weekBlocks(ctx, date)).filter((block) => block.key === key)
}

export function seriesMarks(seriesId: string, originalOn: string) {
	return sql(
		`select kind from lesson_marks where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`
	).rows
}

export const sameActions = (actions: ScheduleLessonActions | undefined, expected: ScheduleLessonActions) =>
	JSON.stringify(actions) === JSON.stringify(expected)

export const createLesson = (ctx: Context, studentId: string, date: string, startTime: string, durationMinutes = 60) =>
	post(ctx, '/lessons', { studentId, date, startTime, durationMinutes, repeats: 'once' })

export async function onceLesson(
	ctx: Context,
	studentId: string,
	date: string,
	startTime: string,
	durationMinutes = 60
) {
	const res = await createLesson(ctx, studentId, date, startTime, durationMinutes)
	if (res.status !== 201) throw new Error(`single lesson create returned ${res.status}`)
	return res.json.lesson.id
}

export function lessonMarks(lessonId: string) {
	return sql(`select kind from lesson_marks where lesson_id = ${quote(lessonId)}`).rows
}

export async function expectStatus(label: string, send: Refusal[1], status: number, code?: string) {
	const res = await send()
	check(
		`${label} gives ${status}${code ? ` ${code}` : ''}`,
		res.status === status && (code === undefined || res.json?.error?.code === code),
		`got ${res.status} ${JSON.stringify(res.json?.error ?? '')}`
	)
	return res
}

export const noActions = (actions: ScheduleLessonActions | undefined) =>
	actions?.move === false &&
	actions?.cancel === false &&
	actions?.restore === false &&
	actions?.mark === false &&
	actions?.series === false

export async function placedAt(ctx: Context, key: string, startsAt: string) {
	const date = core.zonedParts(new Date(startsAt), VN).date
	return (await blockOf(ctx, date, key)).filter((block) => block.startsAt === startsAt)
}

export function cardMarks(studentId: string) {
	return sql(
		`select kind, lesson_id, series_id, original_on::text as original_on from lesson_marks where lesson_id in (select id from lessons where student_id = ${quote(studentId)}) or series_id in (select id from lesson_series where student_id = ${quote(studentId)}) order by created_at, kind`
	).rows
}

export const moveTo = (ctx: Context, path: string, date: string, startTime: string, expectedStartsAt?: string) =>
	post(ctx, path, { date, startTime, ...(expectedStartsAt ? { expectedStartsAt } : {}) })

export function startedToday(ctx: Context) {
	const midnight = core.zonedInstant(ctx.today, '00:00', VN).getTime()
	const hourAgo = Math.floor((Date.now() - 3600000) / 1000) * 1000
	return new Date(Math.max(midnight, hourAgo)).toISOString()
}

export async function movedIntoToday(ctx: Context, name: string) {
	const studentId = await createCard(ctx, name)
	const originalOn = core.addDays(ctx.today, 8)
	const seriesId = insertSeries(studentId, core.weekdayOf(originalOn), '19:00', core.addDays(originalOn, -21))
	const startsAt = startedToday(ctx)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(originalOn)}, 'moved', ${quote(startsAt)}, 60)`
	)
	return { studentId, seriesId, originalOn, startsAt }
}

export const cutBody = (ctx: Context) => ({
	from: ctx.today,
	weekday: core.weekdayOf(core.addDays(ctx.today, 2)),
	startTime: '10:00',
})

export async function todayBlocks(ctx: Context, studentId: string) {
	return (await weekBlocks(ctx, ctx.today)).filter((block) => block.studentId === studentId)
}

export function cutLessonMarks(studentId: string, startsAt: string) {
	return sql(
		`select l.id, m.kind from lessons l left join lesson_marks m on m.lesson_id = l.id where l.student_id = ${quote(studentId)} and l.starts_at = ${quote(startsAt)}`
	).rows
}

export function sharedStarts(blocks: ScheduleBlock[]) {
	const starts = blocks.map((block) => block.startsAt)
	return starts.length !== new Set(starts).size
}

export async function setOpening(ctx: Context, studentId: string, lessonsHundredths: number, on: string) {
	const res = await call(ctx.api, 'PUT', `/students/${studentId}/opening-balance`, {
		cookie: ctx.cookie,
		body: { lessonsHundredths, on },
	})
	if (res.status !== 200) throw new Error(`opening balance returned ${res.status}`)
}

export async function balances(ctx: Context, studentId: string) {
	const list = await call(ctx.api, 'GET', '/students', { cookie: ctx.cookie })
	const profile = await call(ctx.api, 'GET', `/students/${studentId}`, { cookie: ctx.cookie })
	const row = list.json?.students?.find((student) => student.id === studentId)
	return { list: row?.balanceMinutes, profile: profile.json?.student?.balanceMinutes, detail: profile.json?.student }
}

export async function expectBalance(ctx: Context, studentId: string, label: string, expected: number | null) {
	const got = await balances(ctx, studentId)
	check(
		`${label}: balance ${expected} in the list and the profile`,
		got.list === expected && got.profile === expected,
		`list ${got.list} profile ${got.profile}`
	)
	return got
}

export const markSingle = (ctx: Context, lessonId: string, kind: string) =>
	post(ctx, `/lessons/${lessonId}/mark`, { kind })

export async function stepOk(label: string, send: () => Promise<Reply>) {
	const res = await send()
	if (res.status !== 200 && res.status !== 201) {
		recordFailure()
		console.log(`FAIL ${label} returned ${res.status} ${JSON.stringify(res.json?.error ?? '')}`)
	}
	return res
}

export const patchCard = (ctx: Context, studentId: string, body: RequestBody) =>
	call(ctx.api, 'PATCH', `/students/${studentId}`, { cookie: ctx.cookie, body })

export function insertLesson(studentId: string, startsAt: string) {
	return sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(startsAt)}, 60, 'scheduled') returning id`
	).rows[0].id
}

export async function getToday(ctx: Context, cookie = ctx.cookie) {
	return call<TodayPayload>(ctx.api, 'GET', '/today', { cookie })
}

export function recordFailure() {
	failures += 1
}
