import { and, desc, eq } from 'drizzle-orm'

import {
	googleScheduleWindow,
	type CalendarEventView,
	type CalendarIssue,
	type CalendarReadStatus,
	type GoogleConnectionSnapshot,
	type GoogleScheduleWindow,
} from '@dv-lab/contracts'
import { googleReadEvents, googleReadWindows, type DbExecutor } from '@dv-lab/db'

import { readConnection } from './connection.ts'
import { findConnection } from './credentials.ts'
import {
	currentRead,
	eventVersion,
	opaqueVersion,
	type CalendarReadContext,
	type ReadEventRow,
	type WindowSelection,
} from './read-state.ts'

export function readIssue(connection: GoogleConnectionSnapshot, context: CalendarReadContext): CalendarIssue {
	if (connection.state === 'not_connected') return 'connection_required'
	if (connection.state === 'permission_required') return 'permission_required'
	if (connection.state !== 'connected') return 'reconnect_required'
	const result = currentRead(context)
	return typeof result === 'string' ? result : 'provider_unavailable'
}

function eventView(
	event: ReadEventRow,
	blocked: CalendarIssue | null,
	editableSeries: ReadonlySet<string>
): CalendarEventView | null {
	if (!event.start || !event.end) return null
	const when: CalendarEventView['when'] | null =
		'date' in event.start && 'date' in event.end
			? { kind: 'all_day', startsOn: event.start.date, endsBefore: event.end.date, timeZone: event.start.timeZone }
			: 'dateTime' in event.start && 'dateTime' in event.end
				? { kind: 'timed', startsAt: event.start.dateTime, endsAt: event.end.dateTime, timeZone: event.start.timeZone }
				: null
	if (!when) return null
	let binding: CalendarEventView['binding'] = { kind: 'external' }
	if (event.bindingKind === 'transition' && event.commandId)
		binding = { kind: 'transition', commandId: event.commandId }
	if (event.bindingKind === 'lesson' && event.localRef)
		binding = { kind: 'lesson', ref: event.localRef, version: eventVersion(event) }
	let editBlock = blocked
	if (binding.kind === 'external') editBlock = 'external_change'
	if (binding.kind === 'transition') editBlock = 'command_pending'
	if (binding.kind === 'lesson' && binding.ref.kind === 'series' && !editableSeries.has(binding.ref.seriesId))
		editBlock = 'external_change'
	return {
		eventKey: opaqueVersion([event.connectionId, event.eventId]),
		title: event.summary,
		when,
		status: event.status,
		blocksTime: event.status !== 'cancelled' && event.transparency !== 'transparent',
		binding,
		editBlock,
	}
}

export async function readCalendarWindow(
	executor: DbExecutor,
	context: CalendarReadContext,
	selection: WindowSelection
): Promise<GoogleScheduleWindow> {
	const connection = await readConnection(executor, context.accountId)
	const row = await findConnection(executor, context.accountId)
	const requestedRange = {
		start: selection.start.toISOString(),
		end: selection.end.toISOString(),
		timeZone: selection.displayTimeZone,
	}
	const [window] = row
		? await executor
				.select()
				.from(googleReadWindows)
				.where(
					and(
						eq(googleReadWindows.accountId, context.accountId),
						eq(googleReadWindows.connectionId, row.id),
						eq(googleReadWindows.windowStart, selection.start),
						eq(googleReadWindows.windowEnd, selection.end),
						eq(googleReadWindows.displayTimeZone, selection.displayTimeZone),
						eq(googleReadWindows.coverageState, 'complete')
					)
				)
				.orderBy(desc(googleReadWindows.snapshotRevision))
				.limit(1)
		: []
	const receipt = currentRead(context)
	const fresh = Boolean(
		window &&
		row &&
		receipt &&
		typeof receipt !== 'string' &&
		receipt.windowId === window.id &&
		receipt.revision === row.snapshotRevision &&
		receipt.generation === row.generation &&
		receipt.connectionId === row.id &&
		connection.state === 'connected'
	)
	const reason = readIssue(connection, context)
	if (!window?.fetchedAt)
		return {
			requestedRange,
			snapshotRange: null,
			connection,
			read: { state: 'unavailable', reason },
			events: [],
			series: [],
			write: { state: 'blocked', reason },
		}
	const read: CalendarReadStatus = fresh
		? { state: 'fresh', fetchedAt: window.fetchedAt.toISOString(), revision: window.snapshotRevision.toString() }
		: {
				state: 'last_known',
				fetchedAt: window.fetchedAt.toISOString(),
				revision: window.snapshotRevision.toString(),
				reason,
			}
	const blocked = connection.pendingCommandCount ? 'command_pending' : fresh ? null : reason
	const series = fresh && !blocked && receipt && typeof receipt !== 'string' ? receipt.series : []
	const editableSeries = new Set(series.map((item) => item.series.id))
	const events = await executor
		.select()
		.from(googleReadEvents)
		.where(and(eq(googleReadEvents.accountId, context.accountId), eq(googleReadEvents.windowId, window.id)))
	return googleScheduleWindow.parse({
		requestedRange,
		snapshotRange: {
			start: window.windowStart.toISOString(),
			end: window.windowEnd.toISOString(),
			timeZone: window.displayTimeZone,
		},
		connection,
		read,
		events: events.map((event) => eventView(event, blocked, editableSeries)).filter((event) => event !== null),
		series,
		write: blocked ? { state: 'blocked', reason: blocked } : { state: 'ready' },
	})
}
