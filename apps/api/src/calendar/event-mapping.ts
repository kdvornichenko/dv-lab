import { and, eq, inArray, notInArray, sql, type SQL } from 'drizzle-orm'

import { occurrenceAt, scheduleDate, seriesStart, type SeriesRule } from '@dv-lab/core'
import {
	googleCalendarEvents,
	googleCommands,
	googleEventMappings,
	googleCommandPlan,
	googleStageRequest,
	type DbExecutor,
	type GoogleLocalRef,
} from '@dv-lab/db'
import { lessons, lessonSeries } from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { seriesColumns, toSeriesRule } from '../schedule/rows.ts'
import { CommandFault, digest } from './journal.ts'
import type { ProjectionRow } from './projection.ts'
import type { ProviderEvent } from './provider-events.ts'
import type { MappingRow } from './read-state.ts'
import type { AbsenceProof } from './single-observation.ts'

export async function replacementCommand(
	executor: DbExecutor,
	command: PreparedCalendarCommand,
	proof: AbsenceProof,
	stage = 0
): Promise<PreparedCalendarCommand> {
	const input = command.plan.input
	if (
		input.operation !== 'restore' ||
		input.ref.kind !== 'single' ||
		proof.eventId !== command.request.eventId ||
		command.plan.reservations.length
	)
		throw new CommandFault('precondition_failed')
	const preserved = command.plan.preconditions[0]?.unownedWritable
	if (!preserved) return { ...command, recoveryRequired: true, recoveryIssue: 'external_change' }
	const mappings = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, command.accountId),
				eq(googleEventMappings.connectionId, command.connectionId),
				eq(googleEventMappings.localEntityId, input.ref.lessonId)
			)
		)
	const generation = Math.max(...mappings.map((mapping) => mapping.representationGeneration)) + 1
	if (!Number.isSafeInteger(generation)) throw new CommandFault('precondition_failed')
	const eventId = `dv${digest(JSON.stringify([command.connectionId, command.calendarId, 'single', input.ref.lessonId, generation]))}`
	const reservation = {
		entityKind: 'single' as const,
		localEntityId: input.ref.lessonId,
		representationGeneration: generation,
		eventId,
	}
	const { markers, ...payload } = command.request.payload
	const stageDigest = digest(JSON.stringify({ eventId, ...payload, preserved }))
	const request = googleStageRequest.parse({
		method: 'insert',
		eventId,
		digest: stageDigest,
		payload: {
			...payload,
			preserved,
			markers: { ...markers, representationGeneration: generation, stage, digest: stageDigest },
		},
	})
	if (request.method !== 'insert') throw new CommandFault('precondition_failed')
	return {
		...command,
		plan: googleCommandPlan.parse({ ...command.plan, reservations: [reservation] }),
		request,
		absenceProof: proof,
		recoveryRequired: false,
	}
}

export async function reserveReplacement(executor: DbExecutor, command: PreparedCalendarCommand) {
	const reservation = command.plan.reservations[0]
	const proof = command.absenceProof
	if (!reservation || !proof || command.operation !== 'restore') throw new CommandFault('precondition_failed')
	const [old] = await executor
		.update(googleEventMappings)
		.set({ state: 'retired', retiredAt: sql`now()` })
		.where(
			and(
				eq(googleEventMappings.accountId, command.accountId),
				eq(googleEventMappings.connectionId, command.connectionId),
				eq(googleEventMappings.localEntityId, reservation.localEntityId),
				eq(googleEventMappings.eventId, proof.eventId),
				eq(googleEventMappings.state, 'active')
			)
		)
		.returning()
	if (!old) throw new CommandFault('precondition_failed')
	await executor.insert(googleEventMappings).values({
		...reservation,
		accountId: command.accountId,
		connectionId: command.connectionId,
		calendarId: command.calendarId,
		commandId: command.id,
		studentId: old.studentId,
	})
}

export async function rebindMappingStudent(
	executor: DbExecutor,
	accountId: string,
	localEntityId: string,
	studentId: string
) {
	await executor
		.update(googleEventMappings)
		.set({ studentId })
		.where(and(eq(googleEventMappings.accountId, accountId), eq(googleEventMappings.localEntityId, localEntityId)))
}

export type MappingSnapshot = Awaited<ReturnType<typeof loadMappings>>

