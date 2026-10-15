import * as core from '../../../packages/core/src/index.ts'
import { call, quote, sql } from './io.ts'
import type { WeekPayload, Refusal } from './types.ts'
import type { Api, ChangeContext, RequestBody, Reply, ScheduleBlock } from './types.ts'

export const VN = core.SCHEDULE_TIME_ZONE

export const PORT = 4201

export const FIXTURE_PREFIX = 'Alex Example 20'

export const FIXTURE_NAME = 'Alex Example 2004'

export let failures = 0

export function check(name: string, ok: boolean, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		recordFailure()
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

export const todayVn = () => core.zonedParts(new Date(), VN).date

export const firstAfter = (date: string, weekday: Parameters<typeof core.firstOnOrAfter>[1]) =>
	core.firstOnOrAfter(core.addDays(date, 1), weekday)

export const instant = (date: string, time: string) => core.zonedInstant(date, time, VN).toISOString()

export function removeCards(where: string) {
	const cards = `select id from students where ${where}`
	const series = `select id from lesson_series where student_id in (${cards})`
	let removed = 0
	removed += sql(
		`delete from lesson_marks where series_id in (${series}) or lesson_id in (select id from lessons where student_id in (${cards}))`
	).rowCount
	removed += sql(`delete from lesson_exceptions where series_id in (${series})`).rowCount
	removed += sql(`delete from lessons where student_id in (${cards})`).rowCount
	removed += sql(`delete from lesson_series where student_id in (${cards})`).rowCount
	sql(`delete from student_sections where student_id in (${cards})`)
	removed += sql(`delete from students where ${where}`).rowCount
	return removed
}

export function removeTails() {
	const removed = removeCards(`display_name like ${quote(`${FIXTURE_PREFIX}%`)} and import_key is null`)
	console.log(`fixture tails removed ${removed}`)
}

export function removeOwn(ids: string[]) {
	if (ids.length === 0) return
	removeCards(`id in (${ids.map(quote).join(', ')}) and import_key is null`)
}

export async function createCard(api: Api, cookie: string, ids: string[], displayName: string) {
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

export const createLesson = (api: Api, cookie: string, body: RequestBody) =>
	call(api, 'POST', '/schedule/lessons', { cookie, body })

export const readWeek = (api: Api, cookie: string, start: string) =>
	call<WeekPayload>(api, 'GET', `/schedule/week?start=${encodeURIComponent(start)}`, { cookie })

export const CHANGES_NAME = 'Alex Example 2006'

export const post = (api: Api, cookie: string, path: string, body = {}) =>
	call(api, 'POST', `/schedule${path}`, { cookie, body })

export const occurrencePath = (seriesId: string, date: string, action: string) =>
	`/series/${seriesId}/occurrences/${date}/${action}`

export async function weekBlocks(api: Api, cookie: string, monday: string) {
	const res = await readWeek(api, cookie, monday)
	if (res.status !== 200) throw new Error(`week ${monday} returned ${res.status}`)
	return res.json.blocks
}

export async function seriesBlocks(api: Api, cookie: string, date: string, seriesId: string) {
	const blocks = await weekBlocks(api, cookie, core.mondayOf(date))
	return blocks.filter((block) => block.ref.kind === 'series' && block.ref.seriesId === seriesId)
}

export async function pastSnapshot(ctx: ChangeContext) {
	const weeks: ScheduleBlock[][] = []
	for (const offset of [-21, -14, -7]) {
		const blocks = await weekBlocks(ctx.api, ctx.cookie, core.addDays(ctx.thisMonday, offset))
		weeks.push(blocks.filter((block) => block.ref.kind === 'series' && block.ref.seriesId === ctx.s1))
	}
	return JSON.stringify(weeks)
}

export function countRows(ctx: ChangeContext) {
	const list = ctx.ids.map(quote).join(', ')
	const row = sql(
		`select (select count(*)::int from lesson_series where student_id in (${list})) as series, (select count(*)::int from lessons where student_id in (${list})) as lessons, (select count(*)::int from lesson_exceptions e join lesson_series s on s.id = e.series_id where s.student_id in (${list})) as exceptions`
	).rows[0]
	ctx.counts.push(row)
	return row
}

export function exceptionRow(seriesId: string, originalOn: string) {
	return sql(
		`select kind, starts_at from lesson_exceptions where series_id = ${quote(seriesId)} and original_on = ${quote(originalOn)}`
	).rows[0]
}

export function insertSeries(
	studentId: string,
	weekday: number,
	startTime: string,
	startsOn: string,
	endsOn: string | null
) {
	const end = endsOn === null ? 'null' : quote(endsOn)
	return sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(studentId)}, ${weekday}, ${quote(startTime)}, 60, ${quote(startsOn)}, ${end}) returning id`
	).rows[0].id
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

export async function raced(send: () => Promise<Reply>) {
	const results = await Promise.all([send(), send()])
	return results.map((res) => res.status).sort((left, right) => left - right)
}

export function seriesRow(id: string) {
	return sql(
		`select weekday, start_time::text as start_time, duration_minutes, starts_on::text as starts_on, ends_on::text as ends_on from lesson_series where id = ${quote(id)}`
	).rows[0]
}

export function seriesCount(ctx: ChangeContext) {
	return countRows(ctx).series
}

export function recordFailure() {
	failures += 1
}
