import { and, eq, gte, inArray, sql } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'

import { occurrenceAt, type SeriesRule } from '@dv-lab/core'
import {
	googleCommands,
	googleConnections,
	googleEventMappings,
	googleSeriesRule,
	lessonSeries,
	lessonExceptions,
	lessonMarks,
	lessons,
	type DbExecutor,
} from '@dv-lab/db'

import { confirmEventMapping } from '../calendar/event-mapping.ts'
import { CommandFault } from '../calendar/journal.ts'
import { advanceCommandRevision } from '../calendar/read-store.ts'
import type { PreparedCalendarCommand } from './command-plan.ts'
import { requireCutProof } from './cut-proof.ts'
import { lockSeries, toSeriesException } from './rows.ts'

export async function applyConfirmedCut(tx: DbExecutor, command: PreparedCalendarCommand) {
	const [connection] = await tx
		.select()
		.from(googleConnections)
		.where(and(eq(googleConnections.id, command.connectionId), eq(googleConnections.accountId, command.accountId)))
		.for('update')
	const [current] = await tx
		.select()
		.from(googleCommands)
		.where(and(eq(googleCommands.id, command.id), eq(googleCommands.accountId, command.accountId)))
		.for('update')
	if (current?.state === 'applied') return
	if (!current || current.state !== 'projection_pending' || !isDeepStrictEqual(current.plan, command.plan))
		throw new CommandFault('precondition_failed')
	if (!connection || connection.state !== 'connected' || connection.calendarId !== command.calendarId)
		throw new CommandFault('reconnect_required')
	await requireCutProof(tx, command, connection.generation, connection.credentialGeneration)
	const input = command.plan.input
	const cut = command.plan.cut
	if (!cut || !('seriesId' in input) || !command.plan.oldEndsOn || !command.plan.capturedRule)
		throw new CommandFault('precondition_failed')
	const old = await lockSeries(tx, input.seriesId)
	if (
		!old ||
		old.studentId !== cut.studentId ||
		!isDeepStrictEqual(
			googleSeriesRule.parse({
				weekday: old.weekday,
				startTime: old.startTime,
				timeZone: old.timeZone,
				durationMinutes: old.durationMinutes,
				startsOn: old.startsOn,
				endsOn: old.endsOn,
			}),
			command.plan.capturedRule
		)
	)
		throw new CommandFault('precondition_failed')
	const marks = await currentTail(tx, command, old)
	await lockReservations(tx, command)
	await tx
		.update(lessonSeries)
		.set({ endsOn: command.plan.oldEndsOn, updatedAt: sql`now()` })
		.where(eq(lessonSeries.id, old.id))
	await insertDomain(tx, command, marks)
	await retireOldTail(tx, command, old)
	const confirmedRevision = await advanceCommandRevision(
		tx,
		command.accountId,
		command.connectionId,
		connection.generation
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

async function currentTail(tx: DbExecutor, command: PreparedCalendarCommand, old: SeriesRule) {
	const cut = command.plan.cut!
	const exceptions = await tx
		.select()
		.from(lessonExceptions)
		.where(and(eq(lessonExceptions.seriesId, old.id), gte(lessonExceptions.originalOn, cut.cutoff)))
		.for('update')
	const marks = await tx
		.select()
		.from(lessonMarks)
		.where(and(eq(lessonMarks.seriesId, old.id), gte(lessonMarks.originalOn, cut.cutoff)))
		.for('update')
	const index = new Map(exceptions.map((row) => [row.originalOn, toSeriesException(row)]))
	const markIndex = new Map(marks.filter((row) => row.originalOn !== null).map((row) => [row.originalOn!, row.kind]))
	for (const date of new Set([...index.keys(), ...markIndex.keys()])) {
		const exception = index.get(date)
		const occurrence = occurrenceAt(old, date, exception)
		if (!occurrence || (!exception && (!markIndex.has(date) || markIndex.get(date) === 'none'))) continue
		const lineage = command.plan.lineage.find((item) => item.from.kind === 'series' && item.from.originalOn === date)
		if (
			!lineage ||
			lineage.startsAt !== occurrence.startsAt.toISOString() ||
			lineage.durationMinutes !== occurrence.durationMinutes ||
			lineage.timeZone !== occurrence.timeZone ||
			(lineage.status ?? 'scheduled') !== occurrence.status
		)
			throw new CommandFault('external_change')
	}
	return markIndex
}

async function lockReservations(tx: DbExecutor, command: PreparedCalendarCommand) {
	const ids = command.plan.reservations.map((item) => item.localEntityId)
	if (!ids.length) return
	const mappings = await tx
		.select()
		.from(googleEventMappings)
		.where(and(eq(googleEventMappings.commandId, command.id), inArray(googleEventMappings.localEntityId, ids)))
		.for('update')
	if (mappings.length !== ids.length || mappings.some((item) => item.state !== 'reserved'))
		throw new CommandFault('precondition_failed')
	const existingSeries = await tx
		.select({ id: lessonSeries.id })
		.from(lessonSeries)
		.where(inArray(lessonSeries.id, ids))
		.for('update')
	const existingLessons = await tx
		.select({ id: lessons.id })
		.from(lessons)
		.where(inArray(lessons.id, ids))
		.for('update')
	if (existingSeries.length || existingLessons.length) throw new CommandFault('precondition_failed')
}

async function insertDomain(tx: DbExecutor, command: PreparedCalendarCommand, marks: ReadonlyMap<string, string>) {
	for (const reservation of command.plan.reservations) {
		if (reservation.entityKind === 'series') {
			if (!command.plan.newRule) throw new CommandFault('precondition_failed')
			await tx
				.insert(lessonSeries)
				.values({ id: reservation.localEntityId, studentId: command.plan.cut!.studentId, ...command.plan.newRule })
		} else {
			const lineage = command.plan.lineage.find(
				(item) => item.to.kind === 'single' && item.to.lessonId === reservation.localEntityId
			)
			if (!lineage || lineage.from.kind !== 'series') throw new CommandFault('precondition_failed')
			await tx.insert(lessons).values({
				id: reservation.localEntityId,
				studentId: command.plan.cut!.studentId,
				startsAt: new Date(lineage.startsAt),
				timeZone: lineage.timeZone,
				durationMinutes: lineage.durationMinutes,
				status: lineage.status ?? 'scheduled',
			})
			const mark = marks.get(lineage.from.originalOn)
			if (mark !== undefined) await tx.insert(lessonMarks).values({ lessonId: reservation.localEntityId, kind: mark })
		}
		await confirmEventMapping(tx, command.accountId, command.id, reservation.eventId)
	}
}

async function retireOldTail(tx: DbExecutor, command: PreparedCalendarCommand, old: SeriesRule) {
	await tx
		.update(googleEventMappings)
		.set({ state: 'retired', retiredAt: sql`now()` })
		.where(
			and(
				eq(googleEventMappings.accountId, command.accountId),
				eq(googleEventMappings.connectionId, command.connectionId),
				eq(googleEventMappings.localEntityId, old.id),
				eq(googleEventMappings.entityKind, 'occurrence'),
				gte(googleEventMappings.originalOn, command.plan.cut!.cutoff)
			)
		)
	if (command.plan.oldEndsOn! < old.startsOn)
		await tx
			.update(googleEventMappings)
			.set({ state: 'retired', retiredAt: sql`now()` })
			.where(
				and(
					eq(googleEventMappings.accountId, command.accountId),
					eq(googleEventMappings.connectionId, command.connectionId),
					eq(googleEventMappings.localEntityId, old.id),
					eq(googleEventMappings.entityKind, 'series')
				)
			)
}
