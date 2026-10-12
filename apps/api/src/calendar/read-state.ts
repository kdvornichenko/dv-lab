import { createHash } from 'node:crypto'

import type { CalendarIssue, CalendarSeriesContext } from '@dv-lab/contracts'
import type { googleEventMappings, googleReadEvents } from '@dv-lab/db'

export type CalendarReadContext = { accountId: string; now: Date }
export type CalendarReadSelection =
	{ kind: 'window'; start: Date; end: Date; displayTimeZone: string } | { kind: 'next'; studentIds: readonly string[] }
export type WindowSelection = Extract<CalendarReadSelection, { kind: 'window' }>
export type MappingRow = typeof googleEventMappings.$inferSelect
export type ReadEventRow = typeof googleReadEvents.$inferSelect
export type ReadReceipt = {
	connectionId: string
	generation: number
	revision: bigint
	windowId: string | null
	series: CalendarSeriesContext[]
	checkedAt: Date
	emptyStudentIds: readonly string[]
}
const receipts = new WeakMap<CalendarReadContext, ReadReceipt | CalendarIssue>()

export function recordRead(context: CalendarReadContext, result: ReadReceipt | CalendarIssue) {
	receipts.set(context, result)
}

export function currentRead(context: CalendarReadContext) {
	return receipts.get(context)
}

export function opaqueVersion(parts: readonly (string | number | bigint | null)[]): string {
	return createHash('sha256').update(parts.map(String).join('\0')).digest('hex')
}

export function eventVersion(event: { eventId: string; etag: string }): string {
	return opaqueVersion([event.eventId, event.etag])
}
