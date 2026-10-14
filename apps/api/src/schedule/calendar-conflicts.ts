import { randomUUID } from 'node:crypto'
import type { z } from 'zod'

import {
	googleConflictResult,
	calendarIssue,
	timeZoneIdentity,
	type GoogleConflictEvent,
	type CalendarEventView,
	type GoogleConflictResult,
	googleConflictRequest,
} from '@dv-lab/contracts'
import {
	addDays,
	firstOnOrAfter,
	localTimeCandidates,
	occurrenceAt,
	startOfZonedDay,
	weekdayOf,
	type SeriesRule,
} from '@dv-lab/core'
import type { Database } from '@dv-lab/db'

import { readConnection } from '../calendar/connection.ts'
import { bindEvent, loadMappings, rowForLocal } from '../calendar/event-mapping.ts'
import { CalendarFault } from '../calendar/gateway.ts'
import { findConnection, type ConnectionRow } from '../calendar/google-access.ts'
import { CommandFault, unresolvedCommands } from '../calendar/journal.ts'
import { syncFacts, syncRevision, weekRows, rowEvent, type SyncFacts } from '../calendar/projection.ts'
import { eventColors, eventView, syncRead } from '../calendar/read-model.ts'
import { eventVersion, opaqueVersion, type CalendarReadContext } from '../calendar/read-state.ts'
import { seriesBinding } from '../calendar/series-observation.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import { prepareSeriesChange } from './series.ts'

type ConflictRequest = z.infer<typeof googleConflictRequest>
type Interval = { start: Date; end: Date }
type Candidate = { intervals: Interval[]; timeZone: string; excludedKey: string | null }
type Dependencies = { db: Database }
type ConflictAccess = { db: Database; connection: ConnectionRow & { calendarId: string }; facts: SyncFacts | null }

function interval(start: Date, minutes: number): Interval {
	return { start, end: new Date(start.getTime() + minutes * 60000) }
}

function manualInterval(date: string, time: string, zone: string, minutes: number) {
	const start = localTimeCandidates(date, time, zone)[0]
	if (!start) throw new CalendarFault('invalid_provider_data')
	return interval(start, minutes)
}

function seriesIntervals(rule: SeriesRule, deadline: number, checkThrough?: string): Interval[] {
	const end = rule.endsOn ?? checkThrough
	if (!end) return []
	if (end < rule.startsOn) throw new CalendarFault('invalid_provider_data')
	const result: Interval[] = []
	for (let date = firstOnOrAfter(rule.startsOn, rule.weekday); date <= end; date = addDays(date, 7)) {
		if (Date.now() >= deadline) throw new CalendarFault('provider_unavailable')
		const occurrence = occurrenceAt(rule, date)
		if (occurrence) result.push(interval(occurrence.startsAt, occurrence.durationMinutes))
	}
	return result
}

async function candidates(access: ConflictAccess, request: ConflictRequest, now: Date): Promise<Candidate> {
	const { proposal } = request
	const settings = await readTeacherSettings(access.db, access.connection.accountId)
	if (timeZoneIdentity(settings.defaultTimeZone) !== timeZoneIdentity(proposal.input.expectedDefaultTimeZone))
		throw new CalendarFault('external_change')
	const timeZone = settings.defaultTimeZone
	if (proposal.operation === 'create') {
		if (request.editedRef) throw new CalendarFault('external_change')
		const input = proposal.input
		if (input.repeats === 'once')
			return {
				intervals: [manualInterval(input.date, input.startTime, timeZone, input.durationMinutes)],
				timeZone,
				excludedKey: null,
			}
		const rule: SeriesRule = {
			id: input.studentId,
			studentId: input.studentId,
			weekday: weekdayOf(input.date),
			startTime: input.startTime,
			timeZone,
			durationMinutes: input.durationMinutes,
			startsOn: input.date,
			endsOn: null,
		}
		return {
			intervals: seriesIntervals(rule, now.getTime() + 30000, request.checkThrough),
			timeZone,
			excludedKey: null,
		}
	}
	const ref = request.editedRef
	if (!ref) throw new CalendarFault('external_change')
	if (proposal.operation === 'move_series') return seriesCandidate(access, request, now)
	const local = await rowForLocal(access.db, access.connection.id, ref)
	const row = local?.row
	if (
		!row?.start ||
		!row.end ||
		!('dateTime' in row.start) ||
		!('dateTime' in row.end) ||
		row.status === 'cancelled' ||
		eventVersion(row) !== request.expectedVersion
	)
		throw new CalendarFault('external_change')
	return {
		intervals: [
			manualInterval(
				proposal.input.date,
				proposal.input.startTime,
				timeZone,
				(Date.parse(row.end.dateTime) - Date.parse(row.start.dateTime)) / 60000
			),
		],
		timeZone,
		excludedKey: row.eventKey,
	}
}

