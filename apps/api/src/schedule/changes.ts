import { sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleOccurrence, lessonActionRequest, moveLessonRequest } from '@dv-lab/contracts'
import {
	type Occurrence,
	SCHEDULE_TIME_ZONE,
	type SeriesException,
	type SeriesRule,
	canChange,
	occurrenceAt,
	zonedInstant,
	zonedParts,
} from '@dv-lab/core'
import { type Database, type DbExecutor, lessonExceptions } from '@dv-lab/db'

import { exceptionColumns, lockSeries, seriesException, toSeriesException } from './rows.ts'

type MoveInput = z.output<typeof moveLessonRequest>

type ActionInput = z.output<typeof lessonActionRequest>

export type ChangeFailure = { kind: 'not_found' } | { kind: 'changed' } | { kind: 'invalid' }

export type OccurrenceResult = { kind: 'ok'; occurrence: ScheduleOccurrence } | ChangeFailure

const NOT_FOUND = { kind: 'not_found' } as const

const CHANGED = { kind: 'changed' } as const

const INVALID = { kind: 'invalid' } as const

function stale(expected: string | undefined, startsAt: Date): boolean {
	return expected !== undefined && new Date(expected).getTime() !== startsAt.getTime()
}

function moveTarget(input: MoveInput, now: Date): Date | null {
	if (input.date < zonedParts(now, SCHEDULE_TIME_ZONE).date) return null
	const target = zonedInstant(input.date, input.startTime, SCHEDULE_TIME_ZONE)
	return canChange(target, now) ? target : null
}

type LockedOccurrence = { rule: SeriesRule; occurrence: Occurrence | null }

async function lockOccurrence(
	executor: DbExecutor,
	seriesId: string,
	originalOn: string
): Promise<LockedOccurrence | null> {
	const rule = await lockSeries(executor, seriesId)
	if (rule === null) return null
	const exception = await seriesException(executor, seriesId, originalOn)
	return { rule, occurrence: occurrenceAt(rule, originalOn, exception ?? undefined) }
}

async function markException(executor: DbExecutor, rule: SeriesRule, exception: SeriesException) {
	const time =
		exception.kind === 'moved' ? { startsAt: exception.startsAt, durationMinutes: exception.durationMinutes } : {}
	const [row] = await executor
		.insert(lessonExceptions)
		.values({ seriesId: exception.seriesId, originalOn: exception.originalOn, kind: exception.kind, ...time })
		.onConflictDoUpdate({
			target: [lessonExceptions.seriesId, lessonExceptions.originalOn],
			set: { kind: exception.kind, ...time, updatedAt: sql`now()` },
		})
		.returning(exceptionColumns)
	if (!row) throw new Error('lesson exception upsert returned no row')
	const occurrence = occurrenceAt(rule, exception.originalOn, toSeriesException(row))
	if (occurrence === null) throw new Error('changed occurrence is outside its series')
	return {
		kind: 'ok',
		occurrence: {
			seriesId: rule.id,
			originalOn: exception.originalOn,
			status: occurrence.status,
			startsAt: occurrence.startsAt.toISOString(),
		},
	} satisfies OccurrenceResult
}

export function moveOccurrence(
	db: Database,
	seriesId: string,
	originalOn: string,
	input: MoveInput,
	now: Date
): Promise<OccurrenceResult> {
	return db.transaction(async (tx): Promise<OccurrenceResult> => {
		const locked = await lockOccurrence(tx, seriesId, originalOn)
		if (locked === null) return NOT_FOUND
		const { rule, occurrence } = locked
		if (
			occurrence === null ||
			occurrence.status === 'cancelled' ||
			!canChange(occurrence.startsAt, now) ||
			stale(input.expectedStartsAt, occurrence.startsAt)
		) {
			return CHANGED
		}
		const target = moveTarget(input, now)
		if (target === null || target.getTime() === occurrence.startsAt.getTime()) return INVALID
		const exception: SeriesException =
			target.getTime() === occurrence.naturalStart.getTime()
				? { seriesId, originalOn, kind: 'restored' }
				: { seriesId, originalOn, kind: 'moved', startsAt: target, durationMinutes: occurrence.durationMinutes }
		return markException(tx, rule, exception)
	})
}

export function cancelOccurrence(
	db: Database,
	seriesId: string,
	originalOn: string,
	input: ActionInput,
	now: Date
): Promise<OccurrenceResult> {
	return db.transaction(async (tx): Promise<OccurrenceResult> => {
		const locked = await lockOccurrence(tx, seriesId, originalOn)
		if (locked === null) return NOT_FOUND
		const { rule, occurrence } = locked
		if (
			occurrence === null ||
			occurrence.status === 'cancelled' ||
			!canChange(occurrence.startsAt, now) ||
			stale(input.expectedStartsAt, occurrence.startsAt)
		) {
			return CHANGED
		}
		return markException(tx, rule, { seriesId, originalOn, kind: 'cancelled' })
	})
}

export function restoreOccurrence(
	db: Database,
	seriesId: string,
	originalOn: string,
	input: ActionInput,
	now: Date
): Promise<OccurrenceResult> {
	return db.transaction(async (tx): Promise<OccurrenceResult> => {
		const locked = await lockOccurrence(tx, seriesId, originalOn)
		if (locked === null) return NOT_FOUND
		const { rule, occurrence } = locked
		if (
			occurrence === null ||
			occurrence.status !== 'cancelled' ||
			!canChange(occurrence.naturalStart, now) ||
			stale(input.expectedStartsAt, occurrence.naturalStart)
		) {
			return CHANGED
		}
		return markException(tx, rule, { seriesId, originalOn, kind: 'restored' })
	})
}
