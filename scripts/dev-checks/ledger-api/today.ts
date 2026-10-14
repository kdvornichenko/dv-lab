import * as core from '../../../packages/core/src/index.ts'
import { TEACHER_LOGIN, call, quote, sql, studentCookie } from '../schedule-api/io.ts'
import {
	VN,
	check,
	createCard,
	getToday,
	insertLesson,
	insertSeries,
	instant,
	markSingle,
	onceLesson,
	post,
	sameActions,
	setOpening,
	startedToday,
	stepOk,
} from './context.ts'
import type { Context, Reply, TodayPayload, ScheduleBlock, StudentRow } from './types.ts'

export function removeTeacherSettings() {
	sql(
		`delete from teacher_settings where account_id in (select id from accounts where login = ${quote(TEACHER_LOGIN)} and role = 'teacher')`
	)
}

export function soonToday(ctx: Context) {
	const end = core.zonedInstant(core.addDays(ctx.today, 1), '00:00', VN).getTime() - 60000
	const inTwoHours = Math.floor((Date.now() + 7200000) / 1000) * 1000
	return new Date(Math.min(end, inTwoHours)).toISOString()
}

export async function todayCards(ctx: Context, names: Record<string, string>) {
	const ids: Record<string, string> = {}
	for (const [key, name] of Object.entries(names)) ids[key] = await createCard(ctx, name)
	return ids
}

export const blockKeys = (blocks: ScheduleBlock[]) => new Set(blocks.map((block) => block.key))

export const fixtureOrder = (rows: StudentRow[], ids: Record<string, string>) => {
	const own = new Map(Object.entries(ids).map(([key, id]) => [id, key]))
	return rows.flatMap((row) => (own.has(row.id) ? [own.get(row.id)] : [])).join(',')
}

