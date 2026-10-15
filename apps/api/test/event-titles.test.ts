import { describe, expect, it } from 'vitest'

import { parseTitlePage } from '../src/calendar/event-titles.ts'
import { CalendarFault } from '../src/calendar/gateway.ts'

const ZONE = 'Asia/Ho_Chi_Minh'
const SUMMER = { from: '2026-06-01', to: '2026-08-31' }

describe('parseTitlePage', () => {
	it('keeps titles and lesson days of timed and all-day events', () => {
		const page = parseTitlePage(
			{
				nextPageToken: 'next',
				items: [
					{
						status: 'confirmed',
						summary: 'Екатерина',
						start: { dateTime: '2026-06-01T10:00:00+07:00' },
						end: { dateTime: '2026-06-01T11:00:00+07:00' },
					},
					{ status: 'tentative', summary: 'Anna', start: { date: '2026-07-15' }, end: { date: '2026-07-16' } },
					{ status: 'confirmed', start: { dateTime: '2026-08-31T12:00:00Z' } },
				],
			},
			ZONE,
			SUMMER
		)
		expect(page).toEqual({
			nextPageToken: 'next',
			events: [
				{ title: 'Екатерина', day: '2026-06-01', time: '10:00', durationMinutes: 60 },
				{ title: 'Anna', day: '2026-07-15' },
				{ title: null, day: '2026-08-31', time: '19:00' },
			],
		})
	})

	it('skips cancelled, unreadable and out-of-range items', () => {
		const page = parseTitlePage(
			{
				items: [
					{ status: 'cancelled', summary: 'Gone', start: { date: '2026-06-02' } },
					{ status: 'confirmed', summary: 'No start' },
					{ status: 'confirmed', summary: 'Bad', start: { dateTime: 'soon' } },
					{ status: 'confirmed', summary: 'Before', start: { dateTime: '2026-05-31T12:00:00+07:00' } },
					{ status: 'confirmed', summary: 'After', start: { date: '2026-09-01' } },
					'noise',
				],
			},
			ZONE,
			SUMMER
		)
		expect(page).toEqual({ events: [], nextPageToken: undefined })
	})

	it('assigns events before the day start to the previous lesson day', () => {
		const page = parseTitlePage(
			{ items: [{ status: 'confirmed', summary: 'Late', start: { dateTime: '2026-06-02T01:00:00+07:00' } }] },
			ZONE,
			SUMMER
		)
		expect(page.events).toEqual([{ title: 'Late', day: '2026-06-01', time: '01:00' }])
	})

	it('refuses a malformed page', () => {
		expect(() => parseTitlePage({ items: 'x' }, ZONE, SUMMER)).toThrow(CalendarFault)
		expect(() => parseTitlePage(null, ZONE, SUMMER)).toThrow(CalendarFault)
	})
})
