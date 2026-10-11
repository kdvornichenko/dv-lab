import { test as base, expect, type Page } from '@playwright/test'

import type { LessonMarkKind } from '../../packages/contracts/src/schedule.ts'
import { api, readStudent, readStudents, readToday, readWeek, teacherId } from './api.ts'
import {
	cleanupFixtures,
	ownedStudent,
	quote,
	registerFixture,
	reserveFixture,
	restoreTeacherSettings,
	sql,
	type FixtureName,
} from './data.ts'
import { vnToday } from './dates.ts'
import { integer, record, text, uuid } from './input.ts'

function createFixtures(page: Page) {
	const request = page.request
	return {
		async card(name: FixtureName, minutes = 60) {
			reserveFixture(name)
			const response = record(
				await api(request, 'POST', '/students', {
					displayName: name,
					rateMinor: null,
					currency: null,
					defaultLessonMinutes: minutes,
					parent: null,
					level: null,
					goals: null,
					timeZone: null,
				})
			)
			const id = uuid(record(response.student).id)
			registerFixture(name, id)
			return { id, name }
		},
		async opening(id: string, lessonsHundredths: number, on: string) {
			await api(request, 'PUT', `/students/${uuid(id)}/opening-balance`, { lessonsHundredths, on })
		},
		async once(id: string, date: string, startTime: string, durationMinutes = 60) {
			const response = record(
				await api(request, 'POST', '/schedule/lessons', {
					studentId: uuid(id),
					date,
					startTime,
					durationMinutes,
					repeats: 'once',
				})
			)
			return uuid(record(response.lesson).id)
		},
		pastSeries(id: string, date: string, startTime: string) {
			const weekday = new Date(`${date}T00:00:00Z`).getUTCDay() || 7
			return uuid(
				sql(`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on)
values (${quote(ownedStudent(id))}::uuid, ${weekday}, ${quote(startTime)}, 60, ${quote(date)}) returning id`)[0]?.id
			)
		},
		async weekly(id: string, date: string, startTime: string) {
			const response = record(
				await api(request, 'POST', '/schedule/lessons', {
					studentId: uuid(id),
					date,
					startTime,
					durationMinutes: 60,
					repeats: 'weekly',
				})
			)
			return uuid(record(response.series).id)
		},
		async mark(id: string, kind: LessonMarkKind) {
			await api(request, 'POST', `/schedule/lessons/${uuid(id)}/mark`, { kind })
		},
		async moveOccurrence(seriesId: string, originalOn: string, date: string, startTime: string) {
			await api(request, 'POST', `/schedule/series/${uuid(seriesId)}/occurrences/${originalOn}/move`, {
				date,
				startTime,
			})
		},
		async markOccurrence(seriesId: string, originalOn: string, kind: LessonMarkKind) {
			await api(request, 'POST', `/schedule/series/${uuid(seriesId)}/occurrences/${originalOn}/mark`, { kind })
		},
		student: (id: string) => readStudent(request, id),
		students: () => readStudents(request),
		today: () => readToday(request),
		week: (start: string) => readWeek(request, start),
		seriesRows(id: string) {
			return sql(`select id, starts_on::text, ends_on::text, weekday,
to_char(start_time, 'HH24:MI') as start_time, updated_at::text
from lesson_series where student_id = ${quote(ownedStudent(id))}::uuid order by id`).map((row) => ({
				id: uuid(row.id),
				startsOn: text(row.starts_on),
				endsOn: row.ends_on === null ? null : text(row.ends_on),
				weekday: integer(row.weekday),
				startTime: text(row.start_time),
				updatedAt: text(row.updated_at),
			}))
		},
		scheduleCounts(id: string) {
			const student = quote(ownedStudent(id))
			const series = `select id from lesson_series where student_id = ${student}::uuid`
			const lessons = `select id from lessons where student_id = ${student}::uuid`
			const row = sql(`select
(select count(*)::int from lesson_series where student_id = ${student}::uuid) as series,
(select count(*)::int from lessons where student_id = ${student}::uuid) as lessons,
(select count(*)::int from lesson_exceptions where series_id in (${series})) as exceptions,
(select count(*)::int from lesson_marks where series_id in (${series}) or lesson_id in (${lessons})) as marks`)[0]
			return {
				series: integer(row?.series),
				lessons: integer(row?.lessons),
				exceptions: integer(row?.exceptions),
				marks: integer(row?.marks),
			}
		},
		occurrenceState(id: string, seriesId: string, originalOn: string) {
			const row = sql(`select e.kind as exception, m.id as mark_id, m.kind as mark
from lesson_marks m join lesson_series s on s.id = m.series_id
left join lesson_exceptions e on e.series_id = m.series_id and e.original_on = m.original_on
where m.series_id = ${quote(uuid(seriesId))}::uuid and m.original_on = ${quote(originalOn)}
and s.student_id = ${quote(ownedStudent(id))}::uuid`)[0]
			return {
				exception: row?.exception === null ? null : text(row?.exception),
				markId: uuid(row?.mark_id),
				mark: text(row?.mark),
			}
		},
		markCount(id: string) {
			const student = quote(ownedStudent(id))
			return integer(
				sql(`select count(*)::int as n from lesson_marks
where lesson_id in (select id from lessons where student_id = ${student}::uuid)
or series_id in (select id from lesson_series where student_id = ${student}::uuid)`)[0]?.n
			)
		},
		markKind(id: string) {
			return text(sql(`select kind from lesson_marks where lesson_id = ${quote(uuid(id))}::uuid`)[0]?.kind)
		},
	}
}

export type Fx = ReturnType<typeof createFixtures>
export type Card = Awaited<ReturnType<Fx['card']>>

export const test = base.extend<{ fx: Fx }>({
	page: async ({ page }, use, testInfo) => {
		const theme = testInfo.project.name
		await page.addInitScript((value: string) => localStorage.setItem('theme', value), theme)
		await use(page)
	},
	fx: async ({ page }, use) => {
		const day = vnToday()
		cleanupFixtures()
		const id = await teacherId(page.request)
		try {
			await use(createFixtures(page))
		} finally {
			try {
				restoreTeacherSettings(id, true)
			} finally {
				cleanupFixtures()
			}
			if (vnToday() !== day) throw new Error('Vietnam day changed during the journey; rerun after 00:10 VN')
		}
	},
})

export { expect }
