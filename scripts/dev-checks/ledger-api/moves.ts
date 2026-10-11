import * as core from '../../../packages/core/src/index.ts'
import { call, quote, sql } from '../schedule-api/io.ts'
import {
	balances,
	cardMarks,
	check,
	createCard,
	cutLessonMarks,
	expectBalance,
	expectStatus,
	failures,
	getToday,
	insertLesson,
	insertSeries,
	instant,
	lessonMarks,
	markSingle,
	moveTo,
	noActions,
	occurrencePath,
	onceLesson,
	placedAt,
	post,
	setOpening,
	stepOk,
	weekBlocks,
} from './context.ts'
import { pastSeriesOccurrence } from './past.ts'
import type { Context, ScheduleBlock } from './types.ts'

export async function movesPart1(ctx: Context) {
	const before = failures
	const studentId = await createCard(ctx, 'Alex Example 2115')
	const yesterday = core.addDays(ctx.today, -1)
	const twoDaysAgo = core.addDays(ctx.today, -2)
	const single = await onceLesson(ctx, studentId, yesterday, '10:00')
	await stepOk('done of the yesterday lesson', () => markSingle(ctx, single, 'done'))
	await expectStatus(
		'move of the started marked single lesson to the day before yesterday',
		() => moveTo(ctx, `/lessons/${single}/move`, twoDaysAgo, '10:00', instant(yesterday, '10:00')),
		200
	)
	let marks = cardMarks(studentId)
	check(
		'the card keeps one done mark row on the same lesson',
		marks.length === 1 && marks[0].kind === 'done' && marks[0].lesson_id === single,
		JSON.stringify(marks.map((row) => row.kind))
	)
	const singlePlaced = await placedAt(ctx, `l:${single}`, instant(twoDaysAgo, '10:00'))
	check(
		'the week shows the single lesson on its new past place with outcome done',
		singlePlaced.length === 1 && singlePlaced[0].outcome === 'done',
		JSON.stringify(singlePlaced.map((block) => block.outcome))
	)

	const occurrence = await pastSeriesOccurrence(ctx, studentId)
	await expectStatus(
		'mark done of the started series occurrence',
		() => post(ctx, occurrence.path('mark'), { kind: 'done' }),
		200
	)
	const otherDay = core.addDays(occurrence.date, -1)
	const otherAt = instant(otherDay, '09:00')
	await expectStatus(
		'move of the started marked series occurrence to another past day',
		() => moveTo(ctx, occurrence.path('move'), otherDay, '09:00', occurrence.startsAt),
		200
	)
	const ghost = await placedAt(ctx, occurrence.key, occurrence.startsAt)
	check(
		'the old place keeps a ghost with outcome moved, mark done and no actions',
		ghost.length === 1 && ghost[0].outcome === 'moved' && ghost[0].mark === 'done' && noActions(ghost[0].actions),
		JSON.stringify(ghost.map((block) => [block.outcome, block.mark, block.actions]))
	)
	const placed = await placedAt(ctx, occurrence.key, otherAt)
	check(
		'the series occurrence stands on the other past day with outcome done',
		placed.length === 1 && placed[0].outcome === 'done',
		JSON.stringify(placed.map((block) => block.outcome))
	)
	marks = cardMarks(studentId)
	check('the card has two done mark rows', marks.length === 2 && marks.every((row) => row.kind === 'done'))

	const cancelledDay = core.addDays(ctx.today, -3)
	const cancelled = await onceLesson(ctx, studentId, cancelledDay, '12:00')
	await stepOk('cancel of the past lesson', () => post(ctx, `/lessons/${cancelled}/cancel`))
	await expectStatus(
		'move of the cancelled single lesson',
		() => moveTo(ctx, `/lessons/${cancelled}/move`, cancelledDay, '13:00'),
		409,
		'lesson_changed'
	)
	if (failures === before) console.log('MOVES_PART1_OK')
}

