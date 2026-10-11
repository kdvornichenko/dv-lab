import * as core from '../../../packages/core/src/index.ts'
import { FIXTURE_NAME, VN, check, createCard, createLesson, firstAfter, instant, readWeek, todayVn } from './context.ts'
import { call, quote, sql } from './io.ts'
import type { Api, ScheduleBlock } from './types.ts'

export async function sectionNext(api: Api, cookie: string, ids: string[]) {
	const withLessons = await createCard(api, cookie, ids, `${FIXTURE_NAME} B`)
	const withoutLessons = await createCard(api, cookie, ids, `${FIXTURE_NAME} C`)
	const today = todayVn()
	const wednesday = firstAfter(today, 3)
	const tuesday = firstAfter(today, 2)
	const weekly = await createLesson(api, cookie, {
		studentId: withLessons,
		date: wednesday,
		startTime: '18:00',
		durationMinutes: 60,
		repeats: 'weekly',
	})
	if (weekly.status !== 201) throw new Error(`series create returned ${weekly.status}`)
	const seriesId = weekly.json.series.id
	const movedTo = instant(tuesday, '10:00')
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(wednesday)}, 'moved', ${quote(movedTo)}, 60)`
	)
	const mondayNoon = core.zonedInstant(core.addDays(tuesday, -1), '12:00', VN)
	const cancelledAt = mondayNoon.getTime() > Date.now() ? mondayNoon.toISOString() : instant(tuesday, '08:00')
	sql(
		`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(withLessons)}, ${quote(cancelledAt)}, 60, 'cancelled')`
	)
	console.log(`series ${seriesId} moved from ${wednesday} to ${tuesday} 10:00, cancelled lesson at ${cancelledAt}`)

	const list = await call(api, 'GET', '/students', { cookie })
	const rows = list.json?.students ?? []
	const rowB = rows.find((row) => row.id === withLessons)
	const rowC = rows.find((row) => row.id === withoutLessons)
	check(
		'list gives the moved Tuesday 10:00 as next lesson for the card with lessons',
		list.status === 200 && rowB?.nextLessonAt === movedTo,
		`got ${rowB?.nextLessonAt}`
	)
	check(
		'list gives null next lesson for the card without lessons',
		rowC !== undefined && rowC.nextLessonAt === null,
		`got ${rowC?.nextLessonAt}`
	)
	check(
		'every list row carries nextLessonAt',
		rows.length > 0 && rows.every((row) => row.nextLessonAt === null || typeof row.nextLessonAt === 'string')
	)

	const detail = await call(api, 'GET', `/students/${withLessons}`, { cookie })
	check(
		'card detail gives the same next lesson',
		detail.status === 200 && detail.json?.student?.nextLessonAt === movedTo,
		`got ${detail.json?.student?.nextLessonAt}`
	)

	const now = Date.now()
	const thisMonday = core.mondayOf(today)
	const blocks: ScheduleBlock[] = []
	for (const monday of [thisMonday, core.addDays(thisMonday, 7)]) {
		const res = await readWeek(api, cookie, monday)
		if (res.status !== 200) throw new Error(`week ${monday} returned ${res.status}`)
		blocks.push(...res.json.blocks.filter((block) => block.studentId === withLessons))
	}
	const future = blocks
		.filter((block) => block.outcome === 'planned' && new Date(block.startsAt).getTime() >= now)
		.map((block) => block.startsAt)
		.sort()
	check(
		'earliest future scheduled week block equals nextLessonAt',
		future[0] === movedTo && future[0] === rowB?.nextLessonAt,
		`earliest ${future[0]}`
	)
	check(
		'week shows the cancelled lesson and the moved ghost but neither is next',
		blocks.some((block) => block.outcome === 'cancelled' && block.startsAt === cancelledAt) &&
			blocks.some((block) => block.outcome === 'moved' && block.movedTo === movedTo)
	)

	return 'SCHEDULE_API_NEXT_OK'
}
