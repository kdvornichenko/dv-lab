import { createHash } from 'node:crypto'

import type { googleEventMappings } from '@dv-lab/db'

export type CalendarReadContext = { accountId: string; now: Date }
export type CalendarReadSelection =
	{ kind: 'window'; start: Date; end: Date; displayTimeZone: string } | { kind: 'next'; studentIds: readonly string[] }
export type WindowSelection = Extract<CalendarReadSelection, { kind: 'window' }>
export type MappingRow = typeof googleEventMappings.$inferSelect

export function opaqueVersion(parts: readonly (string | number | bigint | null)[]): string {
	return createHash('sha256').update(parts.map(String).join('\0')).digest('hex')
}

export function eventVersion(event: { eventId: string; etag: string }): string {
	return opaqueVersion([event.eventId, event.etag])
}