export async function confirmOccurrenceMapping(executor: DbExecutor, command: PreparedCalendarCommand) {
	const input = command.plan.input
	const instance = command.request.method === 'patch' ? command.request.instance : undefined
	if (!instance?.lookupVerified || !('ref' in input) || input.ref.kind !== 'series')
		throw new CommandFault('precondition_failed')
	const [parent] = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, command.accountId),
				eq(googleEventMappings.connectionId, command.connectionId),
				eq(googleEventMappings.calendarId, command.calendarId),
				eq(googleEventMappings.eventId, instance.masterEventId),
				eq(googleEventMappings.state, 'active')
			)
		)
		.for('update')
	if (
		!parent ||
		parent.entityKind !== 'series' ||
		parent.localEntityId !== input.ref.seriesId ||
		parent.representationGeneration !== command.request.payload.markers.representationGeneration
	)
		throw new CommandFault('precondition_failed')
	const expected = {
		accountId: command.accountId,
		connectionId: command.connectionId,
		calendarId: command.calendarId,
		entityKind: 'occurrence' as const,
		localEntityId: input.ref.seriesId,
		representationGeneration: parent.representationGeneration,
		eventId: command.request.eventId,
		originalOn: input.ref.originalOn,
		recurringEventId: instance.masterEventId,
		originalStartTime: instance.originalStartTime,
		studentId: parent.studentId,
		commandId: command.id,
		state: 'active' as const,
	}
	await executor.insert(googleEventMappings).values(expected).onConflictDoNothing()
	const [actual] = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.accountId, command.accountId),
				eq(googleEventMappings.connectionId, command.connectionId),
				eq(googleEventMappings.eventId, expected.eventId)
			)
		)
		.for('update')
	if (!actual) throw new CommandFault('precondition_failed')
	for (const field of [
		'calendarId',
		'entityKind',
		'localEntityId',
		'representationGeneration',
		'originalOn',
		'recurringEventId',
		'studentId',
		'state',
	] as const) {
		if (actual[field] !== expected[field]) throw new CommandFault('precondition_failed')
	}
	const original = actual.originalStartTime
	const captured = expected.originalStartTime
	if (
		!original ||
		!('dateTime' in original) ||
		!('dateTime' in captured) ||
		original.dateTime !== captured.dateTime ||
		original.timeZone !== captured.timeZone
	)
		throw new CommandFault('precondition_failed')
}

export async function confirmEventMapping(executor: DbExecutor, accountId: string, commandId: string, eventId: string) {
	const rows = await executor
		.update(googleEventMappings)
		.set({ state: 'active' })
		.where(
			and(
				eq(googleEventMappings.accountId, accountId),
				eq(googleEventMappings.commandId, commandId),
				eq(googleEventMappings.eventId, eventId),
				eq(googleEventMappings.state, 'reserved')
			)
		)
		.returning({ id: googleEventMappings.id })
	if (rows.length !== 1) throw new Error('Calendar command mapping is not reserved')
}
export type BindInput = ProviderEvent & { markerLocalId?: string | null; markerKind?: string | null }
export type BoundEvent = ProviderEvent & {
	localRef: GoogleLocalRef | null
	studentId: string | null
	representationGeneration: number | null
	commandId: string | null
	bindingKind: 'lesson' | 'transition' | 'external'
	blocked: 'history_only' | null
	suggestable: boolean
}
type MarkerEntity = { kind: 'single'; studentId: string } | { kind: 'series'; rule: SeriesRule }

async function markerEntities(executor: DbExecutor, accountId: string, markerIds: readonly string[]) {
	const entities = new Map<string, MarkerEntity>()
	const wanted = [...new Set(markerIds)]
	if (!wanted.length) return entities
	const owned = await executor
		.selectDistinct({ id: googleEventMappings.localEntityId })
		.from(googleEventMappings)
		.where(and(eq(googleEventMappings.accountId, accountId), inArray(googleEventMappings.localEntityId, wanted)))
	const ids = owned.map((row) => row.id)
	if (!ids.length) return entities
	const singles = await executor
		.select({ id: lessons.id, studentId: lessons.studentId })
		.from(lessons)
		.where(inArray(lessons.id, ids))
	for (const row of singles) entities.set(row.id, { kind: 'single', studentId: row.studentId })
	const series = await executor.select(seriesColumns).from(lessonSeries).where(inArray(lessonSeries.id, ids))
	for (const row of series) entities.set(row.id, { kind: 'series', rule: toSeriesRule(row) })
	return entities
}

