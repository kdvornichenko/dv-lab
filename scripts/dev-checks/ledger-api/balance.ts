import * as core from '../../../packages/core/src/index.ts'
import { call, quote, sql } from '../schedule-api/io.ts'
import {
	VN,
	cardBody,
	check,
	createCard,
	expectBalance,
	insertSeries,
	instant,
	lessonMarks,
	markSingle,
	occurrencePath,
	onceLesson,
	patchCard,
	post,
	setOpening,
	stepOk,
} from './context.ts'
import type { Context } from './types.ts'

export async function sectionBalance(ctx: Context) {
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

export async function sectionFlag(ctx: Context) {
	const { studentId, name } = await disableNoShowDeduction(ctx)
	await preserveAndRestoreFlag(ctx, studentId, name)
	await inspectFlagDefaultsAndInput(ctx, studentId, name)
	return 'SCHEDULE_LEDGER_FLAG_OK'
}

async function disableNoShowDeduction(ctx: Context) {
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
	return { studentId, name }
}

async function preserveAndRestoreFlag(ctx: Context, studentId: string, name: string) {
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
}

async function inspectFlagDefaultsAndInput(ctx: Context, studentId: string, name: string) {
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
}
