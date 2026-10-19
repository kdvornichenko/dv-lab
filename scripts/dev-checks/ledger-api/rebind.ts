import * as core from '../../../packages/core/src/index.ts'
import { call, quote, sql } from '../schedule-api/io.ts'
import {
	balances,
	cardBody,
	check,
	createCard,
	expectBalance,
	expectStatus,
	onceLesson,
	post,
	setOpening,
	stepOk,
} from './context.ts'
import type { Context } from './types.ts'

const PRICE_60 = 2500
const PRICE_90_PAID = 3700

function series(studentId: string, firstOn: string, startTime: string, minutes: number) {
	return sql(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(studentId)}, ${core.weekdayOf(firstOn)}, ${quote(startTime)}, ${minutes}, ${quote(firstOn)}, null) returning id`
	).rows[0].id
}

function counts() {
	const row = sql(
		`select (select count(*)::int from lesson_series) as series, (select count(*)::int from lesson_marks) as marks, (select count(*)::int from lessons) as lessons`
	).rows[0]
	return JSON.stringify(row)
}

function rule(seriesId: string) {
	return JSON.stringify(
		sql(
			`select weekday, start_time::text as start_time, time_zone, duration_minutes, starts_on::text as starts_on, ends_on::text as ends_on from lesson_series where id = ${quote(seriesId)}`
		).rows[0]
	)
}

const owner = (seriesId: string) =>
	sql(`select student_id from lesson_series where id = ${quote(seriesId)}`).rows[0]?.student_id

async function card(ctx: Context, name: string, minutes: number) {
	const created = await createCard(ctx, name)
	await call(ctx.api, 'PATCH', `/students/${created}`, {
		cookie: ctx.cookie,
		body: { ...cardBody(name), defaultLessonMinutes: minutes },
	})
	return created
}

async function pay(ctx: Context, studentId: string, paidOn: string, lessons: number, amountRub: number) {
	await stepOk('payment', () =>
		call(ctx.api, 'POST', '/payments', {
			cookie: ctx.cookie,
			body: {
				studentId,
				paidOn,
				amountMinor: amountRub * 100,
				currency: 'RUB',
				lessonsHundredths: lessons * 100,
				note: null,
			},
		})
	)
}

export async function sectionRebind(ctx: Context) {
	const hour = await card(ctx, 'Alex Example 2190', 60)
	const long = await card(ctx, 'Alex Example 2191', 90)
	const spare = await card(ctx, 'Alex Example 2192', 60)
	const opening = core.addDays(ctx.today, -30)
	for (const id of [hour, long, spare]) await setOpening(ctx, id, 0, opening)
	const paidOn = core.addDays(opening, 1)
	await pay(ctx, hour, paidOn, 5, 5 * PRICE_60)
	await pay(ctx, long, paidOn, 5, 5 * PRICE_90_PAID)

	const firstHour = core.addDays(opening, 2)
	const firstLong = core.addDays(opening, 4)
	const hourSeries = series(hour, firstHour, '10:00', 60)
	const longSeries = series(hour, firstLong, '12:00', 90)
	for (let week = 0; week < 4; week++) {
		for (const [id, first] of [
			[hourSeries, firstHour],
			[longSeries, firstLong],
		] as const)
			await stepOk('done mark', () =>
				post(ctx, `/series/${id}/occurrences/${core.addDays(first, 7 * week)}/mark`, { kind: 'done' })
			)
	}

	const total = async () => {
		const a = await balances(ctx, hour)
		const b = await balances(ctx, long)
		return { hour: a.profile as number, long: b.profile as number }
	}
	const before = await total()
	check(
		'long series still on the 60 minute card: 60-minute card owes 300, 90-minute card holds 450',
		before.hour === -300 && before.long === 450,
		JSON.stringify(before)
	)

	const kept = counts()
	const keptRule = rule(longSeries)
	const body = { studentId: long, expectedStudentId: hour }
	await stepOk('move the 90 minute series to its own card', () =>
		call(ctx.api, 'POST', `/schedule/series/${longSeries}/student`, { cookie: ctx.cookie, body })
	)
	check('series now belongs to the 90 minute card', owner(longSeries) === long)
	check('series rule columns are untouched', rule(longSeries) === keptRule)
	check('no series, mark or lesson row was removed or added', counts() === kept, `${kept} -> ${counts()}`)

	const after = await expectBalance(ctx, hour, 'the 60 minute card keeps one paid lesson', 60)
	const second = await expectBalance(ctx, long, 'the 90 minute card keeps one paid lesson', 90)
	const lessonsLeft = ((after.profile as number) / 60) * PRICE_60 + ((second.profile as number) / 90) * PRICE_90_PAID
	check(
		'combined remainder equals the hand count to the rouble',
		lessonsLeft === PRICE_60 + PRICE_90_PAID,
		String(lessonsLeft)
	)
	check(
		'combined minutes did not change by the move',
		before.hour + before.long === (after.profile as number) + (second.profile as number)
	)

	await expectStatus(
		'the same expectation again is stale',
		() => call(ctx.api, 'POST', `/schedule/series/${longSeries}/student`, { cookie: ctx.cookie, body }),
		409,
		'lesson_changed'
	)
	await expectStatus(
		'moving to the current card',
		() =>
			call(ctx.api, 'POST', `/schedule/series/${longSeries}/student`, {
				cookie: ctx.cookie,
				body: { studentId: long, expectedStudentId: long },
			}),
		400,
		'invalid_request'
	)
	await expectStatus(
		'an unknown series',
		() =>
			call(ctx.api, 'POST', `/schedule/series/00000000-0000-4000-8000-000000000000/student`, {
				cookie: ctx.cookie,
				body: { studentId: hour, expectedStudentId: long },
			}),
		404
	)
	await expectStatus(
		'a malformed body',
		() =>
			call(ctx.api, 'POST', `/schedule/series/${longSeries}/student`, {
				cookie: ctx.cookie,
				body: { studentId: hour },
			}),
		400,
		'invalid_request'
	)
	await expectStatus(
		'an anonymous caller',
		() =>
			call(ctx.api, 'POST', `/schedule/series/${longSeries}/student`, {
				body: { studentId: hour, expectedStudentId: long },
			}),
		401
	)

	await call(ctx.api, 'POST', `/students/${spare}/archive`, { cookie: ctx.cookie, body: {} })
	await expectStatus(
		'an archived card as the target',
		() =>
			call(ctx.api, 'POST', `/schedule/series/${longSeries}/student`, {
				cookie: ctx.cookie,
				body: { studentId: spare, expectedStudentId: long },
			}),
		400,
		'invalid_request'
	)
	check('a refused move changes nothing', owner(longSeries) === long)

	const single = onceLesson(long, core.addDays(ctx.today, -2), '09:00', 90)
	await stepOk('mark the single lesson', () => post(ctx, `/lessons/${single}/mark`, { kind: 'done' }))
	await expectBalance(ctx, long, 'the single 90 minute lesson counts on its card', 0)
	await stepOk('move the single lesson', () =>
		call(ctx.api, 'POST', `/schedule/lessons/${single}/student`, {
			cookie: ctx.cookie,
			body: { studentId: hour, expectedStudentId: long },
		})
	)
	await expectBalance(ctx, long, 'the single lesson left the 90 minute card', 90)
	await expectBalance(ctx, hour, 'the single lesson landed on the 60 minute card', 60 - 90)
	return 'SCHEDULE_REBIND_OK'
}
