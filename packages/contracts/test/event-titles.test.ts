import { describe, expect, test } from 'vitest'

import { EVENT_TITLES_MAX_DAYS, eventTitlesQuery, eventTitlesResponse, rangeDays } from '../src/calendar.ts'

describe('eventTitlesQuery', () => {
	test('accepts a summer range', () => {
		expect(eventTitlesQuery.safeParse({ from: '2026-06-01', to: '2026-08-31' }).success).toBe(true)
		expect(rangeDays('2026-06-01', '2026-08-31')).toBe(92)
	})

	test('accepts a single day and the longest range', () => {
		expect(eventTitlesQuery.safeParse({ from: '2026-06-01', to: '2026-06-01' }).success).toBe(true)
		expect(rangeDays('2026-01-01', '2027-02-04')).toBe(EVENT_TITLES_MAX_DAYS)
		expect(eventTitlesQuery.safeParse({ from: '2026-01-01', to: '2027-02-04' }).success).toBe(true)
	})

	test('rejects reversed, too long and malformed ranges', () => {
		expect(eventTitlesQuery.safeParse({ from: '2026-08-31', to: '2026-06-01' }).success).toBe(false)
		expect(eventTitlesQuery.safeParse({ from: '2026-01-01', to: '2027-02-05' }).success).toBe(false)
		expect(eventTitlesQuery.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(false)
		expect(eventTitlesQuery.safeParse({ from: '2026-06-01' }).success).toBe(false)
		expect(eventTitlesQuery.safeParse({ from: '2026-06-01', to: '2026-06-02', extra: 1 }).success).toBe(false)
	})
})

describe('eventTitlesResponse', () => {
	test('keeps only titles and days', () => {
		const body = {
			timeZone: 'Asia/Ho_Chi_Minh',
			events: [
				{ title: 'Екатерина', day: '2026-06-01' },
				{ title: null, day: '2026-06-02' },
			],
		}
		expect(eventTitlesResponse.safeParse(body).success).toBe(true)
		expect(
			eventTitlesResponse.safeParse({ ...body, events: [{ title: 'A', day: '2026-06-01', description: 'x' }] }).success
		).toBe(false)
	})
})
