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
	seriesStart,
	weekdayOf,
	type SeriesRule,
} from '@dv-lab/core'
import type { Database } from '@dv-lab/db'

import type { CommandAccess } from '../calendar/dispatch.ts'
import { bindEvent, loadMappings } from '../calendar/event-mapping.ts'
import { CalendarFault, type GoogleGateway } from '../calendar/gateway.ts'
import { findConnection, type Credentials } from '../calendar/google-access.ts'
import { observeInstance } from '../calendar/instance-observation.ts'
import { CommandFault, unresolvedCommands } from '../calendar/journal.ts'
import { eventView } from '../calendar/read-model.ts'
import { completeWindow } from '../calendar/read-pages.ts'
import { eventVersion, opaqueVersion, type CalendarReadContext } from '../calendar/read-state.ts'
import { matchesMaster } from '../calendar/recurring.ts'
import { seriesBinding } from '../calendar/series-observation.ts'
import { observeSingle } from '../calendar/single-observation.ts'
import { readTeacherSettings } from '../settings/settings.ts'
import { commandWindow } from './command-plan.ts'
import { prepareSeriesChange } from './series.ts'

type ConflictRequest = z.infer<typeof googleConflictRequest>
type Interval = { start: Date; end: Date }
type Candidate = { intervals: Interval[]; timeZone: string; excludedId: string | null }
type Dependencies = { db: Database; credentials: Credentials; gateway: GoogleGateway }

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

