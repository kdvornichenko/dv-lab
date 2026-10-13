import { eq } from 'drizzle-orm'

import {
	calendarEventView,
	googleEventPalette,
	googleScheduleWindow,
	type CalendarEventColor,
	type CalendarEventSuggestion,
	type CalendarEventView,
	type CalendarIssue,
	type CalendarReadStatus,
	type CalendarSeriesContext,
	type GoogleConnectionSnapshot,
	type GooglePaletteColor,
	type GoogleScheduleWindow,
	type NextLessonRead,
} from '@dv-lab/contracts'
import { seriesStart } from '@dv-lab/core'
import { googleEventIgnores, type DbExecutor } from '@dv-lab/db'

import { readConnection } from './connection.ts'
import { bindEvent, loadMappings, type BoundEvent, type MappingSnapshot } from './event-mapping.ts'
import { findConnection } from './google-access.ts'
import { canonicalName, studentNames, suggestionFor, type MatchStudent } from './matching.ts'
import {
	masterRow,
	nextRows,
	rowEvent,
	syncFacts,
	weekRows,
	type ProjectionRange,
	type ProjectionRow,
	type SyncFacts,
} from './projection.ts'
import { eventVersion, opaqueVersion, type CalendarReadContext, type WindowSelection } from './read-state.ts'

const FRESH_WITHOUT_CHANNEL_MS = 5 * 60_000
const FRESH_WITH_CHANNEL_MS = 65 * 60_000

export type SyncRead =
	| { state: 'fresh'; fetchedAt: Date; revision: bigint }
	| { state: 'last_known'; fetchedAt: Date; revision: bigint; reason: CalendarIssue }
	| { state: 'unavailable'; reason: CalendarIssue }

export type EventColors = { palette: readonly GooglePaletteColor[] | null; calendarColor: string | null }
export type ViewEvent = BoundEvent & {
	eventKey: string
	colorId: string | null
	location: string | null
	suggestion?: CalendarEventSuggestion | null
}

const NO_COLORS: EventColors = { palette: null, calendarColor: null }

function connectionIssue(connection: GoogleConnectionSnapshot): CalendarIssue | null {
	if (connection.state === 'connected') return null
	if (connection.state === 'not_connected') return 'connection_required'
	if (connection.state === 'permission_required') return 'permission_required'
	return 'reconnect_required'
}

export function lastChecked(facts: Pick<SyncFacts, 'lastFullAt' | 'lastIncrementalAt'>): Date | null {
	const times = [facts.lastFullAt, facts.lastIncrementalAt].filter((value) => value !== null)
	return times.length ? new Date(Math.max(...times.map((value) => value.getTime()))) : null
}

export function syncRead(
	connection: GoogleConnectionSnapshot,
	facts: SyncFacts | null,
	range: ProjectionRange,
	now: Date
): SyncRead {
	const blocked = connectionIssue(connection)
	const fetchedAt = facts ? lastChecked(facts) : null
	if (!facts?.lastFullAt || !fetchedAt)
		return { state: 'unavailable', reason: blocked ?? facts?.issue ?? 'provider_unavailable' }
	const stamp = { fetchedAt, revision: facts.revision }
	if (blocked) return { ...stamp, state: 'last_known', reason: blocked }
	if (range.start < facts.windowStart || range.end > facts.windowEnd)
		return { ...stamp, state: 'last_known', reason: 'outside_sync_window' }
	if (facts.issue) return { ...stamp, state: 'last_known', reason: facts.issue }
	const channel = facts.channelId !== null && facts.channelExpiresAt !== null && facts.channelExpiresAt > now
	const limit = channel ? FRESH_WITH_CHANNEL_MS : FRESH_WITHOUT_CHANNEL_MS
	if (now.getTime() - fetchedAt.getTime() > limit)
		return { ...stamp, state: 'last_known', reason: 'provider_unavailable' }
	return { ...stamp, state: 'fresh' }
}

function readStatus(read: SyncRead): CalendarReadStatus {
	if (read.state === 'unavailable') return read
	const stamp = { fetchedAt: read.fetchedAt.toISOString(), revision: read.revision.toString() }
	return read.state === 'fresh' ? { ...stamp, state: 'fresh' } : { ...stamp, state: 'last_known', reason: read.reason }
}

export function eventColors(facts: Pick<SyncFacts, 'palette' | 'calendarColor'> | null): EventColors {
	if (!facts) return NO_COLORS
	const palette = googleEventPalette.shape.colors.safeParse(facts.palette)
	return { palette: facts.palette && palette.success ? palette.data : null, calendarColor: facts.calendarColor }
}

export function eventColor(colorId: string | null, colors: EventColors): CalendarEventColor {
	const background = colors.calendarColor
	if (colorId === null) return { id: null, background, foreground: null, custom: false }
	const found = colors.palette?.find((color) => color.id === colorId)
	if (found) return { id: colorId, background: found.background, foreground: found.foreground, custom: false }
	return { id: colorId, background, foreground: null, custom: colors.palette !== null }
}

