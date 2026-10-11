import { googleFamilyPage, type GoogleFamilyResource } from '@dv-lab/db'

import { CalendarFault } from './gateway.ts'

export function familyReader(
	read: (token: string, calendarId: string, pageToken: string | undefined, signal: AbortSignal) => Promise<unknown>
) {
	return async (token: string, calendarId: string, masterId: string, signal: AbortSignal) => {
		const events: (GoogleFamilyResource & {
			originalStartTime: NonNullable<GoogleFamilyResource['originalStartTime']>
		})[] = []
		const ids = new Set<string>()
		const pages = new Set<string>()
		let pageToken: string | undefined
		do {
			signal.throwIfAborted()
			const page = googleFamilyPage.parse(await read(token, calendarId, pageToken, signal))
			for (const event of page.items ?? []) {
				if (ids.has(event.id)) throw new CalendarFault('invalid_provider_data')
				ids.add(event.id)
				if (event.recurringEventId !== masterId) continue
				if (!event.originalStartTime) throw new CalendarFault('invalid_provider_data')
				events.push({ ...event, originalStartTime: event.originalStartTime })
			}
			pageToken = page.nextPageToken
			if (pageToken && (pages.has(pageToken) || pages.size >= 1000)) throw new CalendarFault('invalid_provider_data')
			if (pageToken) pages.add(pageToken)
		} while (pageToken)
		return events
	}
}
