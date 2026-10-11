import { randomUUID } from 'node:crypto'

import * as core from '../../../packages/core/src/index.ts'
import { studentCookie } from '../schedule-api/io.ts'
import {
	blockOf,
	check,
	createCard,
	expectStatus,
	failures,
	instant,
	lessonMarks,
	occurrencePath,
	onceLesson,
	pastSeries,
	post,
	sameActions,
	seriesMarks,
} from './context.ts'
import type { Context } from './types.ts'

export async function marksPart1(ctx: Context) {
	const { date, key, seriesId, studentId, startsAt } = await markPastOccurrence(ctx)
	await inspectMarkedOccurrence(ctx, date, key)
	await repeatOccurrenceMark(ctx, seriesId, date)
	if (failures === ctx.before) console.log('MARKS_PART1_OK')
	return { studentId, seriesId, date, key, startsAt }
}

async function markPastOccurrence(ctx: Context) {
	const studentId = await createCard(ctx, 'Alex Example 2110')
	const date = core.addDays(ctx.today, -6)
	const seriesId = pastSeries(studentId, date, '10:00')
	const key = `s:${seriesId}:${date}`
	const startsAt = instant(date, '10:00')
	const marked = await post(ctx, occurrencePath(seriesId, date, 'mark'), { kind: 'done', expectedStartsAt: startsAt })
	check(
		'mark done of a past series occurrence gives 200 with kind done and outcome done',
		marked.status === 200 &&
			marked.json?.mark?.kind === 'done' &&
			marked.json?.mark?.outcome === 'done' &&
			marked.json?.mark?.ref?.kind === 'series' &&
			marked.json?.mark?.ref?.seriesId === seriesId &&
			marked.json?.mark?.ref?.originalOn === date,
		`status ${marked.status} ${JSON.stringify(marked.json ?? null)}`
	)
	return { date, key, seriesId, studentId, startsAt }
}

async function inspectMarkedOccurrence(ctx: Context, date: string, key: string) {
	const blocks = await blockOf(ctx, date, key)
	const block = blocks[0]
	check(
		'week shows the occurrence with outcome done, mark done and actions from core',
		blocks.length === 1 &&
			block.outcome === 'done' &&
			block.mark === 'done' &&
			sameActions(block.actions, { move: true, cancel: true, restore: false, mark: true, series: false }),
		JSON.stringify(blocks.map((item) => [item.outcome, item.mark, item.actions]))
	)
	check(
		'week block carries the ledger of the card',
		block?.ledger?.lessonMinutes === 60 && block?.ledger?.noShowDeducts === true && block?.ledger?.openingOn === null,
		JSON.stringify(block?.ledger ?? null)
	)
}

async function repeatOccurrenceMark(ctx: Context, seriesId: string, date: string) {
	const again = await post(ctx, occurrencePath(seriesId, date, 'mark'), { kind: 'done' })
	const rows = seriesMarks(seriesId, date)
	check(
		'repeated done keeps one lesson_marks row',
		again.status === 200 && rows.length === 1 && rows[0].kind === 'done',
		`status ${again.status} rows ${rows.length}`
	)
}

export async function marksPart2(ctx: Context, first: Awaited<ReturnType<typeof marksPart1>>) {
	const { seriesId, date, key, studentId } = first
	const path = occurrencePath(seriesId, date, 'mark')
	await correctOccurrenceMark(ctx, path, date, key, seriesId)
	await markPastSingle(ctx, studentId)
	await refuseInvalidMarks(ctx, studentId, path, date, seriesId)
}

async function correctOccurrenceMark(ctx: Context, path: string, date: string, key: string, seriesId: string) {
	const noShow = await post(ctx, path, { kind: 'no_show' })
	check(
		'mark no_show gives outcome no_show in the answer and the week',
		noShow.status === 200 &&
			noShow.json?.mark?.outcome === 'no_show' &&
			(await blockOf(ctx, date, key))[0]?.outcome === 'no_show',
		`status ${noShow.status}`
	)
	const none = await post(ctx, path, { kind: 'none' })
	const rows = seriesMarks(seriesId, date)
	const block = (await blockOf(ctx, date, key))[0]
	check(
		'mark none gives outcome planned and keeps the row with kind none',
		none.status === 200 &&
			none.json?.mark?.kind === 'none' &&
			none.json?.mark?.outcome === 'planned' &&
			block?.outcome === 'planned' &&
			block?.mark === 'none' &&
			rows.length === 1 &&
			rows[0].kind === 'none',
		`status ${none.status} rows ${rows.length}`
	)
}

async function markPastSingle(ctx: Context, studentId: string) {
	const pastDay = core.addDays(ctx.today, -3)
	const pastLesson = await onceLesson(ctx, studentId, pastDay, '09:00')
	const single = await post(ctx, `/lessons/${pastLesson}/mark`, {
		kind: 'done',
		expectedStartsAt: instant(pastDay, '09:00'),
	})
	check(
		'mark done of a past single lesson gives 200',
		single.status === 200 &&
			single.json?.mark?.ref?.kind === 'single' &&
			single.json?.mark?.ref?.lessonId === pastLesson &&
			single.json?.mark?.outcome === 'done' &&
			(await blockOf(ctx, pastDay, `l:${pastLesson}`))[0]?.outcome === 'done',
		`status ${single.status}`
	)
	check('past single lesson has one mark row', lessonMarks(pastLesson).length === 1)
}

async function refuseInvalidMarks(ctx: Context, studentId: string, path: string, date: string, seriesId: string) {
	const futureDay = core.addDays(ctx.today, 3)
	const futureLesson = await onceLesson(ctx, studentId, futureDay, '09:00')
	for (const kind of ['done', 'none']) {
		await expectStatus(
			`mark ${kind} of a future single lesson`,
			() => post(ctx, `/lessons/${futureLesson}/mark`, { kind }),
			400,
			'lesson_not_started'
		)
	}
	check('future single lesson has no mark row', lessonMarks(futureLesson).length === 0)
	await expectStatus(
		'mark with a stale expectedStartsAt',
		() => post(ctx, path, { kind: 'done', expectedStartsAt: instant(date, '09:00') }),
		409,
		'lesson_changed'
	)
	await expectStatus(
		'mark of an unknown lesson',
		() => post(ctx, `/lessons/${randomUUID()}/mark`, { kind: 'done' }),
		404,
		'not_found'
	)
	await expectStatus('mark with kind held', () => post(ctx, path, { kind: 'held' }), 400, 'invalid_request')
	const student = await studentCookie(ctx.api)
	await expectStatus('mark as a student', () => post(ctx, path, { kind: 'done' }, student), 403)
	const after = seriesMarks(seriesId, date)
	check('refused marks keep the row with kind none', after.length === 1 && after[0].kind === 'none')
}

export async function sectionMarks(ctx: Context) {
	const first = await marksPart1(ctx)
	await marksPart2(ctx, first)
	return 'SCHEDULE_LEDGER_MARKS_OK'
}
