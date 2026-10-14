import * as core from '../../../packages/core/src/index.ts'
import {
	blockOf,
	check,
	createCard,
	expectStatus,
	instant,
	lessonMarks,
	noActions,
	occurrencePath,
	onceLesson,
	pastSeries,
	placedAt,
	post,
	seriesMarks,
} from './context.ts'
import type { Context, Reply, SqlRow, PastTarget, ScheduleBlock } from './types.ts'

export async function pastSeriesOccurrence(ctx: Context, studentId: string) {
	const date = core.addDays(ctx.today, -5)
	const seriesId = pastSeries(studentId, date, '11:00')
	const key = `s:${seriesId}:${date}`
	const startsAt = instant(date, '11:00')
	const block = async () => (await blockOf(ctx, date, key))[0]
	const markRow = () => seriesMarks(seriesId, date)
	const path = (action: string) => occurrencePath(seriesId, date, action)
	return {
		label: 'series occurrence',
		key,
		date,
		startsAt,
		moveTime: '12:00',
		block,
		markRow,
		path,
		cancelOutcome: (res: Reply) => res.json?.occurrence?.outcome,
	}
}

export async function pastSingleLesson(ctx: Context, studentId: string) {
	const date = core.addDays(ctx.today, -4)
	const lessonId = onceLesson(studentId, date, '11:00')
	const startsAt = instant(date, '11:00')
	const block = async () => (await blockOf(ctx, date, `l:${lessonId}`))[0]
	const markRow = () => lessonMarks(lessonId)
	const path = (action: string) => `/lessons/${lessonId}/${action}`
	const cancelOutcome = (res: Reply) =>
		res.json?.lesson?.status === 'cancelled' ? 'cancelled' : res.json?.lesson?.status
	return {
		label: 'single lesson',
		key: `l:${lessonId}`,
		date,
		startsAt,
		moveTime: '14:00',
		block,
		markRow,
		path,
		cancelOutcome,
	}
}

export async function pastFlow(ctx: Context, target: PastTarget) {
	const { label, startsAt, block, markRow, path } = target
	await cancelMarkedPast(label, ctx, path, startsAt, block, markRow, target)
	await restoreMarkedPast(label, ctx, path, markRow, startsAt, block)
	await moveMarkedPast(ctx, target, label, path, startsAt, markRow)
	await inspectMovedGhost(target, ctx, startsAt, label)
}

async function cancelMarkedPast(
	label: string,
	ctx: Context,
	path: PastTarget['path'],
	startsAt: string,
	block: PastTarget['block'],
	markRow: PastTarget['markRow'],
	target: PastTarget
) {
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
}

async function restoreMarkedPast(
	label: string,
	ctx: Context,
	path: PastTarget['path'],
	markRow: PastTarget['markRow'],
	startsAt: string,
	block: PastTarget['block']
) {
	let rows: SqlRow[]
	let shown: ScheduleBlock
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
}

async function moveMarkedPast(
	ctx: Context,
	target: PastTarget,
	label: string,
	path: PastTarget['path'],
	startsAt: string,
	markRow: PastTarget['markRow']
) {
	let rows: SqlRow[]
	const moved = instant(core.addDays(ctx.today, 2), target.moveTime)
	await expectStatus(
		`move of the started marked ${label} to today + 2 days`,
		() =>
			post(ctx, path('move'), {
				date: core.addDays(ctx.today, 2),
				startTime: target.moveTime,
				expectedStartsAt: startsAt,
			}),
		200
	)
	rows = markRow()
	check(
		`the moved ${label} keeps one done mark row`,
		rows.length === 1 && rows[0].kind === 'done',
		`rows ${rows.length}`
	)
	const placed = await placedAt(ctx, target.key, moved)
	check(
		`the moved ${label} stands on its new place with outcome done and can be moved and marked`,
		placed.length === 1 &&
			placed[0].outcome === 'done' &&
			placed[0].mark === 'done' &&
			placed[0].actions?.move === true &&
			placed[0].actions?.mark === true,
		JSON.stringify(placed.map((block) => [block.outcome, block.mark, block.actions]))
	)
}

async function inspectMovedGhost(target: PastTarget, ctx: Context, startsAt: string, label: string) {
	if (target.key.startsWith('s:')) {
		const ghost = await placedAt(ctx, target.key, startsAt)
		check(
			`the old place of the ${label} keeps a ghost with the done mark and no actions`,
			ghost.length === 1 && ghost[0].outcome === 'moved' && ghost[0].mark === 'done' && noActions(ghost[0].actions),
			JSON.stringify(ghost.map((block) => [block.outcome, block.mark, block.actions]))
		)
	}
}

export async function sectionPast(ctx: Context) {
	const studentId = await createCard(ctx, 'Alex Example 2114')
	await pastFlow(ctx, await pastSeriesOccurrence(ctx, studentId))
	await pastFlow(ctx, await pastSingleLesson(ctx, studentId))
	return 'SCHEDULE_LEDGER_PAST_OK'
}