export async function cardFactsOf(ctx: Context, studentId: string) {
	const got = await balances(ctx, studentId)
	const list = await call(ctx.api, 'GET', '/students', { cookie: ctx.cookie })
	const row = list.json?.students?.find((student) => student.id === studentId)
	return { balance: got, next: { list: row?.nextLessonAt ?? null, profile: got.detail?.nextLessonAt ?? null } }
}

export async function expectNext(ctx: Context, studentId: string, label: string, expected: string | null) {
	const { next } = await cardFactsOf(ctx, studentId)
	check(
		`${label}: nextLessonAt ${expected} in the list and the profile`,
		next.list === expected && next.profile === expected,
		`list ${next.list} profile ${next.profile}`
	)
}

export async function movesBalance(ctx: Context, opening: string) {
	const studentId = await createCard(ctx, 'Alex Example 2116')
	await setOpening(ctx, studentId, 0, opening)
	const path = (lessonId: string, action: string) => `/lessons/${lessonId}/${action}`
	const first = core.addDays(opening, 1)
	const lessonId = await onceLesson(ctx, studentId, first, '10:00')
	await stepOk('done of the 2116 lesson', () => markSingle(ctx, lessonId, 'done'))
	await expectBalance(ctx, studentId, '2116 done on D+1', -60)
	let current = instant(first, '10:00')
	const steps: [string, string, number][] = [
		['moved to D+2', core.addDays(opening, 2), -60],
		['moved onto the opening day', opening, 0],
		['moved to the day before the opening day', core.addDays(opening, -1), 0],
		['moved back to D+1', first, -60],
		['moved to today + 2 days', core.addDays(ctx.today, 2), -60],
	]
	for (const [label, date, expected] of steps) {
		await stepOk(`2116 ${label}`, () => moveTo(ctx, path(lessonId, 'move'), date, '10:00', current))
		current = instant(date, '10:00')
		await expectBalance(ctx, studentId, `2116 ${label}`, expected)
		const rows = lessonMarks(lessonId)
		check(`2116 ${label}: one done mark row`, rows.length === 1 && rows[0].kind === 'done', `rows ${rows.length}`)
	}
	const placed = await placedAt(ctx, `l:${lessonId}`, current)
	check(
		'2116 the marked lesson on today + 2 days stays done and can be moved and corrected',
		placed.length === 1 &&
			placed[0].outcome === 'done' &&
			placed[0].actions?.mark === true &&
			placed[0].actions?.move === true,
		JSON.stringify(placed.map((block) => [block.outcome, block.actions]))
	)
	await expectNext(ctx, studentId, '2116 lesson on today + 2 days', current)
	await expectStatus('2116 mark none of the future marked lesson', () => markSingle(ctx, lessonId, 'none'), 200)
	await expectBalance(ctx, studentId, '2116 corrected to none', 0)
	await expectStatus(
		'2116 mark done of the future unmarked lesson',
		() => markSingle(ctx, lessonId, 'done'),
		400,
		'lesson_not_started'
	)
	const rows = cardMarks(studentId)
	check(
		'2116 keeps one mark row',
		rows.length === 1 && rows[0].kind === 'none',
		JSON.stringify(rows.map((row) => row.kind))
	)
}

