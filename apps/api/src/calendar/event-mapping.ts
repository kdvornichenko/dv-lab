import { and, eq, inArray, notInArray } from 'drizzle-orm'

import { occurrenceAt, scheduleDate, type SeriesRule } from '@dv-lab/core'
import { googleCommands, googleEventMappings, type DbExecutor, type GoogleLocalRef } from '@dv-lab/db'
import { lessonSeries } from '@dv-lab/db'

import { seriesColumns, toSeriesRule } from '../schedule/rows.ts'
import type { ProviderEvent } from './provider-events.ts'
import type { MappingRow } from './read-state.ts'

export type MappingSnapshot = Awaited<ReturnType<typeof loadMappings>>
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