export async function todayFixtures(ctx: Context) {
	const opening = core.addDays(ctx.today, -3)
	const yesterday = core.addDays(ctx.today, -1)
	const tomorrow = core.addDays(ctx.today, 1)
	const card = await todayCards(ctx, {
		P: 'Alex Example 2122',
		Q: 'Alex Example 2123',
		R: 'Alex Example 2124',
		S: 'Alex Example 2125',
		T: 'Alex Example 2126',
		U: 'Alex Example 2127',
		A: 'Alex Example 2128',
		O: 'Alex Example 2129',
	})
	await setOpening(ctx, card.P, 200, opening)
	await setOpening(ctx, card.Q, 1000, opening)
	await setOpening(ctx, card.S, 0, opening)
	await setOpening(ctx, card.T, 0, opening)
	await setOpening(ctx, card.U, 0, opening)
	await setOpening(ctx, card.O, 1000, core.addDays(ctx.today, -2))
	const pDone = onceLesson(card.P, core.addDays(opening, 1), '10:00')
	await stepOk('done of the P lesson', () => markSingle(ctx, pDone, 'done'))
	const sDone = onceLesson(card.S, core.addDays(opening, 1), '11:00')
	await stepOk('done of the S lesson', () => markSingle(ctx, sDone, 'done'))
	await stepOk('archive of T', () =>
		call(ctx.api, 'POST', `/students/${card.T}/archive`, { cookie: ctx.cookie, body: {} })
	)

	const started = insertLesson(card.Q, startedToday(ctx))
	const upcoming = insertLesson(card.Q, soonToday(ctx))
	const qSeries = insertSeries(card.Q, core.weekdayOf(yesterday), '10:00', core.addDays(yesterday, -14))
	const marked = onceLesson(card.Q, yesterday, '08:00')
	await stepOk('done of the yesterday lesson', () => markSingle(ctx, marked, 'done'))
	const cancelled = onceLesson(card.Q, yesterday, '12:00')
	await stepOk('cancel of the yesterday lesson', () => post(ctx, `/lessons/${cancelled}/cancel`))

	const rSeries = insertSeries(card.R, core.weekdayOf(ctx.today), '12:00', core.addDays(ctx.today, -14))
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(rSeries)}, ${quote(ctx.today)}, 'moved', ${quote(instant(tomorrow, '10:00'))}, 60)`
	)

	const archivedLesson = onceLesson(card.A, yesterday, '14:00')
	await stepOk('archive of the card with a lesson', () =>
		call(ctx.api, 'POST', `/students/${card.A}/archive`, { cookie: ctx.cookie, body: {} })
	)
	const openingDayLesson = onceLesson(card.O, core.addDays(ctx.today, -2), '15:00')
	const afterOpeningLesson = onceLesson(card.O, yesterday, '15:00')
	return {
		card,
		yesterday,
		keys: {
			started: `l:${started}`,
			upcoming: `l:${upcoming}`,
			qSeries: `s:${qSeries}:${yesterday}`,
			marked: `l:${marked}`,
			cancelled: `l:${cancelled}`,
			ghost: `s:${rSeries}:${ctx.today}`,
			archived: `l:${archivedLesson}`,
			openingDay: `l:${openingDayLesson}`,
			afterOpening: `l:${afterOpeningLesson}`,
		},
		seriesIds: [qSeries, rSeries],
	}
}

export function todayChecks(
	ctx: Context,
	res: Reply<TodayPayload>,
	fixtures: Awaited<ReturnType<typeof todayFixtures>>
) {
	const { keys, card, seriesIds } = fixtures
	const body = res.json ?? {}
	const lessons = body.lessons ?? []
	const earlier = body.earlier ?? []
	check('GET /today gives 200', res.status === 200, `status ${res.status}`)
	check('date is today in Vietnam', body.date === ctx.today, `${body.date}`)
	check('paysSoonLessons is 2 without a settings row', body.paysSoonLessons === 2, `${body.paysSoonLessons}`)
	inspectTodayLessons(lessons, keys)
	inspectEarlierLessons(earlier, keys, ctx)
	inspectTodaySeriesAndBalances(body, seriesIds, card)
}

function inspectTodayLessons(lessons: ScheduleBlock[], keys: Awaited<ReturnType<typeof todayFixtures>>['keys']) {
	const byKey = new Map(lessons.map((block) => [block.key, block]))
	const started = byKey.get(keys.started)
	check(
		'started unmarked lesson today is planned and can be marked',
		started?.outcome === 'planned' && started?.actions?.mark === true,
		JSON.stringify([started?.outcome, started?.actions])
	)
	const upcoming = byKey.get(keys.upcoming)
	check(
		'upcoming lesson today cannot be marked yet',
		upcoming?.outcome === 'planned' && upcoming?.actions?.mark === false,
		JSON.stringify([upcoming?.outcome, upcoming?.actions])
	)
	const ghost = byKey.get(keys.ghost)
	check(
		'occurrence moved from today to tomorrow is a ghost without actions',
		ghost?.outcome === 'moved' &&
			sameActions(ghost?.actions, { move: false, cancel: false, restore: false, mark: false, series: false }),
		JSON.stringify([ghost?.outcome, ghost?.actions])
	)
}

function inspectEarlierLessons(
	earlier: ScheduleBlock[],
	keys: Awaited<ReturnType<typeof todayFixtures>>['keys'],
	ctx: Context
) {
	const earlierKeys = blockKeys(earlier)
	check('yesterday unmarked series occurrence is in earlier', earlierKeys.has(keys.qSeries))
	check('yesterday marked lesson is not in earlier', !earlierKeys.has(keys.marked))
	check('yesterday cancelled lesson is not in earlier', !earlierKeys.has(keys.cancelled))
	check('lesson of an archived card is not in earlier', !earlierKeys.has(keys.archived))
	check('lesson on the opening day is not in earlier', !earlierKeys.has(keys.openingDay))
	check('lesson the day after the opening day is in earlier', earlierKeys.has(keys.afterOpening))
	const dayStart = core.zonedInstant(ctx.today, '00:00', VN).getTime()
	const times = earlier.map((block) => new Date(block.startsAt).getTime())
	check(
		'earlier is before today and oldest first',
		times.every((time, index) => time < dayStart && (index === 0 || times[index - 1] <= time))
	)
	check(
		'earlier has no ghosts and no marked or cancelled lessons',
		earlier.every((block) => block.outcome === 'planned')
	)
}

function inspectTodaySeriesAndBalances(body: TodayPayload, seriesIds: string[], card: Record<string, string>) {
	const shownSeries = new Set((body.series ?? []).map((series) => series.id))
	check(
		'series of the shown lessons are in the answer',
		seriesIds.every((id) => shownSeries.has(id))
	)
	check('series have no duplicates', shownSeries.size === (body.series ?? []).length)
	const order = fixtureOrder(body.paysSoon ?? [], card)
	check('paysSoon among the fixtures is S, U, P', order === 'S,U,P', order)
}

export async function sectionToday(ctx: Context) {
	removeTeacherSettings()
	try {
		const fixtures = await todayFixtures(ctx)
		todayChecks(ctx, await getToday(ctx), fixtures)
		const saved = await call(ctx.api, 'PATCH', '/settings', { cookie: ctx.cookie, body: { paysSoonLessons: 0 } })
		check('PATCH /settings 0 gives 200', saved.status === 200, `status ${saved.status}`)
		const zero = await getToday(ctx)
		check('paysSoonLessons is 0 after the save', zero.json?.paysSoonLessons === 0)
		const order = fixtureOrder(zero.json?.paysSoon ?? [], fixtures.card)
		check('paysSoon among the fixtures with N = 0 is S, U', order === 'S,U', order)
		const student = await studentCookie(ctx.api)
		const denied = await getToday(ctx, student)
		check('GET /today as a student gives 403', denied.status === 403, `status ${denied.status}`)
		const anonymous = await call(ctx.api, 'GET', '/today')
		check('GET /today without a session gives 401', anonymous.status === 401, `status ${anonymous.status}`)
		check('GET /today is not cached', (zero.headers.get('cache-control') ?? '').includes('no-store'))
	} finally {
		removeTeacherSettings()
	}
	return 'SCHEDULE_LEDGER_TODAY_OK'
}
