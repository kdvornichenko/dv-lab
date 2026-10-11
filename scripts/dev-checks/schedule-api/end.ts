import * as core from '../../../packages/core/src/index.ts'
import {
	CHANGES_NAME,
	check,
	countRows,
	createCard,
	exceptionRow,
	insertSeries,
	instant,
	post,
	seriesBlocks,
	weekBlocks,
} from './context.ts'
import { quote, sql } from './io.ts'
import type { ChangeContext, ScheduleBlock } from './types.ts'

export async function partEndKeepsMoved(ctx: ChangeContext) {
	const { api, cookie, today } = ctx
	const cardD = await createCard(api, cookie, ctx.ids, `${CHANGES_NAME} D`)
	const first = core.addDays(today, 3)
	const yesterday = core.addDays(today, -1)
	const lastPast = core.addDays(first, -7)
	const lateOrigin = core.addDays(first, 7)
	const pastTarget = instant(yesterday, '07:00')
	const keptDay = core.addDays(lastPast, 1)
	const keptTarget = instant(keptDay, '07:00')
	const s10 = insertSeries(cardD, core.weekdayOf(first), '18:00', core.addDays(first, -14), null)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(s10)}, ${quote(lateOrigin)}, 'moved', ${quote(pastTarget)}, 60)`
	)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(s10)}, ${quote(lastPast)}, 'moved', ${quote(keptTarget)}, 60)`
	)
	const atYesterday = async () =>
		(await weekBlocks(api, cookie, core.mondayOf(yesterday))).filter(
			(block) => block.studentId === cardD && block.startsAt === pastTarget
		)
	let blocks = await atYesterday()
	check(
		'before End the lesson moved from a later date to yesterday stands there as a series occurrence',
		blocks.length === 1 &&
			blocks[0].ref.kind === 'series' &&
			blocks[0].outcome === 'planned' &&
			blocks[0].movedFrom === instant(lateOrigin, '18:00'),
		JSON.stringify(blocks)
	)
	const before = countRows(ctx)
	const ended = await post(api, cookie, `/series/${s10}/end`, { lastOn: today })
	check(
		'End with lastOn today gives 200 and ends on the last past date',
		ended.status === 200 && ended.json?.series?.endsOn === lastPast,
		`status ${ended.status} ${JSON.stringify(ended.json?.series ?? null)}`
	)
	const after = countRows(ctx)
	check(
		'End adds one lesson and keeps every series and exception row',
		after.lessons === before.lessons + 1 && after.series === before.series && after.exceptions === before.exceptions,
		JSON.stringify({ before, after })
	)
	blocks = await atYesterday()
	check(
		'after End the lesson stays on yesterday as a single scheduled lesson',
		blocks.length === 1 &&
			blocks[0].ref.kind === 'single' &&
			blocks[0].outcome === 'planned' &&
			blocks[0].durationMinutes === 60,
		JSON.stringify(blocks)
	)
	const kept = (await seriesBlocks(api, cookie, keptDay, s10)).filter(
		(block) => block.key === `s:${s10}:${lastPast}` && block.startsAt === keptTarget
	)
	check(
		'the moved occurrence on or before the new end stays a series occurrence',
		kept.length === 1 && kept[0].outcome === 'planned',
		JSON.stringify(kept)
	)
	check(
		'exception rows of the series stay moved',
		exceptionRow(s10, lateOrigin)?.kind === 'moved' && exceptionRow(s10, lastPast)?.kind === 'moved'
	)
	return 'END_KEEPS_MOVED_OK'
}
