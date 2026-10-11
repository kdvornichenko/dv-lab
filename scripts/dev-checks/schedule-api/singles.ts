import { randomUUID } from 'node:crypto'

import * as core from '../../../packages/core/src/index.ts'
import {
	VN,
	check,
	countRows,
	createLesson,
	exceptionRow,
	expectStatus,
	instant,
	occurrencePath,
	post,
	raced,
	weekBlocks,
} from './context.ts'
import { quote, sql } from './io.ts'
import type { Api, ChangeContext, ScheduleBlock } from './types.ts'

export async function partSingle(ctx: ChangeContext) {
	const { api, cookie, lessonPath, l1, nextThursday, thursday, lessonBlocks, pastAt, l2, pastLessonBlock, dW, s1 } =
		await createSingleChangeFixtures(ctx)
	await moveSingleToNextWeek(api, cookie, lessonPath, l1, nextThursday, thursday, ctx, lessonBlocks)
	await cancelRestoreSingle(api, cookie, lessonPath, l1, ctx, lessonBlocks, nextThursday)
	await raceAndRefuseSingle(api, cookie, lessonPath, l1, thursday, ctx, nextThursday)
	await changePastSingle(pastAt, api, cookie, lessonPath, l2, pastLessonBlock, ctx, nextThursday)
	await raceSeriesCancellation(dW, api, cookie, s1, ctx)
	return 'SINGLE_OK'
}

