import { randomUUID } from 'node:crypto'

import * as core from '../../../packages/core/src/index.ts'
import {
	CHANGES_NAME,
	check,
	countRows,
	createCard,
	createLesson,
	expectStatus,
	insertSeries,
	instant,
	occurrencePath,
	pastSnapshot,
	post,
	seriesCount,
	seriesRow,
	weekBlocks,
} from './context.ts'
import { quote, sql } from './io.ts'
import type { RequestBody } from './types.ts'
import type { Api, ChangeContext, ScheduleBlock } from './types.ts'

export async function partSeries(ctx: ChangeContext) {
	const { api, cookie, s1, dW, today, thisMonday, studentId } = ctx
	const at = (date: string) => instant(date, '18:00')
	const key = (date: string) => `s:${s1}:${date}`
	const day = (offset: number) => core.addDays(dW, offset)
	const { before, n, cutBody, cardB, snapshotBefore } = await cutPreparedSeries(api, cookie, ctx, s1, dW, day)
	const { snapshotAfterCut } = await inspectCutPersistence(ctx, s1, day, before, studentId)
	const { cardBlocks, ofSeries } = await inspectFutureCutWeeks(api, cookie, studentId, day, s1, n)
	await inspectRetainedCutWeeks(cardBlocks, dW, ofSeries, s1, key, at, day)
	await refuseRepeatedCut(ctx, api, cookie, s1, cutBody)
	await refuseInvalidCuts(today, cardB, api, cookie, n, day, thisMonday, dW, ctx, cutBody)
	const { endCount } = await endCutSeries(ctx, api, cookie, n, day, ofSeries, cardBlocks, today)
	await emptyFutureSeries(today, api, cookie, cardB, ctx, ofSeries, endCount)
	check(
		'past weeks snapshot is unchanged by the cut',
		snapshotBefore === ctx.snapshot && snapshotAfterCut === snapshotBefore
	)
	check('past weeks snapshot is unchanged after every change', (await pastSnapshot(ctx)) === ctx.snapshot)
	return 'SERIES_OK'
}

async function cutPreparedSeries(
	api: Api,
	cookie: string,
	ctx: ChangeContext,
	s1: string,
	dW: string,
	day: (offset: number) => string
) {
	const cardB = await createCard(api, cookie, ctx.ids, `${CHANGES_NAME} B`)
	const prep: [string, string, RequestBody][] = [
		['move dW to Friday 10:00 again', occurrencePath(s1, dW, 'move'), { date: day(2), startTime: '10:00' }],
		[
			'move dW+14 to Monday of week dW+7 12:00 again',
			occurrencePath(s1, day(14), 'move'),
			{ date: day(5), startTime: '12:00' },
		],
		['move dW+21 to Tuesday 09:00', occurrencePath(s1, day(21), 'move'), { date: day(20), startTime: '09:00' }],
		['cancel dW+28', occurrencePath(s1, day(28), 'cancel'), {}],
	]
	for (const [label, path, body] of prep) await expectStatus(label, () => post(api, cookie, path, body), 200)
	const snapshotBefore = await pastSnapshot(ctx)
	const before = countRows(ctx)
	const cutBody = { from: day(14), weekday: 4, startTime: '17:00' }
	const cut = await post(api, cookie, `/series/${s1}/move`, cutBody)
	const created = cut.json?.series
	check(
		'move S1 from dW+14 to Thursday 17:00 gives 200 with the new series',
		cut.status === 200 &&
			created?.id !== s1 &&
			created?.weekday === 4 &&
			created?.startTime === '17:00' &&
			created?.durationMinutes === 60 &&
			created?.startsOn === day(15) &&
			created?.endsOn === null,
		`status ${cut.status} ${JSON.stringify(created ?? null)}`
	)
	const n = created?.id
	return { before, n, cutBody, cardB, snapshotBefore }
}

async function inspectCutPersistence(
	ctx: ChangeContext,
	s1: string,
	day: (offset: number) => string,
	before: Awaited<ReturnType<typeof cutPreparedSeries>>['before'],
	studentId: string
) {
	const snapshotAfterCut = await pastSnapshot(ctx)
	const after = countRows(ctx)
	check('old series ends on dW+13', seriesRow(s1)?.ends_on === day(13), seriesRow(s1)?.ends_on)
	check(
		'cut adds one series and two lessons and keeps every exception row',
		after.series === before.series + 1 &&
			after.lessons === before.lessons + 2 &&
			after.exceptions === before.exceptions,
		JSON.stringify({ before, after })
	)
	const lessonAt = (iso: string) =>
		sql(
			`select count(*)::int as n from lessons where student_id = ${quote(studentId)} and starts_at = ${quote(iso)} and status = 'scheduled' and duration_minutes = 60`
		).rows[0].n
	check(
		'moved occurrences after From became lessons at their destination times',
		lessonAt(instant(day(5), '12:00')) === 1 && lessonAt(instant(day(20), '09:00')) === 1
	)
	return { snapshotAfterCut }
}

