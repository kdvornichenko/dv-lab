import type { GoogleSyncPaletteColor } from '@dv-lab/db'

import type { SyncPageQuery } from './gateway-sync.ts'
import type { GoogleGateway } from './gateway.ts'
import type { EventFact } from './projection.ts'
import { parseSyncItem, parseSyncPage, type SyncPage } from './provider-events.ts'
import { classifyRecurrence } from './recurring.ts'

export type SyncRead = { token: string; calendarId: string; calendarTimeZone: string; signal: AbortSignal }
export type SyncEventRead =
	{ kind: 'missing' } | { kind: 'invalid' } | { kind: 'event'; fact: EventFact; recurrence: readonly string[] }

export type SyncSource = {
	page(read: SyncRead, query: SyncPageQuery, pageToken: string | undefined): Promise<SyncPage>
	master(read: SyncRead, eventId: string): Promise<SyncEventRead>
	palette(token: string, signal: AbortSignal): Promise<GoogleSyncPaletteColor[]>
	calendarColor(token: string, calendarId: string, signal: AbortSignal): Promise<string | null>
}

export function syncEventRead(input: unknown, calendarTimeZone: string, readAt = new Date()): SyncEventRead {
	if (input === null) return { kind: 'missing' }
	const item = parseSyncItem(input, calendarTimeZone, readAt)
	return item.kind === 'fact' ? { kind: 'event', fact: item.fact, recurrence: item.recurrence } : { kind: 'invalid' }
}

export function masterFact(
	read: Extract<SyncEventRead, { kind: 'event' }>,
	calendarTimeZone: string
): EventFact | null {
	const { fact, recurrence } = read
	if (fact.recurringEventId || !recurrence.length) return null
	const zone = fact.start?.timeZone ?? calendarTimeZone
	return { ...fact, master: true, recurrence: classifyRecurrence(recurrence, zone) }
}

export function googleSyncSource(gateway: GoogleGateway): SyncSource {
	return {
		async page(read, query, pageToken) {
			const data = await gateway.syncPage(read.token, read.calendarId, query, pageToken, read.signal)
			return parseSyncPage(data, read.calendarTimeZone)
		},
		async master(read, eventId) {
			const data = await gateway.syncEvent(read.token, read.calendarId, eventId, read.signal)
			return syncEventRead(data, read.calendarTimeZone)
		},
		palette(token, signal) {
			return gateway.colors(token, signal)
		},
		calendarColor(token, calendarId, signal) {
			return gateway.calendarColor(token, calendarId, signal)
		},
	}
}