async function createSingleChangeFixtures(ctx: ChangeContext) {
	const { api, cookie, s1, dW, today, studentId } = ctx
	const lessonPath = (id: string, action: string) => `/lessons/${id}/${action}`
	const thursday = core.addDays(dW, 1)
	const nextThursday = core.addDays(dW, 8)
	const created = await createLesson(api, cookie, {
		studentId,
		date: thursday,
		startTime: '09:00',
		durationMinutes: 45,
		repeats: 'once',
	})
	if (created.status !== 201) throw new Error(`single lesson create returned ${created.status}`)
	const l1 = created.json.lesson.id
	const pastAt = new Date(Math.floor((Date.now() - 2 * 86400000) / 60000) * 60000).toISOString()
	const l2 = sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(pastAt)}, 60, 'scheduled') returning id`
	).rows[0].id
	countRows(ctx)
	const lessonBlocks = async (date: string) =>
		(await weekBlocks(api, cookie, core.mondayOf(date))).filter((block) => block.key === `l:${l1}`)
	const pastLessonBlock = async () =>
		(await weekBlocks(api, cookie, core.mondayOf(core.zonedParts(new Date(pastAt), VN).date))).find(
			(block) => block.key === `l:${l2}`
		)
	return { api, cookie, lessonPath, l1, nextThursday, thursday, lessonBlocks, pastAt, l2, pastLessonBlock, dW, s1 }
}

async function moveSingleToNextWeek(
	api: Api,
	cookie: string,
	lessonPath: Awaited<ReturnType<typeof createSingleChangeFixtures>>['lessonPath'],
	l1: string,
	nextThursday: string,
	thursday: string,
	ctx: ChangeContext,
	lessonBlocks: Awaited<ReturnType<typeof createSingleChangeFixtures>>['lessonBlocks']
) {
	const moved = await post(api, cookie, lessonPath(l1, 'move'), {
		date: nextThursday,
		startTime: '14:00',
		expectedStartsAt: instant(thursday, '09:00'),
	})
	check(
		'move L1 to next Thursday 14:00 gives 200',
		moved.status === 200 &&
			moved.json?.lesson?.startsAt === instant(nextThursday, '14:00') &&
			moved.json?.lesson?.durationMinutes === 45,
		`status ${moved.status}`
	)
	countRows(ctx)
	const oldWeek = await lessonBlocks(thursday)
	const newWeek = await lessonBlocks(nextThursday)
	check(
		'L1 shows only on its new place',
		oldWeek.length === 0 &&
			newWeek.length === 1 &&
			newWeek[0].startsAt === instant(nextThursday, '14:00') &&
			newWeek[0].outcome === 'planned'
	)
}

async function cancelRestoreSingle(
	api: Api,
	cookie: string,
	lessonPath: Awaited<ReturnType<typeof createSingleChangeFixtures>>['lessonPath'],
	l1: string,
	ctx: ChangeContext,
	lessonBlocks: Awaited<ReturnType<typeof createSingleChangeFixtures>>['lessonBlocks'],
	nextThursday: string
) {
	const cancelled = await post(api, cookie, lessonPath(l1, 'cancel'))
	check(
		'cancel L1 gives 200 cancelled',
		cancelled.status === 200 && cancelled.json?.lesson?.status === 'cancelled',
		`status ${cancelled.status}`
	)
	countRows(ctx)
	check('week shows L1 cancelled', (await lessonBlocks(nextThursday))[0]?.outcome === 'cancelled')
	const restored = await post(api, cookie, lessonPath(l1, 'restore'), {
		expectedStartsAt: instant(nextThursday, '14:00'),
	})
	check(
		'restore L1 gives 200 scheduled',
		restored.status === 200 && restored.json?.lesson?.status === 'scheduled',
		`status ${restored.status}`
	)
	countRows(ctx)
	check('week shows L1 scheduled', (await lessonBlocks(nextThursday))[0]?.outcome === 'planned')
}

async function raceAndRefuseSingle(
	api: Api,
	cookie: string,
	lessonPath: Awaited<ReturnType<typeof createSingleChangeFixtures>>['lessonPath'],
	l1: string,
	thursday: string,
	ctx: ChangeContext,
	nextThursday: string
) {
	await expectStatus(
		'cancel L1 with a stale expectedStartsAt',
		() => post(api, cookie, lessonPath(l1, 'cancel'), { expectedStartsAt: instant(thursday, '09:00') }),
		409
	)
	const lessonRace = await raced(() => post(api, cookie, lessonPath(l1, 'cancel')))
	check('two parallel cancels of L1 give one 200 and one 409', lessonRace.join() === '200,409', lessonRace.join())
	countRows(ctx)
	await expectStatus(
		'move of the cancelled L1',
		() => post(api, cookie, lessonPath(l1, 'move'), { date: nextThursday, startTime: '15:00' }),
		409
	)
}

async function changePastSingle(
	pastAt: string,
	api: Api,
	cookie: string,
	lessonPath: Awaited<ReturnType<typeof createSingleChangeFixtures>>['lessonPath'],
	l2: string,
	pastLessonBlock: Awaited<ReturnType<typeof createSingleChangeFixtures>>['pastLessonBlock'],
	ctx: ChangeContext,
	nextThursday: string
) {
	const earlier = new Date(new Date(pastAt).getTime() - 3600000).toISOString()
	const wall = (iso: string) => {
		const parts = core.zonedParts(new Date(iso), VN)
		return { date: parts.date, startTime: parts.time }
	}
	await expectStatus(
		'move of the past L2 one hour earlier',
		() => post(api, cookie, lessonPath(l2, 'move'), { ...wall(earlier), expectedStartsAt: pastAt }),
		200
	)
	const earlierRow = sql(`select starts_at from lessons where id = ${quote(l2)}`).rows[0]
	check('past L2 row moved one hour earlier', new Date(earlierRow?.starts_at).toISOString() === earlier)
	await expectStatus(
		'move of the past L2 back',
		() => post(api, cookie, lessonPath(l2, 'move'), { ...wall(pastAt), expectedStartsAt: earlier }),
		200
	)
	await expectStatus('cancel of the past L2', () => post(api, cookie, lessonPath(l2, 'cancel')), 200)
	check('week shows the past L2 cancelled', (await pastLessonBlock())?.outcome === 'cancelled')
	await expectStatus('restore of the past L2', () => post(api, cookie, lessonPath(l2, 'restore')), 200)
	check('week shows the past L2 planned again', (await pastLessonBlock())?.outcome === 'planned')
	countRows(ctx)
	await expectStatus(
		'move of an unknown lesson',
		() => post(api, cookie, lessonPath(randomUUID(), 'move'), { date: nextThursday, startTime: '16:00' }),
		404
	)
	await expectStatus('restore of an unknown lesson', () => post(api, cookie, lessonPath(randomUUID(), 'restore')), 404)
	await expectStatus('cancel of lesson id abc', () => post(api, cookie, lessonPath('abc', 'cancel')), 404)
	const pastRow = sql(`select starts_at, status from lessons where id = ${quote(l2)}`).rows[0]
	check(
		'past L2 row is unchanged',
		pastRow?.status === 'scheduled' && new Date(pastRow.starts_at).toISOString() === pastAt
	)
}

async function raceSeriesCancellation(dW: string, api: Api, cookie: string, s1: string, ctx: ChangeContext) {
	const dW35 = core.addDays(dW, 35)
	const occurrenceRace = await raced(() => post(api, cookie, occurrencePath(s1, dW35, 'cancel')))
	check(
		'two parallel cancels of S1 dW+35 give one 200 and one 409',
		occurrenceRace.join() === '200,409',
		occurrenceRace.join()
	)
	countRows(ctx)
	check('S1 dW+35 exception row is cancelled', exceptionRow(s1, dW35)?.kind === 'cancelled')
}
