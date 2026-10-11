import * as core from '../../../packages/core/src/index.ts'
import {
	CHANGES_NAME,
	VN,
	check,
	countRows,
	createCard,
	exceptionRow,
	expectStatus,
	insertSeries,
	instant,
	occurrencePath,
	post,
	seriesBlocks,
} from './context.ts'
import { quote, sql } from './io.ts'
import type { Api, ChangeContext, ScheduleBlock } from './types.ts'

export async function partMoveAnywhere(ctx: ChangeContext) {
	const { api, cookie, today } = ctx
	const cardP = await createCard(api, cookie, ctx.ids, `${CHANGES_NAME} P`)
	const s11 = insertSeries(cardP, core.weekdayOf(today), '18:00', core.addDays(today, -14), null)
	const pastOn = core.addDays(today, -7)
	const cancelledOn = core.addDays(today, -14)
	const futureOn = core.addDays(today, 7)
	const pastDay = core.addDays(today, -9)
	const key = (date: string) => `s:${s11}:${date}`
	const noActions = (block: ScheduleBlock) =>
		block.actions?.move === false &&
		block.actions?.cancel === false &&
		block.actions?.restore === false &&
		block.actions?.mark === false
	const blocksOf = async (dates: string[], wanted: string) => {
		const seen = new Map<string, ScheduleBlock>()
		for (const date of dates) {
			for (const block of await seriesBlocks(api, cookie, date, s11)) {
				if (block.key === wanted) seen.set(`${block.startsAt}|${block.outcome}`, block)
			}
		}
		return [...seen.values()]
	}
	countRows(ctx)
	const { pastTarget } = await movePastOccurrence(pastDay, api, cookie, s11, pastOn, ctx, blocksOf, key, noActions)
	await returnPastOccurrenceHome(api, cookie, s11, pastOn, pastTarget, ctx)
	await moveFutureIntoPast(today, futureOn, api, cookie, s11, ctx, blocksOf, key)
	await movePastSingleAndRefusals(today, cardP, ctx, api, cookie, s11, cancelledOn, pastDay)
	return 'MOVE_ANYWHERE_OK'
}

async function movePastOccurrence(
	pastDay: string,
	api: Api,
	cookie: string,
	s11: string,
	pastOn: string,
	ctx: ChangeContext,
	blocksOf: (dates: string[], wanted: string) => Promise<ScheduleBlock[]>,
	key: (date: string) => string,
	noActions: (block: ScheduleBlock) => boolean
) {
	const pastTarget = instant(pastDay, '10:00')
	const toPast = await post(api, cookie, occurrencePath(s11, pastOn, 'move'), {
		date: pastDay,
		startTime: '10:00',
		expectedStartsAt: instant(pastOn, '18:00'),
	})
	check(
		'move of a past occurrence to another past day 10:00 gives 200 moved',
		toPast.status === 200 &&
			toPast.json?.occurrence?.outcome === 'planned' &&
			toPast.json?.occurrence?.startsAt === pastTarget,
		`status ${toPast.status} ${JSON.stringify(toPast.json?.error ?? '')}`
	)
	countRows(ctx)
	let blocks = await blocksOf([pastOn, pastDay], key(pastOn))
	const ghost = blocks.find((block) => block.outcome === 'moved')
	const lesson = blocks.find((block) => block.outcome === 'planned')
	check(
		'the week shows the ghost on the old place and the lesson on the new past place',
		blocks.length === 2 &&
			ghost?.startsAt === instant(pastOn, '18:00') &&
			noActions(ghost) &&
			lesson?.startsAt === pastTarget &&
			lesson?.actions?.move === true,
		JSON.stringify(blocks.map((block) => [block.outcome, block.startsAt, block.actions]))
	)
	return { pastTarget }
}

