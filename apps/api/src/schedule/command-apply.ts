import { and, eq, sql } from 'drizzle-orm'

import {
	googleCommands,
	googleConnections,
	lessons,
	lessonSeries,
	type DbExecutor,
	type GoogleCommandPlan,
} from '@dv-lab/db'

import type { VerifiedGoogleResult, WriteAcknowledgement } from '../calendar/command-result.ts'
import { confirmEventMapping, confirmOccurrenceMapping } from '../calendar/event-mapping.ts'
import { CommandFault } from '../calendar/journal.ts'
import { advanceCommandRevision } from '../calendar/read-store.ts'
import { applyLessonChange } from './changes.ts'
import type { PreparedCalendarCommand } from './command-plan.ts'
import { applyOccurrenceChange } from './occurrence-change.ts'

export async function applyConfirmedCommand(
	tx: DbExecutor,
	command: PreparedCalendarCommand,
	confirmation: VerifiedGoogleResult
): Promise<void> {
	const [connection] = await tx
		.select()
		.from(googleConnections)
		.where(and(eq(googleConnections.id, command.connectionId), eq(googleConnections.accountId, command.accountId)))
		.for('update')
	if (
		!connection ||
		connection.state !== 'connected' ||
		connection.generation !== confirmation.generation ||
		connection.calendarId !== command.calendarId
	)
		throw new CommandFault('reconnect_required')
	const [current] = await tx
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.id, command.id), eq(googleCommands.accountId, command.accountId)))
		.for('update')
	if (current?.state === 'applied') return
	if (
		!current ||
		current.state !== 'projection_pending' ||
		confirmation.commandId !== command.id ||
		confirmation.acknowledgement.ownedDigest !== command.request.digest
	)
		throw new CommandFault('precondition_failed')
	const input = command.plan.input
	if (confirmation.acknowledgement.kind === 'cancellation' && input.operation !== 'cancel')
		throw new CommandFault('precondition_failed')
	if (input.operation === 'create') {
		await applyCreation(tx, command, input, confirmation.acknowledgement)
	} else {
		await applySingle(tx, command)
		if (command.request.method === 'insert')
			await confirmEventMapping(tx, command.accountId, command.id, confirmedEvent(confirmation.acknowledgement).eventId)
	}
	const confirmedRevision = await advanceCommandRevision(
		tx,
		command.accountId,
		command.connectionId,
		confirmation.generation
	)
	await tx
		.update(googleCommands)
		.set({
			state: 'applied',
			effect: 'confirmed',
			issue: null,
			nextAction: 'none',
			confirmedRevision,
			appliedAt: sql`now()`,
			updatedAt: sql`now()`,
		})
		.where(eq(googleCommands.id, command.id))
}

function confirmedEvent(ack: WriteAcknowledgement) {
	if (ack.kind !== 'event' && ack.kind !== 'master') throw new CommandFault('precondition_failed')
	return ack.event
}

async function applyCreation(
	tx: DbExecutor,
	command: PreparedCalendarCommand,
	input: Extract<GoogleCommandPlan['input'], { operation: 'create' }>,
	ack: WriteAcknowledgement
) {
	const reservation = command.plan.reservations[0]
	const event = confirmedEvent(ack)
	if (!reservation || !event.start || !('dateTime' in event.start) || event.eventId !== reservation.eventId)
		throw new CommandFault('precondition_failed')
	if (input.repeats === 'weekly') {
		if (reservation.entityKind !== 'series' || !command.plan.capturedRule || ack.kind !== 'master')
			throw new CommandFault('precondition_failed')
		await tx
			.insert(lessonSeries)
			.values({ id: reservation.localEntityId, studentId: input.studentId, ...command.plan.capturedRule })
	} else {
		if (reservation.entityKind !== 'single') throw new CommandFault('precondition_failed')
		await tx.insert(lessons).values({
			id: reservation.localEntityId,
			studentId: input.studentId,
			startsAt: new Date(event.start.dateTime),
			timeZone: command.plan.capturedTimeZone,
			durationMinutes: input.durationMinutes,
			status: 'scheduled',
		})
	}
	await confirmEventMapping(tx, command.accountId, command.id, event.eventId)
}

async function applySingle(tx: DbExecutor, command: PreparedCalendarCommand) {
	const input = command.plan.input
	if (input.operation !== 'move' && input.operation !== 'cancel' && input.operation !== 'restore')
		throw new CommandFault('precondition_failed')
	const lineage = command.plan.lineage[0]
	if (input.ref.kind === 'series') {
		const instance = command.request.method === 'patch' ? command.request.instance : undefined
		if (
			!instance?.lookupVerified ||
			!lineage ||
			lineage.to.kind !== 'series' ||
			lineage.to.seriesId !== input.ref.seriesId ||
			lineage.to.originalOn !== input.ref.originalOn
		)
			throw new CommandFault('precondition_failed')
		await confirmOccurrenceMapping(tx, command)
		await applyOccurrenceChange(tx, input, command.plan)
		return
	}
	if (!lineage || lineage.to.kind !== 'single' || lineage.to.lessonId !== input.ref.lessonId)
		throw new CommandFault('precondition_failed')
	await applyLessonChange(
		tx,
		input.ref.lessonId,
		input.operation === 'move'
			? { startsAt: new Date(lineage.startsAt) }
			: { status: input.operation === 'cancel' ? 'cancelled' : 'scheduled' }
	)
}