export async function movesSeriesEnd(ctx: Context, opening: string) {
	const studentId = await createCard(ctx, 'Alex Example 2117')
	await setOpening(ctx, studentId, 0, opening)
	const yesterday = core.addDays(ctx.today, -1)
	const seriesId = insertSeries(studentId, core.weekdayOf(yesterday), '11:00', core.addDays(yesterday, -14))
	const natural = instant(yesterday, '11:00')
	const key = `s:${seriesId}:${yesterday}`
	await stepOk('no_show of the 2117 occurrence', () =>
		post(ctx, occurrencePath(seriesId, yesterday, 'mark'), { kind: 'no_show' })
	)
	await expectBalance(ctx, studentId, '2117 no_show of yesterday', -60)
	const otherDay = core.addDays(opening, 1)
	const otherAt = instant(otherDay, '09:00')
	await stepOk('2117 move to another past day', () =>
		moveTo(ctx, occurrencePath(seriesId, yesterday, 'move'), otherDay, '09:00', natural)
	)
	await expectBalance(ctx, studentId, '2117 moved to another past day after the opening day', -60)
	const ghost = await placedAt(ctx, key, natural)
	check(
		'2117 the ghost on the old place has outcome moved and mark no_show',
		ghost.length === 1 && ghost[0].outcome === 'moved' && ghost[0].mark === 'no_show',
		JSON.stringify(ghost.map((block) => [block.outcome, block.mark]))
	)
	await stepOk('2117 move back to the natural time', () =>
		moveTo(ctx, occurrencePath(seriesId, yesterday, 'move'), yesterday, '11:00', otherAt)
	)
	const restored = sql(
		`select kind from lesson_exceptions where series_id = ${quote(seriesId)} and original_on = ${quote(yesterday)}`
	).rows[0]
	check('2117 move back writes a restored row', restored?.kind === 'restored', `${restored?.kind}`)
	await expectBalance(ctx, studentId, '2117 back on the natural time', -60)

	const far = core.addDays(yesterday, 14)
	const farAt = instant(far, '11:00')
	const pulledAt = instant(yesterday, '10:00')
	await stepOk('2117 move of a future occurrence to yesterday 10:00', () =>
		moveTo(ctx, occurrencePath(seriesId, far, 'move'), yesterday, '10:00', farAt)
	)
	await stepOk('2117 done of the occurrence moved to yesterday', () =>
		post(ctx, occurrencePath(seriesId, far, 'mark'), { kind: 'done' })
	)
	await expectBalance(ctx, studentId, '2117 done of the pulled occurrence', -120)
	const ended = await post(ctx, `/series/${seriesId}/end`, { lastOn: ctx.today })
	check('2117 End series with lastOn today gives 200', ended.status === 200, `status ${ended.status}`)
	const cutRows = cutLessonMarks(studentId, pulledAt)
	check(
		'2117 End turns the pulled occurrence into a lessons row on yesterday 10:00 with the done mark',
		cutRows.length === 1 && cutRows[0].kind === 'done',
		JSON.stringify(cutRows.map((row) => row.kind))
	)
	const oldException = sql(
		`select kind from lesson_exceptions where series_id = ${quote(seriesId)} and original_on = ${quote(far)}`
	).rows[0]
	check('2117 the old exception row stays', oldException?.kind === 'moved', `${oldException?.kind}`)
	const shown = (await weekBlocks(ctx, yesterday)).filter(
		(block) => block.studentId === studentId && block.startsAt === pulledAt
	)
	check(
		'2117 the week of yesterday shows the lesson once with outcome done',
		shown.length === 1 && shown[0].ref.kind === 'single' && shown[0].outcome === 'done',
		JSON.stringify(shown.map((block) => [block.ref.kind, block.outcome]))
	)
	await expectBalance(ctx, studentId, '2117 after End without double count', -120)
	const marks = cardMarks(studentId)
	const bySeries = marks.filter((row) => row.series_id === seriesId && row.original_on === far)
	const byLesson = marks.filter((row) => row.lesson_id !== null && row.lesson_id === cutRows[0]?.id)
	check(
		'2117 the card has the old series mark, the copied lesson mark and the no_show mark',
		marks.length === 3 &&
			bySeries.length === 1 &&
			bySeries[0].kind === 'done' &&
			byLesson.length === 1 &&
			byLesson[0].kind === 'done' &&
			marks.some((row) => row.kind === 'no_show'),
		JSON.stringify(marks.map((row) => row.kind))
	)
}