export async function loadMappings(
	executor: DbExecutor,
	accountId: string,
	connectionId: string,
	markerIds: readonly string[] = []
) {
	const mappings = await executor
		.select()
		.from(googleEventMappings)
		.where(and(eq(googleEventMappings.accountId, accountId), eq(googleEventMappings.connectionId, connectionId)))
	const commands = await executor
		.select({ id: googleCommands.id, plan: googleCommands.plan })
		.from(googleCommands)
		.where(
			and(
				eq(googleCommands.accountId, accountId),
				eq(googleCommands.connectionId, connectionId),
				notInArray(googleCommands.state, ['applied', 'failed'])
			)
		)
	const ids = mappings.filter((row) => row.entityKind !== 'single').map((row) => row.localEntityId)
	const series = ids.length
		? await executor.select(seriesColumns).from(lessonSeries).where(inArray(lessonSeries.id, ids))
		: []
	const rules = new Map<string, SeriesRule>(series.map((row) => [row.id, toSeriesRule(row)]))
	for (const command of commands) {
		const plan = googleCommandPlan.parse(command.plan)
		const reserved = plan.reservations.find((item) => item.entityKind === 'series')
		if (reserved && plan.cut && plan.newRule && !rules.has(reserved.localEntityId))
			rules.set(reserved.localEntityId, { id: reserved.localEntityId, studentId: plan.cut.studentId, ...plan.newRule })
	}
	const active = new Set(
		mappings.filter((row) => row.state === 'active' && row.entityKind !== 'occurrence').map((row) => row.localEntityId)
	)
	return { mappings, commands, series: rules, markers: await markerEntities(executor, accountId, markerIds), active }
}

function sameRef(left: GoogleLocalRef, right: GoogleLocalRef) {
	if (left.kind !== right.kind) return false
	if (left.kind === 'single' && right.kind === 'single') return left.lessonId === right.lessonId
	return (
		left.kind === 'series' &&
		right.kind === 'series' &&
		left.seriesId === right.seriesId &&
		left.originalOn === right.originalOn
	)
}

function seriesRef(event: ProviderEvent, rule: SeriesRule | undefined, expectedOn?: string | null) {
	const original = event.originalStartTime
	if (!rule || !original || !('dateTime' in original)) return null
	const originalOn = scheduleDate(new Date(original.dateTime), rule.timeZone)
	if (expectedOn && expectedOn !== originalOn) return null
	const natural = occurrenceAt(rule, originalOn)?.naturalStart
	if (!natural || natural.getTime() !== Date.parse(original.dateTime)) return null
	return { kind: 'series' as const, seriesId: rule.id, originalOn }
}

function localRef(event: ProviderEvent, mapping: MappingRow, snapshot: MappingSnapshot): GoogleLocalRef | null {
	if (mapping.entityKind === 'single') {
		return event.recurringEventId ? null : { kind: 'single', lessonId: mapping.localEntityId }
	}
	if (mapping.entityKind === 'occurrence' && mapping.recurringEventId !== event.recurringEventId) return null
	return seriesRef(event, snapshot.series.get(mapping.localEntityId), mapping.originalOn)
}

export type LocalRow =
	| { kind: 'single'; mapping: MappingRow; row: ProjectionRow }
	| { kind: 'series'; mapping: MappingRow; row: ProjectionRow; rule: SeriesRule; natural: Date }

export const LESSON_MARKERS = ['single', 'series', 'occurrence']

export function boundRowCondition(connectionId: string): SQL {
	const active = sql`${googleEventMappings.connectionId} = ${connectionId} and ${googleEventMappings.state} = 'active'`
	return sql`(exists (select 1 from ${googleEventMappings} where ${active} and ${googleEventMappings.eventId} = ${googleCalendarEvents.eventId})
or (${googleCalendarEvents.recurringEventId} is not null and exists (select 1 from ${googleEventMappings} where ${active} and ${googleEventMappings.entityKind} = 'series' and ${googleEventMappings.eventId} = ${googleCalendarEvents.recurringEventId}))
or (${googleCalendarEvents.markerLocalId} is not null and ${inArray(googleCalendarEvents.markerKind, LESSON_MARKERS)}))`
}

async function activeMapping(
	executor: DbExecutor,
	connectionId: string,
	entityKind: MappingRow['entityKind'],
	localEntityId: string,
	originalOn?: string
) {
	const [mapping] = await executor
		.select()
		.from(googleEventMappings)
		.where(
			and(
				eq(googleEventMappings.connectionId, connectionId),
				eq(googleEventMappings.entityKind, entityKind),
				eq(googleEventMappings.localEntityId, localEntityId),
				eq(googleEventMappings.state, 'active'),
				originalOn === undefined ? undefined : eq(googleEventMappings.originalOn, originalOn)
			)
		)
	return mapping
}

async function projectionRow(executor: DbExecutor, connectionId: string, condition: SQL | undefined) {
	const [row] = await executor
		.select()
		.from(googleCalendarEvents)
		.where(and(eq(googleCalendarEvents.connectionId, connectionId), condition))
	return row
}

