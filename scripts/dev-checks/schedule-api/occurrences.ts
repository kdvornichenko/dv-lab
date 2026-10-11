import { randomUUID } from 'node:crypto'

import * as core from '../../../packages/core/src/index.ts'
import {
	CHANGES_NAME,
	check,
	countRows,
	createCard,
	exceptionRow,
	expectStatus,
	insertSeries,
	instant,
	occurrencePath,
	pastSnapshot,
	post,
	seriesBlocks,
} from './context.ts'
import { call, quote, sql } from './io.ts'
import type { Refusal } from './types.ts'
import type { Api, ChangeContext, ScheduleBlock } from './types.ts'

export async function partPastOrigin(ctx: ChangeContext) {
	const { api, cookie, today } = ctx
	const cardC = await createCard(api, cookie, ctx.ids, `${CHANGES_NAME} C`)
	const yesterday = core.addDays(today, -1)
	const natural = instant(yesterday, '07:00')
	const target = instant(core.addDays(today, 2), '07:00')
	const s9 = insertSeries(cardC, core.weekdayOf(yesterday), '07:00', core.addDays(yesterday, -7), null)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(s9)}, ${quote(yesterday)}, 'moved', ${quote(target)}, 60)`
	)
	countRows(ctx)
	const key = `s:${s9}:${yesterday}`
	const placed = async () => {
		const blocks = [
			...(await seriesBlocks(api, cookie, yesterday, s9)),
			...(await seriesBlocks(api, cookie, core.addDays(today, 2), s9)),
		]
		const unique = new Map(blocks.map((block) => [`${block.key}|${block.startsAt}|${block.outcome}`, block]))
		return [...unique.values()].filter((block) => block.key === key)
	}
	const cancelled = await post(api, cookie, occurrencePath(s9, yesterday, 'cancel'), { expectedStartsAt: target })
	check(
		'cancel of a lesson moved from yesterday to the future gives 200 on the moved time',
		cancelled.status === 200 &&
			cancelled.json?.occurrence?.outcome === 'cancelled' &&
			cancelled.json?.occurrence?.startsAt === target,
		`status ${cancelled.status} ${JSON.stringify(cancelled.json ?? null)}`
	)
	countRows(ctx)
	let blocks = await placed()
	check(
		'the cancelled lesson stands on the moved place, can be restored, and yesterday keeps the ghost',
		blocks.length === 2 &&
			blocks.some(
				(block) =>
					block.outcome === 'cancelled' &&
					block.startsAt === target &&
					block.movedFrom === natural &&
					block.actions?.restore === true
			) &&
			blocks.some((block) => block.outcome === 'moved' && block.startsAt === natural && block.movedTo === target),
		JSON.stringify(blocks.map((block) => [block.outcome, block.startsAt, block.actions]))
	)
	const restored = await post(api, cookie, occurrencePath(s9, yesterday, 'restore'), { expectedStartsAt: target })
	check(
		'restore of that lesson gives 200 and returns it to the moved place',
		restored.status === 200 &&
			restored.json?.occurrence?.outcome === 'planned' &&
			restored.json?.occurrence?.startsAt === target,
		`status ${restored.status} ${JSON.stringify(restored.json ?? null)}`
	)
	countRows(ctx)
	blocks = await placed()
	check(
		'after restore the lesson is planned on the moved place again',
		blocks.some((block) => block.outcome === 'planned' && block.startsAt === target) &&
			exceptionRow(s9, yesterday)?.kind === 'moved'
	)
}

export async function partOccurrence(ctx: ChangeContext) {
	const { api, cookie, s1, dW, today } = ctx
	const at = (date: string) => instant(date, '18:00')
	const key = (date: string) => `s:${s1}:${date}`
	const friday = core.addDays(dW, 2)
	const mondayNext = core.addDays(dW, 5)
	const dW7 = core.addDays(dW, 7)
	const dW14 = core.addDays(dW, 14)
	await moveOccurrence(api, cookie, s1, dW, friday, ctx)
	await inspectSameWeekMove(api, cookie, dW, s1, key, at, friday, dW7)
	await moveAcrossWeeks(api, cookie, s1, dW14, mondayNext, at, ctx, dW7, key)
	await cancelRestoreOccurrence(api, cookie, s1, dW7, ctx, key, at)
	const { mondayNoon } = await cancelMovedOccurrence(api, cookie, s1, dW14, mondayNext, ctx, dW7, key, at)
	await restoreMovedOccurrence(api, cookie, s1, dW14, at, mondayNoon, ctx, dW7, key)
	await returnToNaturalTime(api, cookie, s1, dW14, ctx)
	await cancelRestoreNaturalTime(api, cookie, s1, dW14, at, ctx)
	await restoreFirstAndPastOrigin(ctx, api, cookie, s1, dW, at)
	await refuseAndInspectPast(dW, api, cookie, s1, friday, dW7, ctx)
	return 'OCCURRENCE_OK'
}

async function moveOccurrence(api: Api, cookie: string, s1: string, dW: string, friday: string, ctx: ChangeContext) {
	const moved = await post(api, cookie, occurrencePath(s1, dW, 'move'), { date: friday, startTime: '10:00' })
	check(
		'move dW to Friday 10:00 gives 200 moved',
		moved.status === 200 &&
			moved.json?.occurrence?.outcome === 'planned' &&
			moved.json?.occurrence?.startsAt === instant(friday, '10:00'),
		`status ${moved.status}`
	)
	check(
		'occurrence response carries outcome and no status key',
		moved.json?.occurrence !== undefined && 'outcome' in moved.json.occurrence && !('status' in moved.json.occurrence)
	)
	countRows(ctx)
}

async function inspectSameWeekMove(
	api: Api,
	cookie: string,
	dW: string,
	s1: string,
	key: (date: string) => string,
	at: (date: string) => string,
	friday: string,
	dW7: string
) {
	let week = await seriesBlocks(api, cookie, dW, s1)
	const ghost = week.find((block) => block.key === key(dW) && block.outcome === 'moved')
	const destination = week.find((block) => block.key === key(dW) && block.outcome === 'planned')
	check(
		'week dW has the moved ghost and the Friday destination',
		week.length === 2 &&
			ghost?.startsAt === at(dW) &&
			ghost?.movedTo === instant(friday, '10:00') &&
			destination?.startsAt === instant(friday, '10:00') &&
			destination?.movedFrom === at(dW)
	)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'next Wednesday is unchanged',
		week.length === 1 && week[0].key === key(dW7) && week[0].outcome === 'planned' && week[0].startsAt === at(dW7)
	)
}

async function moveAcrossWeeks(
	api: Api,
	cookie: string,
	s1: string,
	dW14: string,
	mondayNext: string,
	at: (date: string) => string,
	ctx: ChangeContext,
	dW7: string,
	key: (date: string) => string
) {
	let week: ScheduleBlock[]
	const across = await post(api, cookie, occurrencePath(s1, dW14, 'move'), {
		date: mondayNext,
		startTime: '12:00',
		expectedStartsAt: at(dW14),
	})
	check('move dW+14 to Monday of week dW+7 gives 200', across.status === 200, `status ${across.status}`)
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 has the destination from dW+14 and its own Wednesday',
		week.length === 2 &&
			week.some(
				(block) =>
					block.key === key(dW14) &&
					block.outcome === 'planned' &&
					block.startsAt === instant(mondayNext, '12:00') &&
					block.movedFrom === at(dW14)
			) &&
			week.some((block) => block.key === key(dW7) && block.outcome === 'planned')
	)
	week = await seriesBlocks(api, cookie, dW14, s1)
	check(
		'week dW+14 has the ghost of the moved Wednesday',
		week.length === 1 && week[0].outcome === 'moved' && week[0].movedTo === instant(mondayNext, '12:00')
	)
}

async function cancelRestoreOccurrence(
	api: Api,
	cookie: string,
	s1: string,
	dW7: string,
	ctx: ChangeContext,
	key: (date: string) => string,
	at: (date: string) => string
) {
	let week: ScheduleBlock[]
	const cancelled = await post(api, cookie, occurrencePath(s1, dW7, 'cancel'))
	check(
		'cancel dW+7 gives 200 cancelled',
		cancelled.status === 200 &&
			cancelled.json?.occurrence?.outcome === 'cancelled' &&
			!('status' in cancelled.json.occurrence),
		`status ${cancelled.status}`
	)
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 shows the cancelled Wednesday',
		week.some((block) => block.key === key(dW7) && block.outcome === 'cancelled' && block.startsAt === at(dW7))
	)
	await expectStatus('second cancel of dW+7', () => post(api, cookie, occurrencePath(s1, dW7, 'cancel')), 409)
	const restored = await post(api, cookie, occurrencePath(s1, dW7, 'restore'), { expectedStartsAt: at(dW7) })
	check(
		'restore dW+7 gives 200 scheduled',
		restored.status === 200 && restored.json?.occurrence?.outcome === 'planned',
		`status ${restored.status}`
	)
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 shows the Wednesday scheduled again',
		week.some((block) => block.key === key(dW7) && block.outcome === 'planned' && block.startsAt === at(dW7))
	)
	check('exception row of dW+7 stays with kind restored', exceptionRow(s1, dW7)?.kind === 'restored')
	await expectStatus(
		'restore of a scheduled occurrence',
		() => post(api, cookie, occurrencePath(s1, dW7, 'restore')),
		409
	)
}

async function cancelMovedOccurrence(
	api: Api,
	cookie: string,
	s1: string,
	dW14: string,
	mondayNext: string,
	ctx: ChangeContext,
	dW7: string,
	key: (date: string) => string,
	at: (date: string) => string
) {
	let week: ScheduleBlock[]
	const cancelMoved = await post(api, cookie, occurrencePath(s1, dW14, 'cancel'), {
		expectedStartsAt: instant(mondayNext, '12:00'),
	})
	check('cancel the moved dW+14 gives 200', cancelMoved.status === 200, `status ${cancelMoved.status}`)
	countRows(ctx)
	const mondayNoon = instant(mondayNext, '12:00')
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 shows the moved dW+14 cancelled on Monday 12:00 with Return to schedule allowed',
		week.some(
			(block) =>
				block.key === key(dW14) &&
				block.outcome === 'cancelled' &&
				block.startsAt === mondayNoon &&
				block.movedFrom === at(dW14) &&
				block.actions?.restore === true
		)
	)
	week = await seriesBlocks(api, cookie, dW14, s1)
	check(
		'week dW+14 keeps the ghost of the moved Wednesday',
		week.length === 1 && week[0].outcome === 'moved' && week[0].startsAt === at(dW14) && week[0].movedTo === mondayNoon
	)
	const history = exceptionRow(s1, dW14)
	check(
		'cancelled dW+14 keeps the moved time in its row',
		history?.kind === 'cancelled' &&
			history?.starts_at !== null &&
			new Date(history.starts_at).toISOString() === mondayNoon
	)
	return { mondayNoon }
}

async function restoreMovedOccurrence(
	api: Api,
	cookie: string,
	s1: string,
	dW14: string,
	at: (date: string) => string,
	mondayNoon: string,
	ctx: ChangeContext,
	dW7: string,
	key: (date: string) => string
) {
	let week: ScheduleBlock[]
	await expectStatus(
		'restore dW+14 with the natural time as expectedStartsAt',
		() => post(api, cookie, occurrencePath(s1, dW14, 'restore'), { expectedStartsAt: at(dW14) }),
		409
	)
	const back = await post(api, cookie, occurrencePath(s1, dW14, 'restore'), { expectedStartsAt: mondayNoon })
	check(
		'restore dW+14 returns it to Monday 12:00',
		back.status === 200 &&
			back.json?.occurrence?.outcome === 'planned' &&
			back.json?.occurrence?.startsAt === mondayNoon,
		`status ${back.status} ${JSON.stringify(back.json?.occurrence ?? null)}`
	)
	countRows(ctx)
	const restoredRow = exceptionRow(s1, dW14)
	check(
		'restored dW+14 row is moved with the Monday time',
		restoredRow?.kind === 'moved' && new Date(restoredRow.starts_at).toISOString() === mondayNoon
	)
	week = await seriesBlocks(api, cookie, dW7, s1)
	check(
		'week dW+7 shows the dW+14 lesson planned on Monday 12:00 again',
		week.some((block) => block.key === key(dW14) && block.outcome === 'planned' && block.startsAt === mondayNoon)
	)
}

async function returnToNaturalTime(api: Api, cookie: string, s1: string, dW14: string, ctx: ChangeContext) {
	const homeAgain = await post(api, cookie, occurrencePath(s1, dW14, 'move'), { date: dW14, startTime: '18:00' })
	check(
		'move dW+14 back to its Wednesday gives 200 scheduled',
		homeAgain.status === 200 && homeAgain.json?.occurrence?.outcome === 'planned',
		`status ${homeAgain.status}`
	)
	countRows(ctx)
	const homeRow = exceptionRow(s1, dW14)
	check('restored dW+14 row has no time left', homeRow?.kind === 'restored' && homeRow?.starts_at === null)
}

async function cancelRestoreNaturalTime(
	api: Api,
	cookie: string,
	s1: string,
	dW14: string,
	at: (date: string) => string,
	ctx: ChangeContext
) {
	let week: ScheduleBlock[]
	const plainCancel = await post(api, cookie, occurrencePath(s1, dW14, 'cancel'), { expectedStartsAt: at(dW14) })
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW14, s1)
	check(
		'cancel after the move back stands on the natural Wednesday',
		plainCancel.status === 200 &&
			week.length === 1 &&
			week[0].outcome === 'cancelled' &&
			week[0].startsAt === at(dW14) &&
			week[0].movedTo === null &&
			exceptionRow(s1, dW14)?.starts_at === null
	)
	const plainBack = await post(api, cookie, occurrencePath(s1, dW14, 'restore'), { expectedStartsAt: at(dW14) })
	countRows(ctx)
	week = await seriesBlocks(api, cookie, dW14, s1)
	check(
		'restore dW+14 gives the Wednesday on its place',
		plainBack.status === 200 &&
			plainBack.json?.occurrence?.outcome === 'planned' &&
			week.length === 1 &&
			week[0].outcome === 'planned' &&
			week[0].startsAt === at(dW14) &&
			exceptionRow(s1, dW14)?.kind === 'restored',
		`status ${plainBack.status}`
	)
}

async function restoreFirstAndPastOrigin(
	ctx: ChangeContext,
	api: Api,
	cookie: string,
	s1: string,
	dW: string,
	at: (date: string) => string
) {
	let week: ScheduleBlock[]
	await partPastOrigin(ctx)
	const home = await post(api, cookie, occurrencePath(s1, dW, 'move'), { date: dW, startTime: '18:00' })
	check(
		'move dW back to Wednesday 18:00 gives 200 scheduled',
		home.status === 200 && home.json?.occurrence?.outcome === 'planned' && home.json?.occurrence?.startsAt === at(dW),
		`status ${home.status}`
	)
	countRows(ctx)
	check('exception row of dW has kind restored', exceptionRow(s1, dW)?.kind === 'restored')
	week = await seriesBlocks(api, cookie, dW, s1)
	check('week dW shows one Wednesday block', week.length === 1 && week[0].outcome === 'planned')
}

async function refuseAndInspectPast(
	dW: string,
	api: Api,
	cookie: string,
	s1: string,
	friday: string,
	dW7: string,
	ctx: ChangeContext
) {
	const past = core.addDays(dW, -14)
	const refusals: Refusal[] = [
		[
			'move of a Thursday originalOn',
			() => post(api, cookie, occurrencePath(s1, core.addDays(dW, 1), 'move'), { date: friday, startTime: '11:00' }),
			409,
		],
		[
			'cancel with expectedStartsAt one hour early',
			() => post(api, cookie, occurrencePath(s1, dW7, 'cancel'), { expectedStartsAt: instant(dW7, '17:00') }),
			409,
		],
		[
			'move of an unknown series',
			() => post(api, cookie, occurrencePath(randomUUID(), dW, 'move'), { date: friday, startTime: '11:00' }),
			404,
		],
		[
			'move with originalOn abc',
			() => post(api, cookie, occurrencePath(s1, 'abc', 'move'), { date: friday, startTime: '11:00' }),
			404,
		],
		[
			'cancel without a JSON body',
			() => call(api, 'POST', `/schedule${occurrencePath(s1, dW7, 'cancel')}`, { cookie }),
			400,
		],
	]
	for (const [label, send, status, code] of refusals) await expectStatus(label, send, status, code)
	countRows(ctx)
	const pastCancel = await post(api, cookie, occurrencePath(s1, past, 'cancel'))
	check(
		'cancel of a past Wednesday gives 200 cancelled',
		pastCancel.status === 200 && pastCancel.json?.occurrence?.outcome === 'cancelled',
		`status ${pastCancel.status}`
	)
	const pastRestore = await post(api, cookie, occurrencePath(s1, past, 'restore'))
	check(
		'restore of the past Wednesday gives 200 planned',
		pastRestore.status === 200 && pastRestore.json?.occurrence?.outcome === 'planned',
		`status ${pastRestore.status}`
	)
	countRows(ctx)
	const rows = sql(`select count(*)::int as n from lesson_exceptions where series_id = ${quote(s1)}`).rows[0].n
	check('S1 keeps 4 exception rows', rows === 4, `rows ${rows}`)
	check('past weeks snapshot is unchanged after occurrence changes', (await pastSnapshot(ctx)) === ctx.snapshot)
}
