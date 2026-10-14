import { type SQL, and, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ScheduleMark, markLessonRequest } from '@dv-lab/contracts'
import {
	type LessonOutcome,
	type MarkKind,
	type OccurrenceRef,
	canChange,
	countsAsLesson,
	lessonActions,
	occurrenceOutcome,
	occurrenceKey,
} from '@dv-lab/core'
import { type Database, type DbExecutor, lessonMarks } from '@dv-lab/db'

import { historyEligibility, lockHistoryConnection } from '../calendar/history.ts'
import { CommandFault } from '../calendar/journal.ts'
import { type ChangeFailure, lockOccurrence, stale } from './changes.ts'
import { type MarkState, lockLesson, markKey, markStateOf, toMarkKind, toWireMark, toWireOutcome } from './rows.ts'

type MarkInput = z.output<typeof markLessonRequest>

export type MarkResult = { kind: 'ok'; mark: ScheduleMark; before: MarkState | null } | ChangeFailure

export type MarkRestore = { kind: 'no_show'; revision: number }

const NOT_FOUND = { kind: 'not_found' } as const

const CHANGED = { kind: 'changed' } as const

const NOT_STARTED = { kind: 'not_started' } as const

const NEXT_REVISION = sql`${lessonMarks.revision} + 1`

function markRefusal(outcome: LessonOutcome, startsAt: Date, expected: string | undefined, now: Date) {
	if (stale(expected, startsAt)) return CHANGED
	if (lessonActions(outcome, startsAt, now).mark) return null
	return countsAsLesson(outcome) ? NOT_STARTED : CHANGED
}

export async function putMark(executor: DbExecutor, ref: OccurrenceRef, kind: MarkKind): Promise<MarkState> {
	const set = { kind, revision: NEXT_REVISION, updatedAt: sql`now()` }
	const insert = executor.insert(lessonMarks)
	const returning = { kind: lessonMarks.kind, revision: lessonMarks.revision }
	const [row] =
		ref.kind === 'series'
			? await insert
					.values({ seriesId: ref.seriesId, originalOn: ref.originalOn, kind, revision: 1 })
					.onConflictDoUpdate({ target: [lessonMarks.seriesId, lessonMarks.originalOn], set })
					.returning(returning)
			: await insert
					.values({ lessonId: ref.lessonId, kind, revision: 1 })
					.onConflictDoUpdate({ target: lessonMarks.lessonId, set })
					.returning(returning)
	if (!row) throw new Error('lesson mark upsert returned no row')
	return { kind: toMarkKind(row.kind), revision: row.revision }
}

async function changeMark(executor: DbExecutor, ref: OccurrenceRef, kind: MarkKind, condition: SQL | undefined) {
	await executor
		.update(lessonMarks)
		.set({ kind, revision: NEXT_REVISION, updatedAt: sql`now()` })
		.where(and(markKey(ref), condition))
}

async function lockSubject(executor: DbExecutor, ref: OccurrenceRef) {
	if (ref.kind === 'series') {
		const locked = await lockOccurrence(executor, ref.seriesId, ref.originalOn)
		if (locked === null) return NOT_FOUND
		return locked.occurrence ?? CHANGED
	}
	const lesson = await lockLesson(executor, ref.lessonId)
	return lesson === null ? NOT_FOUND : { ...lesson, ref }
}

export async function writeMark(
	executor: DbExecutor,
	accountId: string,
	ref: OccurrenceRef,
	input: MarkInput,
	now: Date
): Promise<MarkResult> {
	await lockHistoryConnection(executor, accountId)
	const subject = await lockSubject(executor, ref)
	if (!('ref' in subject)) return subject
	const before = await markStateOf(executor, subject.ref, true)
	const mark = before?.kind ?? null
	const eligible = await historyEligibility(executor, accountId, [{ ...subject, mark }], 'write')
	if (!eligible.has(occurrenceKey(subject.ref))) return CHANGED
	const refused = markRefusal(occurrenceOutcome(subject, mark), subject.startsAt, input.expectedStartsAt, now)
	if (refused !== null) return refused
	if (input.expectedRevision !== undefined && input.expectedRevision !== (before?.revision ?? null)) return CHANGED
	const saved = await putMark(executor, subject.ref, toMarkKind(input.kind))
	return {
		kind: 'ok',
		mark: {
			ref: subject.ref,
			kind: toWireMark(saved.kind),
			outcome: toWireOutcome(occurrenceOutcome(subject, saved.kind)),
			revision: saved.revision,
		},
		before,
	}
}

export async function settleMarkAfterMove(executor: DbExecutor, ref: OccurrenceRef): Promise<void> {
	await changeMark(executor, ref, 'none', eq(lessonMarks.kind, 'no_show'))
}

export async function checkMarkRestore(
	executor: DbExecutor,
	ref: OccurrenceRef,
	restore: MarkRestore,
	targetStartsAt: Date,
	now: Date
): Promise<void> {
	const current = await markStateOf(executor, ref, true)
	if (current?.kind !== 'none' || current.revision !== restore.revision || canChange(targetStartsAt, now))
		throw new CommandFault('precondition_failed')
}

export async function restoreMarkAfterMove(
	executor: DbExecutor,
	ref: OccurrenceRef,
	restore: MarkRestore
): Promise<void> {
	await changeMark(
		executor,
		ref,
		restore.kind,
		and(eq(lessonMarks.kind, 'none'), eq(lessonMarks.revision, restore.revision))
	)
}

export function markOccurrence(
	db: Database,
	accountId: string,
	seriesId: string,
	originalOn: string,
	input: MarkInput,
	now: Date
): Promise<MarkResult> {
	return db.transaction((tx) => writeMark(tx, accountId, { kind: 'series', seriesId, originalOn }, input, now))
}

export function markLesson(
	db: Database,
	accountId: string,
	id: string,
	input: MarkInput,
	now: Date
): Promise<MarkResult> {
	return db.transaction((tx) => writeMark(tx, accountId, { kind: 'single', lessonId: id }, input, now))
}