export async function rowForLocal(
	executor: DbExecutor,
	connectionId: string,
	ref: GoogleLocalRef
): Promise<LocalRow | null> {
	if (ref.kind === 'single') {
		const mapping = await activeMapping(executor, connectionId, 'single', ref.lessonId)
		if (!mapping) return null
		const row = await projectionRow(executor, connectionId, eq(googleCalendarEvents.eventId, mapping.eventId))
		return row && row.rowKind === 'single' ? { kind: 'single', mapping, row } : null
	}
	const mapping = await activeMapping(executor, connectionId, 'series', ref.seriesId)
	if (!mapping) return null
	const [series] = await executor.select(seriesColumns).from(lessonSeries).where(eq(lessonSeries.id, ref.seriesId))
	if (!series) return null
	const rule = toSeriesRule(series)
	const natural = seriesStart(rule, ref.originalOn)
	if (!natural) return null
	const occurrence = await activeMapping(executor, connectionId, 'occurrence', ref.seriesId, ref.originalOn)
	const row = await projectionRow(
		executor,
		connectionId,
		and(
			eq(googleCalendarEvents.recurringEventId, mapping.eventId),
			occurrence
				? eq(googleCalendarEvents.eventId, occurrence.eventId)
				: sql`(${googleCalendarEvents.originalStart} ->> 'dateTime')::timestamptz = ${natural.toISOString()}::timestamptz`
		)
	)
	return row ? { kind: 'series', mapping, row, rule, natural } : null
}

type MarkerBinding = { ref: GoogleLocalRef; studentId: string; blocked: BoundEvent['blocked'] } | 'plain' | null

function markerBinding(event: BindInput, snapshot: MappingSnapshot): MarkerBinding {
	const id = event.markerLocalId
	const kind = event.markerKind
	if (!id || !kind) return null
	if (kind === 'event') return 'plain'
	if (!LESSON_MARKERS.includes(kind)) return null
	const entity = snapshot.markers.get(id)
	if (!entity) return null
	const blocked = snapshot.active.has(id) ? null : 'history_only'
	if (entity.kind === 'single') {
		if (kind !== 'single' || event.recurringEventId || !blocked) return 'plain'
		return { ref: { kind: 'single', lessonId: id }, studentId: entity.studentId, blocked }
	}
	const ref = kind === 'single' ? null : seriesRef(event, entity.rule)
	return ref ? { ref, studentId: entity.rule.studentId, blocked } : 'plain'
}

export function bindEvent(event: BindInput, snapshot: MappingSnapshot): BoundEvent {
	const { markerLocalId: _markerLocalId, markerKind: _markerKind, ...provider } = event
	const external = (suggestable: boolean): BoundEvent => ({
		...provider,
		localRef: null,
		studentId: null,
		representationGeneration: null,
		commandId: null,
		bindingKind: 'external',
		blocked: null,
		suggestable,
	})
	const byEvent = snapshot.mappings.filter((row) => row.eventId === event.eventId)
	const byMaster = event.recurringEventId
		? snapshot.mappings.filter((row) => row.entityKind === 'series' && row.eventId === event.recurringEventId)
		: []
	const mapping = byEvent.find((row) => row.state !== 'retired') ?? byMaster.find((row) => row.state !== 'retired')
	if (event.eventType !== 'default') return external(false)
	const timed = Boolean(event.start && 'dateTime' in event.start)
	const transitionFor = (ref: GoogleLocalRef) =>
		snapshot.commands.find((command) => command.plan.affectedRefs.some((affected) => sameRef(affected, ref)))
	if (mapping) {
		const ref = localRef(event, mapping, snapshot)
		if (!ref || !timed) return external(false)
		const pending = snapshot.commands.find((command) => command.id === mapping.commandId) ?? transitionFor(ref) ?? null
		return {
			...provider,
			localRef: ref,
			studentId: mapping.studentId,
			representationGeneration: mapping.representationGeneration,
			commandId: pending?.id ?? mapping.commandId,
			bindingKind: mapping.state === 'reserved' || pending ? 'transition' : 'lesson',
			blocked: null,
			suggestable: false,
		}
	}
	if (byEvent.length || byMaster.length) return external(false)
	const marked = markerBinding(event, snapshot)
	if (marked === 'plain' || (marked && !timed)) return external(false)
	if (!marked) return external(true)
	const pending = transitionFor(marked.ref)
	return {
		...provider,
		localRef: marked.ref,
		studentId: marked.studentId,
		representationGeneration: null,
		commandId: pending?.id ?? null,
		bindingKind: pending ? 'transition' : 'lesson',
		blocked: marked.blocked,
		suggestable: false,
	}
}