async function inspectFutureCutWeeks(
	api: Api,
	cookie: string,
	studentId: string,
	day: (offset: number) => string,
	s1: string,
	n: string
) {
	const cardBlocks = async (date: string) =>
		(await weekBlocks(api, cookie, core.mondayOf(date))).filter((block) => block.studentId === studentId)
	const ofSeries = (blocks: ScheduleBlock[], id: string) =>
		blocks.filter((block) => block.ref.kind === 'series' && block.ref.seriesId === id)
	let blocks = await cardBlocks(day(21))
	const tuesday = blocks.filter((block) => block.startsAt === instant(day(20), '09:00'))
	check(
		'week dW+21 has no Wednesday, has the new Thursday 17:00 and one Tuesday 09:00 lesson',
		ofSeries(blocks, s1).length === 0 &&
			ofSeries(blocks, n).some(
				(block) => block.startsAt === instant(day(22), '17:00') && block.outcome === 'planned'
			) &&
			tuesday.length === 1 &&
			tuesday[0].ref.kind === 'single'
	)
	blocks = await cardBlocks(day(28))
	check(
		'week dW+28 has no cancelled Wednesday and has the new Thursday',
		ofSeries(blocks, s1).length === 0 &&
			ofSeries(blocks, n).some((block) => block.startsAt === instant(day(29), '17:00'))
	)
	blocks = await cardBlocks(day(35))
	check(
		'week dW+35 drops the cancelled exception of S1',
		ofSeries(blocks, s1).length === 0 && ofSeries(blocks, n).length === 1
	)
	return { cardBlocks, ofSeries }
}

async function inspectRetainedCutWeeks(
	cardBlocks: Awaited<ReturnType<typeof inspectFutureCutWeeks>>['cardBlocks'],
	dW: string,
	ofSeries: Awaited<ReturnType<typeof inspectFutureCutWeeks>>['ofSeries'],
	s1: string,
	key: (date: string) => string,
	at: (date: string) => string,
	day: (offset: number) => string
) {
	let blocks: ScheduleBlock[]
	blocks = await cardBlocks(dW)
	const own = ofSeries(blocks, s1)
	check(
		'week dW keeps the moved ghost and the Friday destination of S1',
		own.length === 2 &&
			own.some((block) => block.key === key(dW) && block.outcome === 'moved' && block.startsAt === at(dW)) &&
			own.some(
				(block) => block.key === key(dW) && block.outcome === 'planned' && block.startsAt === instant(day(2), '10:00')
			)
	)
	blocks = await cardBlocks(day(7))
	const monday = blocks.filter((block) => block.startsAt === instant(day(5), '12:00'))
	check(
		'week dW+7 keeps the restored Wednesday and one Monday 12:00 lesson',
		ofSeries(blocks, s1).some((block) => block.key === key(day(7)) && block.outcome === 'planned') &&
			monday.length === 1 &&
			monday[0].ref.kind === 'single'
	)
}

async function refuseRepeatedCut(
	ctx: ChangeContext,
	api: Api,
	cookie: string,
	s1: string,
	cutBody: Awaited<ReturnType<typeof cutPreparedSeries>>['cutBody']
) {
	const seriesBefore = seriesCount(ctx)
	await expectStatus('repeat of the same cut', () => post(api, cookie, `/series/${s1}/move`, cutBody), 409)
	check('repeated cut adds no series', seriesCount(ctx) === seriesBefore)
}

