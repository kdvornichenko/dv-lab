import { z } from 'zod'

import type { EventTitleItem, EventTitlesQuery, EventTitlesResponse } from '@dv-lab/contracts'
import { addDays, lessonDay, startOfLessonDay, zonedParts } from '@dv-lab/core'
import type { Database } from '@dv-lab/db'

import { readTeacherSettings } from '../settings/settings.ts'
import { CalendarFault, type GoogleGateway } from './gateway.ts'
import type { Credentials } from './google-access.ts'

const TITLES_PAGE_LIMIT = 100
const TITLES_BUDGET_MS = 60000
const TITLE_LIMIT = 1024

const titleTime = z.object({
	date: z.iso.date().nullish(),
	dateTime: z.iso.datetime({ offset: true }).nullish(),
})
const titleItem = z.object({
	status: z.string().nullish(),
	summary: z.string().nullish(),
	start: titleTime.nullish(),
	end: titleTime.nullish(),
})
const titlePage = z.object({
	items: z.array(z.unknown()).optional(),
	nextPageToken: z.string().min(1).max(32768).optional(),
})

export type TitlePage = { events: EventTitleItem[]; nextPageToken?: string }

function timing(start: string | null | undefined, end: string | null | undefined, zone: string) {
	if (!start) return {}
	const startsAt = new Date(start)
	const time = zonedParts(startsAt, zone).time
	const length = end ? new Date(end).getTime() - startsAt.getTime() : Number.NaN
	return length >= 0 ? { time, durationMinutes: Math.round(length / 60000) } : { time }
}

export function parseTitlePage(input: unknown, zone: string, range: EventTitlesQuery): TitlePage {
	const page = titlePage.safeParse(input)
	if (!page.success) throw new CalendarFault('invalid_provider_data')
	const events: EventTitleItem[] = []
	for (const raw of page.data.items ?? []) {
		const item = titleItem.safeParse(raw)
		if (!item.success || item.data.status === 'cancelled') continue
		const start = item.data.start
		const day = start?.dateTime ? lessonDay(new Date(start.dateTime), zone) : (start?.date ?? null)
		if (day === null || day < range.from || day > range.to) continue
		const title = item.data.summary ? [...item.data.summary].slice(0, TITLE_LIMIT).join('') : null
		events.push({ title, day, ...timing(start?.dateTime, item.data.end?.dateTime, zone) })
	}
	return { events, nextPageToken: page.data.nextPageToken }
}

export type EventTitles = (accountId: string, range: EventTitlesQuery) => Promise<EventTitlesResponse>

export function createEventTitles(deps: {
	db: Database
	credentials: Pick<Credentials, 'accessToken' | 'evict'>
	source: Pick<GoogleGateway, 'eventTitles'>
}): EventTitles {
	return async (accountId, range) => {
		const { defaultTimeZone: timeZone } = await readTeacherSettings(deps.db, accountId)
		const signal = AbortSignal.timeout(TITLES_BUDGET_MS)
		const access = await deps.credentials.accessToken(accountId, signal)
		const calendarId = access.connection.calendarId
		if (!calendarId) throw new CalendarFault('connection_required')
		const query = {
			calendarId,
			timeMin: startOfLessonDay(range.from, timeZone).toISOString(),
			timeMax: startOfLessonDay(addDays(range.to, 1), timeZone).toISOString(),
		}
		const events: EventTitleItem[] = []
		const seen = new Set<string>()
		let pageToken: string | undefined
		try {
			for (;;) {
				signal.throwIfAborted()
				const page = parseTitlePage(
					await deps.source.eventTitles(access.accessToken, { ...query, pageToken }, access.signal),
					timeZone,
					range
				)
				events.push(...page.events)
				if (!page.nextPageToken) return { timeZone, events }
				if (seen.has(page.nextPageToken) || seen.size >= TITLES_PAGE_LIMIT)
					throw new CalendarFault('invalid_provider_data')
				seen.add(page.nextPageToken)
				pageToken = page.nextPageToken
			}
		} catch (error) {
			if (error instanceof CalendarFault && error.code === 'reconnect_required') deps.credentials.evict(accountId)
			throw error instanceof CalendarFault ? error : new CalendarFault('provider_unavailable')
		}
	}
}