export async function movesToday(ctx: Context, opening: string) {
	const studentId = await createCard(ctx, 'Alex Example 2118')
	await setOpening(ctx, studentId, 0, opening)
	const yesterday = core.addDays(ctx.today, -1)
	const tomorrow = core.addDays(ctx.today, 1)
	const futureDay = core.addDays(ctx.today, 2)
	const lessonId = await onceLesson(ctx, studentId, futureDay, '10:00')
	const key = `l:${lessonId}`
	await stepOk('2118 move of the future lesson to yesterday', () =>
		moveTo(ctx, `/lessons/${lessonId}/move`, yesterday, '10:00', instant(futureDay, '10:00'))
	)
	let today = await getToday(ctx)
	let earlier = (today.json?.earlier ?? []).find((block) => block.key === key)
	check(
		'2118 the unmarked lesson moved to yesterday is in earlier and can be marked',
		earlier?.outcome === 'planned' && earlier?.actions?.mark === true,
		JSON.stringify([earlier?.outcome, earlier?.actions])
	)
	await stepOk('2118 move of the lesson to tomorrow', () =>
		moveTo(ctx, `/lessons/${lessonId}/move`, tomorrow, '10:00', instant(yesterday, '10:00'))
	)
	today = await getToday(ctx)
	check(
		'2118 the lesson moved to tomorrow is not in earlier',
		!(today.json?.earlier ?? []).some((block) => block.key === key)
	)
	const lateAt = instant(ctx.today, '23:45')
	if (new Date(lateAt).getTime() <= Date.now()) {
		console.log('SKIP 2118 today 23:45 in Vietnam has passed')
		return
	}
	const pastId = await onceLesson(ctx, studentId, yesterday, '12:00')
	await stepOk('2118 move of the past lesson to today 23:45', () =>
		moveTo(ctx, `/lessons/${pastId}/move`, ctx.today, '23:45', instant(yesterday, '12:00'))
	)
	today = await getToday(ctx)
	const late = (today.json?.lessons ?? []).find((block) => block.key === `l:${pastId}`)
	check(
		'2118 the past lesson moved to tonight is in lessons, cannot be marked yet and is not in earlier',
		late?.actions?.mark === false && !(today.json?.earlier ?? []).some((block) => block.key === `l:${pastId}`),
		JSON.stringify([late?.outcome, late?.actions])
	)
}

export async function movesNext(ctx: Context) {
	const studentId = await createCard(ctx, 'Alex Example 2119')
	const yesterday = core.addDays(ctx.today, -1)
	const tomorrow = core.addDays(ctx.today, 1)
	const lessonId = insertLesson(studentId, instant(yesterday, '10:00'))
	await expectNext(ctx, studentId, '2119 only a past lesson', null)
	await stepOk('2119 move of the past lesson to tomorrow', () =>
		moveTo(ctx, `/lessons/${lessonId}/move`, tomorrow, '10:00', instant(yesterday, '10:00'))
	)
	await expectNext(ctx, studentId, '2119 the lesson moved to tomorrow', instant(tomorrow, '10:00'))
	await stepOk('2119 move of the lesson back to yesterday', () =>
		moveTo(ctx, `/lessons/${lessonId}/move`, yesterday, '10:00', instant(tomorrow, '10:00'))
	)
	await expectNext(ctx, studentId, '2119 the lesson back on yesterday', null)
	const firstOn = core.addDays(ctx.today, 7)
	const seriesId = insertSeries(studentId, core.weekdayOf(firstOn), '15:00', firstOn)
	await stepOk('2119 move of the first series occurrence to yesterday', () =>
		moveTo(ctx, occurrencePath(seriesId, firstOn, 'move'), yesterday, '15:00', instant(firstOn, '15:00'))
	)
	await expectNext(
		ctx,
		studentId,
		'2119 first occurrence pulled into the past',
		instant(core.addDays(firstOn, 7), '15:00')
	)
}

export async function movesPart2(ctx: Context) {
	const before = failures
	const opening = core.addDays(ctx.today, -3)
	await movesBalance(ctx, opening)
	await movesSeriesEnd(ctx, opening)
	await movesToday(ctx, opening)
	await movesNext(ctx)
	if (failures === before) console.log('MOVES_PART2_OK')
}

export async function sectionMoves(ctx: Context) {
	await movesPart1(ctx)
	await movesPart2(ctx)
	return 'SCHEDULE_LEDGER_MOVES_OK'
}
