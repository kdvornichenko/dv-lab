import { expect, type APIRequestContext } from '@playwright/test'

import { nextLessonRead } from '../../packages/contracts/src/calendar.ts'
import { api, readSettings } from './api.ts'
import { cleanupFixtures, registerFixture, reserveFixture, teacherCredentials } from './data.ts'
import { vnToday } from './dates.ts'
import { list, record, uuid } from './input.ts'

function nextForUnboundCard(value: unknown) {
	const row = record(value)
	const parsed = nextLessonRead.safeParse(row.nextLesson)
	if (!parsed.success) throw new Error('Student nextLesson failed schema validation')
	expect(parsed.data.result !== 'known', 'An unbound card has no confirmed next lesson').toBe(true)
	expect(row.nextLessonAt === null && parsed.data.startsAt === null, 'Legacy next time is not used').toBe(true)
	return uuid(row.id)
}

export async function calendarNextCards(request: APIRequestContext) {
	await api(request, 'POST', '/auth/sign-in', teacherCredentials())
	cleanupFixtures()
	const displayName = 'Alex Example 2188'
	reserveFixture(displayName)
	try {
		const created = record(
			await api(request, 'POST', '/students', {
				displayName,
				rateMinor: null,
				currency: null,
				defaultLessonMinutes: 60,
				parent: null,
				level: null,
				goals: null,
				timeZone: null,
			})
		)
		const id = uuid(record(created.student).id)
		registerFixture(displayName, id)
		nextForUnboundCard(created.student)
		const listed = record(await api(request, 'GET', '/students'))
		const own = list(listed.students)
			.map(record)
			.find((row) => row.id === id)
		if (!own) throw new Error('Created synthetic card is absent from list')
		nextForUnboundCard(own)
		const { defaultTimeZone } = await readSettings(request)
		for (const [method, path, input] of [
			['GET', `/students/${id}`, undefined],
			[
				'PATCH',
				`/students/${id}`,
				{
					displayName,
					rateMinor: null,
					currency: null,
					defaultLessonMinutes: 45,
					parent: null,
					level: null,
					goals: null,
					timeZone: null,
				},
			],
			['POST', `/students/${id}/archive`, {}],
			['POST', `/students/${id}/restore`, {}],
			[
				'PUT',
				`/students/${id}/opening-balance`,
				{ lessonsHundredths: 200, on: vnToday(), expectedDefaultTimeZone: defaultTimeZone },
			],
		] as const) {
			const response = record(await api(request, method, path, input))
			expect(nextForUnboundCard(response.student) === id, 'Mutation preserves the synthetic card identity').toBe(true)
		}
	} finally {
		cleanupFixtures()
		await api(request, 'POST', '/auth/sign-out', undefined, 204)
	}
}
