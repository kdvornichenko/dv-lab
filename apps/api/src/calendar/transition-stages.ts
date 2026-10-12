import { scheduleDate } from '@dv-lab/core'
import { googleStageRequest, type GoogleCommandPlan, type GoogleCutPlan, type GoogleObservedResource } from '@dv-lab/db'

import type { PreparedCalendarCommand } from '../schedule/command-plan.ts'
import { cutWrite } from '../schedule/series-command.ts'
import { CommandFault, digest } from './journal.ts'
import { masterRepresentation } from './recurring.ts'

type Reservation = GoogleCommandPlan['reservations'][number]
type Lineage = GoogleCommandPlan['lineage'][number]
export type TransitionStep =
	| { purpose: 'cancelled_prefix'; stage: number; prefixCancellation: GoogleCutPlan['cancelledPrefix'][number] }
	| { purpose: 'capture' | 'inactive' | 'complete'; stage: number }
	| { purpose: 'tail' | 'trim' | 'prefix'; stage: number; source: GoogleObservedResource }
	| { purpose: 'insert' | 'cancel_insert'; stage: number; reservation: Reservation; lineage: Lineage | null }

export function transitionSteps(command: PreparedCalendarCommand): TransitionStep[] {
	const cut = command.plan.cut
	if (!cut || !command.plan.capturedRule || !command.plan.oldEndsOn) throw new CommandFault('precondition_failed')
	const steps: TransitionStep[] = [{ purpose: 'capture', stage: 0 }]
	for (const source of cut.tail.filter((item) => item.event.status !== 'cancelled'))
		steps.push({ purpose: 'tail', stage: steps.length * 3 - 2, source })
	steps.push({ purpose: 'trim', stage: steps.length * 3 - 2, source: cut.master })
	steps.push({ purpose: 'inactive', stage: steps.length * 3 - 2 })
	for (const reservation of command.plan.reservations) {
		const lineage =
			command.plan.lineage.find(
				(item) => item.to.kind === 'single' && item.to.lessonId === reservation.localEntityId
			) ?? null
		steps.push({ purpose: 'insert', stage: steps.length * 3 - 2, reservation, lineage })
		if (lineage?.status === 'cancelled')
			steps.push({ purpose: 'cancel_insert', stage: steps.length * 3 - 2, reservation, lineage })
	}
	for (const source of cut.prefix) steps.push({ purpose: 'prefix', stage: steps.length * 3 - 2, source })
	for (const prefixCancellation of cut.cancelledPrefix)
		steps.push({ purpose: 'cancelled_prefix', stage: steps.length * 3 - 2, prefixCancellation })
	steps.push({ purpose: 'complete', stage: steps.length * 3 - 2 })
	return steps
}

function originalIdentity(command: PreparedCalendarCommand, source: GoogleObservedResource) {
	const markers = command.plan.cut?.master.privateProperties
	if (!markers) throw new CommandFault('precondition_failed')
	return {
		entityKind: source.event.recurringEventId ? ('occurrence' as const) : ('series' as const),
		localEntityId: markers.dvLocalId,
		representationGeneration: Number(markers.dvGeneration),
	}
}