async function returnPastOccurrenceHome(
	api: Api,
	cookie: string,
	s11: string,
	pastOn: string,
	pastTarget: string,
	ctx: ChangeContext
) {
	const home = await post(api, cookie, occurrencePath(s11, pastOn, 'move'), {
		date: pastOn,
		startTime: '18:00',
		expectedStartsAt: pastTarget,
	})
	check(
		'move of that occurrence to its natural time gives 200 and a restored row',
		home.status === 200 &&
			home.json?.occurrence?.outcome === 'planned' &&
			exceptionRow(s11, pastOn)?.kind === 'restored',
		`status ${home.status}`
	)
	countRows(ctx)
}

async function moveFutureIntoPast(
	today: string,
	futureOn: string,
	api: Api,
	cookie: string,
	s11: string,
	ctx: ChangeContext,
	blocksOf: (dates: string[], wanted: string) => Promise<ScheduleBlock[]>,
	key: (date: string) => string
) {
	let blocks: ScheduleBlock[]
	const yesterday = core.addDays(today, -1)
	const steps: [string, { date: string; startTime: string }][] = [
		['yesterday 18:00', { date: yesterday, startTime: '18:00' }],
		['today 00:00', { date: today, startTime: '00:00' }],
	]
	const nowParts = core.zonedParts(new Date(), VN)
	if (nowParts.time !== '00:00')
		steps.push(['the current Vietnam time', { date: nowParts.date, startTime: nowParts.time }])
	let expected = instant(futureOn, '18:00')
	for (const [label, target] of steps) {
		const res = await post(api, cookie, occurrencePath(s11, futureOn, 'move'), {
			...target,
			expectedStartsAt: expected,
		})
		const startsAt = instant(target.date, target.startTime)
		check(
			`move of a future occurrence to ${label} gives 200 planned`,
			res.status === 200 && res.json?.occurrence?.outcome === 'planned' && res.json?.occurrence?.startsAt === startsAt,
			`status ${res.status} ${JSON.stringify(res.json?.error ?? '')}`
		)
		countRows(ctx)
		expected = startsAt
	}
	blocks = await blocksOf([futureOn, core.zonedParts(new Date(expected), VN).date], key(futureOn))
	check(
		'the future occurrence stands planned on its last past place',
		blocks.some(
			(block) => block.outcome === 'planned' && block.startsAt === expected && block.actions?.move === true
		) && blocks.some((block) => block.outcome === 'moved' && block.startsAt === instant(futureOn, '18:00')),
		JSON.stringify(blocks.map((block) => [block.outcome, block.startsAt]))
	)
}

async function movePastSingleAndRefusals(
	today: string,
	cardP: string,
	ctx: ChangeContext,
	api: Api,
	cookie: string,
	s11: string,
	cancelledOn: string,
	pastDay: string
) {
	const singleAt = instant(core.addDays(today, -3), '11:00')
	const single = sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(cardP)}, ${quote(singleAt)}, 60, 'scheduled') returning id`
	).rows[0].id
	countRows(ctx)
	const singleRow = () => new Date(sql(`select starts_at from lessons where id = ${quote(single)}`).rows[0].starts_at)
	const earlierAt = instant(core.addDays(today, -3), '10:00')
	await expectStatus(
		'move of a past single lesson one hour earlier',
		() =>
			post(api, cookie, `/lessons/${single}/move`, {
				date: core.addDays(today, -3),
				startTime: '10:00',
				expectedStartsAt: singleAt,
			}),
		200
	)
	check('the past single lesson row moved one hour earlier', singleRow().toISOString() === earlierAt)
	await expectStatus(
		'move of the past single lesson back',
		() =>
			post(api, cookie, `/lessons/${single}/move`, {
				date: core.addDays(today, -3),
				startTime: '11:00',
				expectedStartsAt: earlierAt,
			}),
		200
	)
	check('the past single lesson row is back on its time', singleRow().toISOString() === singleAt)
	countRows(ctx)
	await expectStatus(
		'cancel of a past occurrence',
		() => post(api, cookie, occurrencePath(s11, cancelledOn, 'cancel')),
		200
	)
	countRows(ctx)
	await expectStatus(
		'move of the cancelled occurrence',
		() => post(api, cookie, occurrencePath(s11, cancelledOn, 'move'), { date: pastDay, startTime: '12:00' }),
		409,
		'lesson_changed'
	)
}
