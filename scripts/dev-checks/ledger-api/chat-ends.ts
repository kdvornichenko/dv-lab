import * as core from '../../../packages/core/src/index.ts'
import { call, quote, sql } from '../schedule-api/io.ts'
import { check, createCard, onceLesson, setOpening } from './context.ts'
import type { Context } from './types.ts'

async function balanceEnds(ctx: Context, studentId: string) {
	const reply = await call(ctx.api, 'GET', `/chat/records?studentId=${studentId}`, { cookie: ctx.cookie })
	return { status: reply.status, ends: reply.json?.balanceEnds }
}

export async function sectionChatEnds(ctx: Context) {
	const opening = core.addDays(ctx.today, -3)
	const studentId = await createCard(ctx, 'Alex Example 2130')
	await setOpening(ctx, studentId, 500, opening)
	const lengths = [60, 90, 60, 60, 90, 60]
	const lessons = lengths.map((minutes, index) =>
		onceLesson(studentId, core.addDays(ctx.today, index + 1), '10:00', minutes)
	)
	const all = await balanceEnds(ctx, studentId)
	check(
		'balance of 300 minutes ends on the fifth lesson (60 + 90 + 60 + 60 + 90)',
		all.status === 200 && all.ends?.state === 'on' && all.ends.date === core.addDays(ctx.today, 5),
		JSON.stringify(all)
	)
	sql(`update lessons set status = 'cancelled' where id = ${quote(lessons[1])}`)
	const cancelled = await balanceEnds(ctx, studentId)
	check(
		'cancelling the 90 minute lesson moves the end to the sixth lesson',
		cancelled.ends?.state === 'on' && cancelled.ends.date === core.addDays(ctx.today, 6),
		JSON.stringify(cancelled)
	)
	const opened = await createCard(ctx, 'Alex Example 2133')
	await setOpening(ctx, opened, 200, ctx.today)
	for (const offset of [0, 1, 2]) onceLesson(opened, core.addDays(ctx.today, offset), '10:00')
	const sameDay = await balanceEnds(ctx, opened)
	check(
		'a lesson on the opening day does not count: 120 minutes end on the second lesson after it',
		sameDay.ends?.state === 'on' && sameDay.ends.date === core.addDays(ctx.today, 2),
		JSON.stringify(sameDay)
	)
	const empty = await createCard(ctx, 'Alex Example 2131')
	await setOpening(ctx, empty, 0, opening)
	const none = await balanceEnds(ctx, empty)
	check('zero balance gives now', none.ends?.state === 'now', JSON.stringify(none))
	const rich = await createCard(ctx, 'Alex Example 2132')
	await setOpening(ctx, rich, 100000, opening)
	onceLesson(rich, core.addDays(ctx.today, 1), '10:00')
	const far = await balanceEnds(ctx, rich)
	check('a balance beyond the schedule gives beyond', far.ends?.state === 'beyond', JSON.stringify(far))
	return 'CHAT_BALANCE_ENDS_OK'
}
