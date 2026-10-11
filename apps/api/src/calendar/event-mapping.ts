import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'

import { occurrenceAt, scheduleDate, type SeriesRule } from '@dv-lab/core'
import {
	googleCommands,
	googleEventMappings,
	googleCommandPlan,
	googleStageRequest,
	type DbExecutor,
	type GoogleLocalRef,
} from '@dv-lab/db'
import { lessonSeries } from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { seriesColumns, toSeriesRule } from '../schedule/rows.ts'
import { CommandFault, digest } from './journal.ts'
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
	const stageDigest = digest(JSON.stringify({ eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'insert',
		eventId,
		digest: stageDigest,
		payload: { ...payload, markers: { ...markers, representationGeneration: generation, stage, digest: stageDigest } },
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
	await executor
		.insert(googleEventMappings)
		.values({
			...reservation,
			accountId: command.accountId,
			connectionId: command.connectionId,
			calendarId: command.calendarId,
			commandId: command.id,
			studentId: old.studentId,
		})
}

export type MappingSnapshot = Awaited<ReturnType<typeof loadMappings>>

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
export type BoundEvent = ProviderEvent & {
	localRef: GoogleLocalRef | null
	studentId: string | null
	representationGeneration: number | null
	commandId: string | null
	bindingKind: 'lesson' | 'transition' | 'external'
}

export async function loadMappings(executor: DbExecutor, accountId: string, connectionId: string) {
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
	return {
		mappings,
		commands,
		series: new Map<string, SeriesRule>(series.map((row) => [row.id, toSeriesRule(row)])),
	}
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

function localRef(event: ProviderEvent, mapping: MappingRow, snapshot: MappingSnapshot): GoogleLocalRef | null {
	if (mapping.entityKind === 'single') {
		return event.recurringEventId ? null : { kind: 'single', lessonId: mapping.localEntityId }
	}
	const rule = snapshot.series.get(mapping.localEntityId)
	const original = event.originalStartTime
	if (!rule || !original || !('dateTime' in original)) return null
	if (mapping.entityKind === 'occurrence' && mapping.recurringEventId !== event.recurringEventId) return null
	const originalOn = scheduleDate(new Date(original.dateTime), rule.timeZone)
	if (mapping.originalOn && mapping.originalOn !== originalOn) return null
	if (!occurrenceAt(rule, originalOn)) return null
	return { kind: 'series', seriesId: mapping.localEntityId, originalOn }
}

export function pendingStudents(snapshot: MappingSnapshot): ReadonlySet<string> {
	const students = new Set(snapshot.mappings.filter((row) => row.state === 'reserved').map((row) => row.studentId))
	for (const command of snapshot.commands) {
		if (command.plan.input.operation === 'create') students.add(command.plan.input.studentId)
		for (const ref of command.plan.affectedRefs) {
			const entityId = ref.kind === 'single' ? ref.lessonId : ref.seriesId
			for (const mapping of snapshot.mappings) {
				if (mapping.localEntityId === entityId) students.add(mapping.studentId)
			}
		}
	}
	return students
}

export function bindEvent(event: ProviderEvent, snapshot: MappingSnapshot): BoundEvent {
	const external: BoundEvent = {
		...event,
		localRef: null,
		studentId: null,
		representationGeneration: null,
		commandId: null,
		bindingKind: 'external',
	}
	const mapping =
		snapshot.mappings.find((row) => row.eventId === event.eventId) ??
		snapshot.mappings.find((row) => row.entityKind === 'series' && row.eventId === event.recurringEventId)
	if (!mapping || mapping.state === 'retired' || event.eventType !== 'default') return external
	const ref = localRef(event, mapping, snapshot)
	if (!ref || !event.start || !('dateTime' in event.start)) return external
	const pending = snapshot.commands.find(
		(command) =>
			command.id === mapping.commandId || command.plan.affectedRefs.some((affected) => sameRef(affected, ref))
	)
	const transition = mapping.state === 'reserved' || Boolean(pending)
	return {
		...event,
		localRef: ref,
		studentId: mapping.studentId,
		representationGeneration: mapping.representationGeneration,
		commandId: pending?.id ?? mapping.commandId,
		bindingKind: transition ? 'transition' : 'lesson',
	}
}