async function candidates(
	access: CommandAccess,
	request: ConflictRequest,
	gateway: GoogleGateway,
	now: Date
): Promise<Candidate> {
	const { proposal } = request
	const settings = await readTeacherSettings(access.db, access.connection.accountId)
	if (timeZoneIdentity(settings.defaultTimeZone) !== timeZoneIdentity(proposal.input.expectedDefaultTimeZone))
		throw new CalendarFault('external_change')
	const timeZone = settings.defaultTimeZone
	if (proposal.operation === 'create') {
		if (request.editedRef) throw new CalendarFault('external_change')
		const window = await commandWindow(
			access.db,
			access.connection.accountId,
			access.connection.id,
			request.expectedVersion
		)
		if (
			window.connectionId !== access.connection.id ||
			window.generation !== access.connection.generation ||
			window.snapshotRevision !== access.connection.snapshotRevision
		)
			throw new CalendarFault('external_change')
		const input = proposal.input
		if (input.repeats === 'once')
			return {
				intervals: [manualInterval(input.date, input.startTime, timeZone, input.durationMinutes)],
				timeZone,
				excludedId: null,
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
		return { intervals: seriesIntervals(rule, now.getTime() + 30000, request.checkThrough), timeZone, excludedId: null }
	}
	const ref = request.editedRef
	if (!ref) throw new CalendarFault('external_change')
	if (proposal.operation === 'move_series') return seriesCandidate(access, request, gateway, now)
	const command = {
		operation: 'move' as const,
		ref,
		input: { ...proposal.input, requestId: randomUUID(), expectedVersion: request.expectedVersion },
	}
	const observed =
		ref.kind === 'single'
			? await observeSingle(access, command, gateway)
			: await observeInstance(access, command, gateway)
	const fact =
		observed.kind === 'present'
			? observed.observation.event
			: observed.kind === 'instance'
				? observed.observation?.event
				: null
	if (
		!fact?.start ||
		!fact.end ||
		!('dateTime' in fact.start) ||
		!('dateTime' in fact.end) ||
		fact.status === 'cancelled'
	)
		throw new CalendarFault('external_change')
	const bound = bindEvent(fact, await loadMappings(access.db, access.connection.accountId, access.connection.id))
	if (
		eventVersion({
			...bound,
			accountId: access.connection.accountId,
			connectionId: access.connection.id,
			generation: access.connection.generation,
			snapshotRevision: access.connection.snapshotRevision,
		}) !== request.expectedVersion
	)
		throw new CalendarFault('external_change')
	return {
		intervals: [
			manualInterval(
				proposal.input.date,
				proposal.input.startTime,
				timeZone,
				(Date.parse(fact.end.dateTime) - Date.parse(fact.start.dateTime)) / 60000
			),
		],
		timeZone,
		excludedId: fact.eventId,
	}
}

async function seriesCandidate(
	access: CommandAccess,
	request: ConflictRequest,
	gateway: GoogleGateway,
	now: Date
): Promise<Candidate> {
	const proposal = request.proposal
	const ref = request.editedRef
	if (proposal.operation !== 'move_series' || ref?.kind !== 'series') throw new CalendarFault('external_change')
	const mapping = await seriesBinding(access.db, access.connection.accountId, ref.seriesId)
	if (mapping.connectionId !== access.connection.id || mapping.calendarId !== access.connection.calendarId)
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
	const master = await gateway.master(
		access.accessToken,
		mapping.calendarId,
		mapping.eventId,
		prepared.rule.timeZone,
		access.signal
	)
	const version = opaqueVersion([mapping.id, mapping.representationGeneration, master.event.etag])
	if (
		!matchesMaster(master, prepared.rule) ||
		opaqueVersion([version, access.connection.id, access.connection.generation, access.connection.snapshotRevision]) !==
			request.expectedVersion
	)
		throw new CalendarFault('external_change')
	if (!prepared.newRule) throw new CalendarFault('external_change')
	const natural = seriesStart(prepared.rule, ref.originalOn)
	if (!natural) throw new CalendarFault('external_change')
	const instance = await gateway.canonicalInstance(
		access.accessToken,
		mapping.calendarId,
		mapping.eventId,
		natural.toISOString(),
		access.signal
	)
	if (instance.kind !== 'found') throw new CalendarFault('external_change')
	return {
		intervals: seriesIntervals({ ...prepared.rule, ...prepared.newRule }, now.getTime() + 30000, request.checkThrough),
		timeZone: prepared.newRule.timeZone,
		excludedId: instance.eventId,
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
	access: CommandAccess,
	request: ConflictRequest,
	gateway: GoogleGateway,
	now: Date
): Promise<GoogleConflictResult> {
	if (!access.connection.calendarId) throw new CalendarFault('connection_required')
	if ((await unresolvedCommands(access.db, access.connection.accountId)).length)
		throw new CalendarFault('command_pending')
	const primary = await gateway.primary(access.accessToken, access.signal)
	if (primary.id !== access.connection.calendarId) throw new CalendarFault('external_change')
	const candidate = await candidates(access, request, gateway, now)
	const inputKey = opaqueVersion([
		JSON.stringify(request),
		candidate.timeZone,
		access.connection.calendarId,
		access.connection.generation,
		access.connection.snapshotRevision,
	])
	if (!candidate.intervals.length) return { state: 'not_checked', inputKey }
	const range = rangeFor(candidate)
	const mappings = await loadMappings(access.db, access.connection.accountId, access.connection.id)
	const result = await completeWindow({ ...access, gateway, calendarId: primary.id }, range.start, range.end, mappings)
	const events: GoogleConflictEvent[] = []
	for (const raw of result.events) {
		if (raw.eventId === candidate.excludedId || raw.status === 'cancelled' || raw.transparency === 'transparent')
			continue
		const event = eventView(
			{
				...raw,
				accountId: access.connection.accountId,
				connectionId: access.connection.id,
				generation: access.connection.generation,
				snapshotRevision: access.connection.snapshotRevision,
			},
			null,
			new Set()
		)
		if (!event) throw new CalendarFault('invalid_provider_data')
		const when = eventInterval(event)
		if (!(when.end > when.start)) throw new CalendarFault('invalid_provider_data')
		const matchedStartsAt = candidate.intervals
			.filter((item) => item.start < when.end && when.start < item.end)
			.map((item) => item.start.toISOString())
		if (matchedStartsAt.length) events.push({ ...event, matchedStartsAt })
	}
	access.signal.throwIfAborted()
	const current = await findConnection(access.db, access.connection.accountId)
	const settings = await readTeacherSettings(access.db, access.connection.accountId)
	if (
		!current ||
		current.state !== 'connected' ||
		current.credentialMode !== 'active' ||
		current.calendarId !== primary.id ||
		current.generation !== access.connection.generation ||
		current.credentialGeneration !== access.connection.credentialGeneration ||
		current.snapshotRevision !== access.connection.snapshotRevision ||
		timeZoneIdentity(settings.defaultTimeZone) !== timeZoneIdentity(candidate.timeZone)
	)
		throw new CalendarFault('external_change')
	access.signal.throwIfAborted()
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
	const remaining = context.now.getTime() + 30000 - Date.now()
	if (remaining <= 0) return { state: 'unavailable', inputKey, reason: 'provider_unavailable' }
	const budget = AbortSignal.timeout(remaining)
	try {
		const access = await deps.credentials.accessToken(context.accountId, budget)
		return await readConflicts(access, request, deps.gateway, context.now)
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