export function eventView(
	event: ViewEvent,
	blocked: CalendarIssue | null,
	editableSeries: ReadonlySet<string>,
	colors: EventColors = NO_COLORS
): CalendarEventView | null {
	if (!event.start || !event.end) return null
	const when: CalendarEventView['when'] | null =
		'date' in event.start && 'date' in event.end
			? { kind: 'all_day', startsOn: event.start.date, endsBefore: event.end.date, timeZone: event.start.timeZone }
			: 'dateTime' in event.start && 'dateTime' in event.end
				? { kind: 'timed', startsAt: event.start.dateTime, endsAt: event.end.dateTime, timeZone: event.start.timeZone }
				: null
	if (!when) return null
	const version = eventVersion(event)
	let binding: CalendarEventView['binding'] = { kind: 'external' }
	if (event.bindingKind === 'transition' && event.commandId)
		binding = { kind: 'transition', commandId: event.commandId }
	if (event.bindingKind === 'lesson' && event.localRef && event.studentId)
		binding = { kind: 'lesson', ref: event.localRef, studentId: event.studentId, version }
	let editBlock = blocked
	if (event.eventType !== 'default') editBlock = 'read_only_event'
	else if (binding.kind === 'transition') editBlock = 'command_pending'
	else if (event.blocked) editBlock = event.blocked
	else if (binding.kind === 'lesson' && binding.ref.kind === 'series' && !editableSeries.has(binding.ref.seriesId))
		editBlock = 'external_change'
	const view = calendarEventView.safeParse({
		eventKey: event.eventKey,
		version,
		title: event.summary,
		when,
		status: event.status,
		blocksTime: event.status !== 'cancelled' && event.transparency !== 'transparent',
		color: eventColor(event.colorId, colors),
		location: event.location,
		seriesMember: event.recurringEventId !== null,
		binding,
		suggestion: binding.kind === 'external' ? (event.suggestion ?? null) : null,
		editBlock,
	})
	return view.success ? view.data : null
}

function boundRow(row: ProjectionRow, snapshot: MappingSnapshot): ViewEvent {
	const event = { ...rowEvent(row), markerLocalId: row.markerLocalId, markerKind: row.markerKind }
	return { ...bindEvent(event, snapshot), eventKey: row.eventKey, colorId: row.colorId, location: row.location }
}

async function ignoredEvents(executor: DbExecutor, connectionId: string): Promise<ReadonlySet<string>> {
	const rows = await executor
		.select({ eventId: googleEventIgnores.eventId })
		.from(googleEventIgnores)
		.where(eq(googleEventIgnores.connectionId, connectionId))
	return new Set(rows.map((row) => row.eventId))
}

function seriesRuleOf(master: ProjectionRow | null): 'weekly' | 'other' {
	return master?.status !== 'cancelled' && master?.recurrenceKind === 'weekly' && !master.allDay ? 'weekly' : 'other'
}

async function withSuggestions(
	executor: DbExecutor,
	connectionId: string,
	events: readonly ViewEvent[],
	students: readonly MatchStudent[] | undefined
): Promise<ViewEvent[]> {
	if (!students?.length) return [...events]
	const names = studentNames(students)
	const candidates = events.filter(
		(event) => event.suggestable && event.summary !== null && names.has(canonicalName(event.summary))
	)
	if (!candidates.length) return [...events]
	const ignores = await ignoredEvents(executor, connectionId)
	const masters = new Map<string, ProjectionRow | null>()
	for (const id of new Set(candidates.flatMap((event) => (event.recurringEventId ? [event.recurringEventId] : []))))
		masters.set(id, await masterRow(executor, connectionId, id))
	return events.map((event) => {
		if (!candidates.includes(event)) return event
		const suggestion = suggestionFor(
			{
				eventId: event.eventId,
				recurringEventId: event.recurringEventId,
				summary: event.summary,
				status: event.status,
				eventType: event.eventType,
				timed: Boolean(event.start && 'dateTime' in event.start),
				seriesRule: event.recurringEventId ? seriesRuleOf(masters.get(event.recurringEventId) ?? null) : null,
			},
			names,
			ignores
		)
		return { ...event, suggestion }
	})
}

async function seriesContexts(
	executor: DbExecutor,
	connectionId: string,
	now: Date,
	snapshot: MappingSnapshot,
	events: readonly BoundEvent[]
): Promise<CalendarSeriesContext[]> {
	if (snapshot.commands.length) return []
	const visible = new Set(
		events.flatMap((event) =>
			event.bindingKind === 'lesson' && event.localRef?.kind === 'series' ? [event.localRef.seriesId] : []
		)
	)
	const mappings = snapshot.mappings.filter(
		(row) => row.entityKind === 'series' && row.state === 'active' && visible.has(row.localEntityId)
	)
	const upcoming = (
		await nextRows(
			executor,
			connectionId,
			now,
			mappings.map((row) => row.eventId)
		)
	).map((row) => bindEvent(rowEvent(row), snapshot))
	const contexts = new Map<string, CalendarSeriesContext>()
	for (const mapping of mappings) {
		const rule = snapshot.series.get(mapping.localEntityId)
		if (!rule || contexts.has(rule.id)) continue
		const next = upcoming.find(
			(event) =>
				event.recurringEventId === mapping.eventId &&
				event.localRef?.kind === 'series' &&
				event.localRef.seriesId === rule.id
		)
		if (next?.localRef?.kind !== 'series' || !next.start || !('dateTime' in next.start)) continue
		contexts.set(rule.id, {
			series: {
				...rule,
				referenceOccurrence: {
					originalOn: next.localRef.originalOn,
					actualStartsAt: next.start.dateTime,
					ruleStartsAt: seriesStart(rule, next.localRef.originalOn)?.toISOString() ?? null,
				},
			},
			version: opaqueVersion([mapping.id, mapping.representationGeneration, rule.id]),
		})
	}
	return [...contexts.values()]
}

