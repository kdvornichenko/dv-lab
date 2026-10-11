import * as core from '../../../packages/core/src/index.ts'
import { quote, sql } from '../schedule-api/io.ts'
import {
	blockOf,
	check,
	createCard,
	cutBody,
	cutLessonMarks,
	failures,
	lessonMarks,
	movedIntoToday,
	occurrencePath,
	onceLesson,
	pastSeries,
	post,
	seriesMarks,
	sharedStarts,
	todayBlocks,
} from './context.ts'
import type { Context, Reply, SqlRow, ScheduleBlock } from './types.ts'

export const isServerError = (status: number) => status >= 500

export async function racePart1(ctx: Context) {
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
	const expected: Record<string, string> = { done: 'done', no_show: 'no_show', none: 'planned' }
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

export async function raceAgreement(
	ctx: Context,
	label: string,
	[mark, cancel]: [Reply, Reply],
	markRow: () => SqlRow[],
	block: () => Promise<ScheduleBlock>
) {
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

export async function cutFlow(
	ctx: Context,
	name: string,
	label: string,
	send: (fixture: Awaited<ReturnType<typeof movedIntoToday>>) => Promise<Reply>
) {
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

export async function sectionCut(ctx: Context) {
	await cutFlow(ctx, 'Alex Example 2111', 'series move', ({ seriesId }) =>
		post(ctx, `/series/${seriesId}/move`, cutBody(ctx))
	)
	await cutFlow(ctx, 'Alex Example 2111 E', 'series end', ({ seriesId }) =>
		post(ctx, `/series/${seriesId}/end`, { lastOn: ctx.today })
	)
	return 'SCHEDULE_LEDGER_CUT_OK'
}

export async function racePart3(ctx: Context) {
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

export async function sectionRace(ctx: Context) {
	await racePart1(ctx)
	await racePart3(ctx)
	return 'SCHEDULE_LEDGER_RACE_OK'
}