async function refuseInvalidCuts(
	today: string,
	cardB: string,
	api: Api,
	cookie: string,
	n: string,
	day: (offset: number) => string,
	thisMonday: string,
	dW: string,
	ctx: ChangeContext,
	cutBody: Awaited<ReturnType<typeof cutPreparedSeries>>['cutBody']
) {
	const todayWeekday = core.weekdayOf(today)
	const s2 = insertSeries(cardB, todayWeekday, '00:00', core.addDays(today, -14), null)
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind) values (${quote(s2)}, ${quote(today)}, 'cancelled')`
	)
	await expectStatus(
		'cut with From today after the started lesson of today',
		() => post(api, cookie, `/series/${s2}/move`, { from: today, weekday: (todayWeekday % 7) + 1, startTime: '10:00' }),
		400,
		'series_today_passed'
	)
	await expectStatus(
		'cut to the same day and time',
		() => post(api, cookie, `/series/${n}/move`, { from: day(15), weekday: 4, startTime: '17:00' }),
		400
	)
	await expectStatus(
		'cut from yesterday',
		() => post(api, cookie, `/series/${n}/move`, { from: core.addDays(today, -1), weekday: 5, startTime: '10:00' }),
		400
	)
	const s3 = insertSeries(cardB, 1, '10:00', core.addDays(thisMonday, -21), core.addDays(thisMonday, -7))
	await expectStatus(
		'cut of a series ended last week',
		() => post(api, cookie, `/series/${s3}/move`, { from: today, weekday: 2, startTime: '10:00' }),
		409
	)
	const s4 = insertSeries(cardB, 3, '18:00', core.addDays(dW, -14), dW)
	const s4Before = JSON.stringify(seriesRow(s4))
	const s4Series = seriesCount(ctx)
	const s4Cut = await post(api, cookie, `/series/${s4}/move`, { from: dW, weekday: 4, startTime: '10:00' })
	check(
		'cut of a series that ends before the new day gives 400 series_ends_before_new_day',
		s4Cut.status === 400 && s4Cut.json?.error?.code === 'series_ends_before_new_day',
		`status ${s4Cut.status} ${JSON.stringify(s4Cut.json)}`
	)
	check(
		'refused cut keeps S4 and the series count',
		JSON.stringify(seriesRow(s4)) === s4Before && seriesCount(ctx) === s4Series
	)
	await expectStatus('cut of an unknown series', () => post(api, cookie, `/series/${randomUUID()}/move`, cutBody), 404)
}

async function endCutSeries(
	ctx: ChangeContext,
	api: Api,
	cookie: string,
	n: string,
	day: (offset: number) => string,
	ofSeries: Awaited<ReturnType<typeof inspectFutureCutWeeks>>['ofSeries'],
	cardBlocks: Awaited<ReturnType<typeof inspectFutureCutWeeks>>['cardBlocks'],
	today: string
) {
	const endCount = seriesCount(ctx)
	const ended = await post(api, cookie, `/series/${n}/end`, { lastOn: day(22) })
	check(
		'End of the new series on its second date gives 200',
		ended.status === 200 && ended.json?.series?.id === n && ended.json?.series?.endsOn === day(22),
		`status ${ended.status} ${JSON.stringify(ended.json?.series ?? null)}`
	)
	check(
		'new series shows on its second date and not after',
		ofSeries(await cardBlocks(day(22)), n).length === 1 && ofSeries(await cardBlocks(day(29)), n).length === 0
	)
	await expectStatus(
		'End with lastOn after the end',
		() => post(api, cookie, `/series/${n}/end`, { lastOn: day(29) }),
		400
	)
	await expectStatus(
		'End with lastOn yesterday',
		() => post(api, cookie, `/series/${n}/end`, { lastOn: core.addDays(today, -1) }),
		400
	)
	await expectStatus(
		'End of an unknown series',
		() => post(api, cookie, `/series/${randomUUID()}/end`, { lastOn: today }),
		404
	)
	return { endCount }
}

async function emptyFutureSeries(
	today: string,
	api: Api,
	cookie: string,
	cardB: string,
	ctx: ChangeContext,
	ofSeries: Awaited<ReturnType<typeof inspectFutureCutWeeks>>['ofSeries'],
	endCount: number
) {
	const later = core.addDays(today, 14)
	const future = await createLesson(api, cookie, {
		studentId: cardB,
		date: later,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	const s5 = future.json?.series
	if (future.status !== 201 || s5?.startsOn !== later) throw new Error(`future series create returned ${future.status}`)
	const countWithFuture = seriesCount(ctx)
	const emptied = await post(api, cookie, `/series/${s5.id}/end`, { lastOn: today })
	check(
		'End of a series that starts in two weeks gives endsOn = startsOn - 1',
		emptied.status === 200 && emptied.json?.series?.endsOn === core.addDays(later, -1),
		`status ${emptied.status} ${JSON.stringify(emptied.json?.series ?? null)}`
	)
	let futureBlocks = 0
	for (const offset of [0, 7]) {
		const week = await weekBlocks(api, cookie, core.mondayOf(core.addDays(later, offset)))
		futureBlocks += ofSeries(week, s5.id).length
	}
	check('emptied series has no blocks', futureBlocks === 0)
	check(
		'End keeps the lesson_series rows',
		seriesCount(ctx) === countWithFuture && countWithFuture === endCount + 1,
		`${endCount} ${countWithFuture}`
	)
}