export async function readCalendarWindow(
	executor: DbExecutor,
	context: CalendarReadContext,
	selection: WindowSelection,
	students?: readonly MatchStudent[]
): Promise<GoogleScheduleWindow> {
	const connection = await readConnection(executor, context.accountId)
	const row = await findConnection(executor, context.accountId)
	const requestedRange = {
		start: selection.start.toISOString(),
		end: selection.end.toISOString(),
		timeZone: selection.displayTimeZone,
	}
	const facts = row ? await syncFacts(executor, row.id) : null
	const read = syncRead(connection, facts, selection, context.now)
	if (!row || read.state === 'unavailable')
		return googleScheduleWindow.parse({
			requestedRange,
			snapshotRange: null,
			connection,
			read: readStatus(read),
			events: [],
			series: [],
			write: { state: 'blocked', reason: read.state === 'unavailable' ? read.reason : 'connection_required' },
		})
	const blocked = connection.pendingCommandCount ? 'command_pending' : read.state === 'fresh' ? null : read.reason
	const rows = await weekRows(executor, row.id, selection)
	const markerIds = rows.flatMap((item) => (item.markerLocalId ? [item.markerLocalId] : []))
	const snapshot = await loadMappings(executor, context.accountId, row.id, markerIds)
	const events = await withSuggestions(
		executor,
		row.id,
		rows.map((item) => boundRow(item, snapshot)),
		students
	)
	const series =
		read.state === 'fresh' && !blocked ? await seriesContexts(executor, row.id, context.now, snapshot, events) : []
	const editableSeries = new Set(series.map((item) => item.series.id))
	const colors = eventColors(facts)
	return googleScheduleWindow.parse({
		requestedRange,
		snapshotRange: requestedRange,
		connection,
		read: readStatus(read),
		events: events.map((event) => eventView(event, blocked, editableSeries, colors)).filter((event) => event !== null),
		series,
		write: blocked ? { state: 'blocked', reason: blocked } : { state: 'ready' },
	})
}

function familyIds(snapshot: MappingSnapshot, studentIds: ReadonlySet<string>): string[] {
	return snapshot.mappings.flatMap((mapping) => {
		if (mapping.state === 'retired' || !studentIds.has(mapping.studentId)) return []
		const id = mapping.entityKind === 'occurrence' ? mapping.recurringEventId : mapping.eventId
		return id ? [id] : []
	})
}

export async function readNextLessons(
	executor: DbExecutor,
	context: CalendarReadContext,
	studentIds: readonly string[]
): Promise<ReadonlyMap<string, NextLessonRead>> {
	const results = new Map<string, NextLessonRead>()
	if (!studentIds.length) return results
	const connection = await readConnection(executor, context.accountId)
	const row = await findConnection(executor, context.accountId)
	const facts = row ? await syncFacts(executor, row.id) : null
	const read = syncRead(connection, facts, { start: context.now, end: context.now }, context.now)
	const status = readStatus(read)
	if (connection.pendingCommandCount || !row || !facts || read.state === 'unavailable') {
		const reason = connection.pendingCommandCount
			? 'command_pending'
			: read.state === 'unavailable'
				? read.reason
				: null
		for (const studentId of studentIds)
			results.set(studentId, {
				result: 'unknown',
				startsAt: null,
				status: { state: 'unavailable', reason: reason ?? 'connection_required' },
			})
		return results
	}
	const snapshot = await loadMappings(executor, context.accountId, row.id)
	const wanted = new Set(studentIds)
	const earliest = new Map<string, string>()
	for (const item of await nextRows(executor, row.id, context.now, familyIds(snapshot, wanted))) {
		if (!item.startsAt || item.startsAt >= facts.windowEnd) continue
		const event = bindEvent(rowEvent(item), snapshot)
		if (!event.localRef || !event.studentId || !wanted.has(event.studentId)) continue
		if (!event.start || !('dateTime' in event.start)) continue
		const startsAt = item.startsAt.toISOString()
		const known = earliest.get(event.studentId)
		if (!known || startsAt < known) earliest.set(event.studentId, startsAt)
	}
	for (const studentId of studentIds) {
		const startsAt = earliest.get(studentId)
		results.set(
			studentId,
			startsAt
				? { result: 'known', startsAt, status }
				: read.state === 'fresh'
					? { result: 'none', startsAt: null, status }
					: { result: 'unknown', startsAt: null, status }
		)
	}
	return results
}