async function seriesCandidate(access: ConflictAccess, request: ConflictRequest, now: Date): Promise<Candidate> {
	const proposal = request.proposal
	const ref = request.editedRef
	if (proposal.operation !== 'move_series' || ref?.kind !== 'series') throw new CalendarFault('external_change')
	const mapping = await seriesBinding(access.db, access.connection.accountId, ref.seriesId)
	if (mapping.connectionId !== access.connection.id || mapping.calendarId !== access.connection.calendarId)
		throw new CalendarFault('external_change')
	if (opaqueVersion([mapping.id, mapping.representationGeneration, ref.seriesId]) !== request.expectedVersion)
		throw new CalendarFault('external_change')
	const prepared = await access.db.transaction((tx) =>
		prepareSeriesChange(
			tx,
			access.connection.accountId,
			{
				operation: 'move_series',
				seriesId: ref.seriesId,
				input: { ...proposal.input, requestId: randomUUID(), expectedVersion: request.expectedVersion },
			},
			now
		)
	)
	if (!prepared.newRule) throw new CalendarFault('external_change')
	const current = await rowForLocal(access.db, access.connection.id, ref)
	return {
		intervals: seriesIntervals({ ...prepared.rule, ...prepared.newRule }, now.getTime() + 30000, request.checkThrough),
		timeZone: prepared.newRule.timeZone,
		excludedKey: current?.row.eventKey ?? null,
	}
}

function rangeFor(candidate: Candidate) {
	let start = Infinity
	let end = -Infinity
	for (const item of candidate.intervals) {
		start = Math.min(start, item.start.getTime())
		end = Math.max(end, item.end.getTime())
	}
	return { start: new Date(start), end: new Date(end) }
}

function eventInterval(event: CalendarEventView): Interval {
	if (event.when.kind === 'timed') return { start: new Date(event.when.startsAt), end: new Date(event.when.endsAt) }
	return {
		start: startOfZonedDay(event.when.startsOn, event.when.timeZone),
		end: startOfZonedDay(event.when.endsBefore, event.when.timeZone),
	}
}

async function readConflicts(
	db: Database,
	context: CalendarReadContext,
	request: ConflictRequest
): Promise<GoogleConflictResult> {
	const now = context.now
	const connection = await findConnection(db, context.accountId)
	if (!connection?.calendarId) throw new CalendarFault('connection_required')
	if ((await unresolvedCommands(db, context.accountId)).length) throw new CalendarFault('command_pending')
	const facts = await syncFacts(db, connection.id)
	const access: ConflictAccess = { db, connection: { ...connection, calendarId: connection.calendarId }, facts }
	const candidate = await candidates(access, request, now)
	const revision = facts?.revision ?? 0n
	const inputKey = opaqueVersion([
		JSON.stringify(request),
		candidate.timeZone,
		connection.calendarId,
		connection.generation,
		revision,
	])
	if (!candidate.intervals.length) return { state: 'not_checked', inputKey }
	const range = rangeFor(candidate)
	const read = syncRead(await readConnection(db, context.accountId), facts, range, now)
	if (read.state !== 'fresh') return { state: 'unavailable', inputKey, reason: read.reason }
	const mappings = await loadMappings(db, context.accountId, connection.id)
	const colors = eventColors(facts)
	const events: GoogleConflictEvent[] = []
	for (const row of await weekRows(db, connection.id, range)) {
		if (row.eventKey === candidate.excludedKey || row.status === 'cancelled' || row.transparency === 'transparent')
			continue
		const event = eventView(
			{ ...bindEvent(rowEvent(row), mappings), eventKey: row.eventKey, colorId: row.colorId, location: row.location },
			null,
			new Set(),
			colors
		)
		if (!event) throw new CalendarFault('invalid_provider_data')
		const when = eventInterval(event)
		if (!(when.end > when.start)) throw new CalendarFault('invalid_provider_data')
		const matchedStartsAt = candidate.intervals
			.filter((item) => item.start < when.end && when.start < item.end)
			.map((item) => item.start.toISOString())
		if (matchedStartsAt.length) events.push({ ...event, matchedStartsAt })
	}
	const current = await findConnection(db, context.accountId)
	const settings = await readTeacherSettings(db, context.accountId)
	if (
		!current ||
		current.id !== connection.id ||
		current.state !== 'connected' ||
		current.calendarId !== connection.calendarId ||
		current.generation !== connection.generation ||
		(await syncRevision(db, connection.id)) !== revision ||
		timeZoneIdentity(settings.defaultTimeZone) !== timeZoneIdentity(request.proposal.input.expectedDefaultTimeZone)
	)
		throw new CalendarFault('external_change')
	if (Date.now() >= now.getTime() + 30000) throw new CalendarFault('provider_unavailable')
	return googleConflictResult.parse({
		state: 'complete',
		complete: true,
		inputKey,
		checkedRange: { start: range.start.toISOString(), end: range.end.toISOString(), timeZone: candidate.timeZone },
		checkedAt: new Date().toISOString(),
		events,
	})
}

export async function checkCalendarConflicts(
	deps: Dependencies,
	context: CalendarReadContext,
	request: ConflictRequest
): Promise<GoogleConflictResult> {
	const inputKey = opaqueVersion([JSON.stringify(request)])
	if (Date.now() >= context.now.getTime() + 30000)
		return { state: 'unavailable', inputKey, reason: 'provider_unavailable' }
	try {
		return await readConflicts(deps.db, context, request)
	} catch (error) {
		const code =
			error instanceof CalendarFault
				? error.code
				: error instanceof CommandFault
					? 'external_change'
					: 'provider_unavailable'
		const reason = calendarIssue.safeParse(code)
		return { state: 'unavailable', inputKey, reason: reason.success ? reason.data : 'provider_unavailable' }
	}
}
