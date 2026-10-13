import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import type { LessonComment } from '@dv-lab/contracts'
import { type OccurrenceRef, canChange } from '@dv-lab/core'
import { type DbExecutor, lessonComments, lessonSeries, lessons } from '@dv-lab/db'

import { lockOccurrence } from './changes.ts'
import { lockLesson } from './rows.ts'

export type CommentAppend = { kind: 'ok'; comment: LessonComment } | { kind: 'not_found' } | { kind: 'not_started' }

export type CommentRetraction =
	{ kind: 'retracted'; comment: LessonComment } | { kind: 'changed' } | { kind: 'not_found' }

const columns = {
	id: lessonComments.id,
	seriesId: lessonComments.seriesId,
	originalOn: lessonComments.originalOn,
	lessonId: lessonComments.lessonId,
	body: lessonComments.body,
	revision: lessonComments.revision,
	createdAt: lessonComments.createdAt,
	retractedAt: lessonComments.retractedAt,
}

type CommentRow = {
	id: string
	seriesId: string | null
	originalOn: string | null
	lessonId: string | null
	body: string
	revision: number
	createdAt: Date
	retractedAt: Date | null
}

function refOf(row: CommentRow): OccurrenceRef {
	if (row.seriesId !== null && row.originalOn !== null) {
		return { kind: 'series', seriesId: row.seriesId, originalOn: row.originalOn }
	}
	if (row.lessonId !== null) return { kind: 'single', lessonId: row.lessonId }
	throw new Error('lesson comment has no lesson')
}

const toComment = (row: CommentRow): LessonComment => ({
	id: row.id,
	ref: refOf(row),
	body: row.body,
	revision: row.revision,
	createdAt: row.createdAt.toISOString(),
	retractedAt: row.retractedAt ? row.retractedAt.toISOString() : null,
})

function commentKey(ref: OccurrenceRef) {
	return ref.kind === 'series'
		? and(eq(lessonComments.seriesId, ref.seriesId), eq(lessonComments.originalOn, ref.originalOn))
		: eq(lessonComments.lessonId, ref.lessonId)
}

async function lockSubject(executor: DbExecutor, ref: OccurrenceRef) {
	if (ref.kind === 'series') {
		const locked = await lockOccurrence(executor, ref.seriesId, ref.originalOn)
		if (locked === null || locked.occurrence === null) return null
		return { studentId: locked.occurrence.studentId, startsAt: locked.occurrence.startsAt }
	}
	const lesson = await lockLesson(executor, ref.lessonId)
	return lesson === null ? null : { studentId: lesson.studentId, startsAt: lesson.startsAt }
}

async function lessonExists(executor: DbExecutor, ref: OccurrenceRef): Promise<boolean> {
	const [row] =
		ref.kind === 'series'
			? await executor.select({ id: lessonSeries.id }).from(lessonSeries).where(eq(lessonSeries.id, ref.seriesId))
			: await executor.select({ id: lessons.id }).from(lessons).where(eq(lessons.id, ref.lessonId))
	return row !== undefined
}

export async function appendLessonComment(
	executor: DbExecutor,
	_accountId: string,
	ref: OccurrenceRef,
	body: string,
	now: Date
): Promise<CommentAppend> {
	const subject = await lockSubject(executor, ref)
	if (subject === null) return { kind: 'not_found' }
	if (canChange(subject.startsAt, now)) return { kind: 'not_started' }
	const values =
		ref.kind === 'series'
			? { seriesId: ref.seriesId, originalOn: ref.originalOn, studentId: subject.studentId, body }
			: { lessonId: ref.lessonId, studentId: subject.studentId, body }
	const [row] = await executor.insert(lessonComments).values(values).returning(columns)
	if (!row) throw new Error('lesson comment insert returned no row')
	return { kind: 'ok', comment: toComment(row) }
}

export async function listLessonComments(
	executor: DbExecutor,
	_accountId: string,
	ref: OccurrenceRef
): Promise<LessonComment[] | null> {
	if (!(await lessonExists(executor, ref))) return null
	const rows = await executor
		.select(columns)
		.from(lessonComments)
		.where(and(commentKey(ref), isNull(lessonComments.retractedAt)))
		.orderBy(asc(lessonComments.createdAt), asc(lessonComments.id))
	return rows.map(toComment)
}

export async function retractLessonComment(
	executor: DbExecutor,
	_accountId: string,
	commentId: string,
	expectedRevision: number
): Promise<CommentRetraction> {
	const [locked] = await executor
		.select({ revision: lessonComments.revision, retractedAt: lessonComments.retractedAt })
		.from(lessonComments)
		.where(eq(lessonComments.id, commentId))
		.for('update')
	if (!locked) return { kind: 'not_found' }
	if (locked.retractedAt !== null || locked.revision !== expectedRevision) return { kind: 'changed' }
	const [row] = await executor
		.update(lessonComments)
		.set({ retractedAt: sql`now()`, revision: locked.revision + 1, updatedAt: sql`now()` })
		.where(eq(lessonComments.id, commentId))
		.returning(columns)
	if (!row) throw new Error('lesson comment update returned no row')
	return { kind: 'retracted', comment: toComment(row) }
}