export function transitionPatch(
	command: PreparedCalendarCommand,
	step: Extract<TransitionStep, { source: GoogleObservedResource }>,
	source: GoogleObservedResource
) {
	const rule = command.plan.capturedRule
	if (!rule || !command.plan.oldEndsOn) throw new CommandFault('precondition_failed')
	if (step.purpose === 'trim') {
		const trimmed = masterRepresentation({ ...rule, endsOn: command.plan.oldEndsOn })
		return cutWrite(command.id, step.stage, source, originalIdentity(command, source), trimmed?.recurrence)
	}
	if (step.purpose === 'tail') return cutWrite(command.id, step.stage, source, originalIdentity(command, source))
	const desired = step.source
	const event = desired.event
	if (!event.start || !event.end || event.summary === null || event.status === 'tentative' || !desired.unownedWritable)
		throw new CommandFault('external_change')
	const payload = {
		summary: event.summary,
		start: event.start,
		end: event.end,
		status: event.status,
		preserved: desired.unownedWritable,
	}
	const hash = digest(JSON.stringify({ eventId: source.event.eventId, ...payload }))
	const original = event.originalStartTime
	if (!original || !('dateTime' in original)) throw new CommandFault('external_change')
	const request = googleStageRequest.parse({
		method: 'patch',
		eventId: source.event.eventId,
		ifMatch: source.event.etag,
		digest: hash,
		instance: {
			masterEventId: event.recurringEventId,
			originalOn: scheduleDate(new Date(original.dateTime), rule.timeZone),
			originalStartTime: original,
			lookupVerified: true,
		},
		...(event.status === 'cancelled'
			? {
					cancellationBaseline: {
						baselineEvent: source.event,
						unownedWritableFingerprint: desired.unownedWritableFingerprint,
						unownedWritable: desired.unownedWritable,
					},
				}
			: {}),
		payload: {
			...payload,
			markers: {
				...originalIdentity(command, source),
				commandId: command.id,
				stage: step.stage,
				digest: hash,
				schemaVersion: 1,
			},
		},
	})
	if (request.method !== 'patch') throw new CommandFault('precondition_failed')
	return request
}

export function transitionInsert(
	command: PreparedCalendarCommand,
	step: Extract<TransitionStep, { reservation: Reservation }>
) {
	const cut = command.plan.cut
	if (!cut) throw new CommandFault('precondition_failed')
	const reserved = step.reservation
	const lineage = step.lineage
	const originalOn = lineage?.from.kind === 'series' ? lineage.from.originalOn : null
	const current = cut.tail.find(
		(item) =>
			item.event.originalStartTime &&
			'dateTime' in item.event.originalStartTime &&
			scheduleDate(new Date(item.event.originalStartTime.dateTime), command.plan.capturedTimeZone) === originalOn
	)
	const historical = cut.cancelledTail.find((item) => item.originalOn === originalOn)
	const snapshot =
		reserved.entityKind === 'series'
			? cut.master
			: (current ??
				(historical ? { event: historical.baselineEvent, unownedWritable: historical.unownedWritable } : null))
	if (!snapshot?.unownedWritable || snapshot.event.summary === null) throw new CommandFault('external_change')
	const master = command.plan.newRule ? masterRepresentation(command.plan.newRule) : null
	const time =
		reserved.entityKind === 'series' && master
			? { start: master.start, end: master.end, recurrence: master.recurrence }
			: lineage
				? {
						start: { dateTime: lineage.startsAt, timeZone: lineage.timeZone },
						end: {
							dateTime: new Date(Date.parse(lineage.startsAt) + lineage.durationMinutes * 60000).toISOString(),
							timeZone: lineage.timeZone,
						},
					}
				: null
	if (!time) throw new CommandFault('precondition_failed')
	const payload = {
		summary: snapshot.event.summary,
		...time,
		status: 'confirmed' as const,
		preserved: snapshot.unownedWritable,
	}
	const hash = digest(JSON.stringify({ eventId: reserved.eventId, ...payload }))
	const request = googleStageRequest.parse({
		method: 'insert',
		eventId: reserved.eventId,
		digest: hash,
		payload: {
			...payload,
			markers: {
				entityKind: reserved.entityKind,
				localEntityId: reserved.localEntityId,
				representationGeneration: reserved.representationGeneration,
				commandId: command.id,
				stage: step.stage,
				digest: hash,
				schemaVersion: 1,
			},
		},
	})
	if (request.method !== 'insert') throw new CommandFault('precondition_failed')
	return request
}

export function cancelDetached(
	command: PreparedCalendarCommand,
	step: Extract<TransitionStep, { reservation: Reservation }>,
	source: GoogleObservedResource
) {
	return cutWrite(command.id, step.stage, source, {
		entityKind: 'single',
		localEntityId: step.reservation.localEntityId,
		representationGeneration: step.reservation.representationGeneration,
	})
}
