import { eq, sql } from 'drizzle-orm'
import type { z } from 'zod'

import type { ChangeLessonStudentResponse, changeLessonStudentRequest } from '@dv-lab/contracts'
import { type Database, lessonSeries, lessons, students } from '@dv-lab/db'

import { rebindMappingStudent } from '../calendar/event-mapping.ts'
import { lockHistoryConnection } from '../calendar/history.ts'
import { unresolvedCommands } from '../calendar/journal.ts'
import { lockLesson, lockSeries } from './rows.ts'

type StudentInput = z.output<typeof changeLessonStudentRequest>

export type StudentTarget = { kind: 'series'; seriesId: string } | { kind: 'single'; lessonId: string }

export type StudentChangeResult =
	({ kind: 'ok' } & ChangeLessonStudentResponse) | { kind: 'not_found' | 'changed' | 'invalid' | 'command_pending' }

export function changeLessonStudent(
	db: Database,
	accountId: string,
	target: StudentTarget,
	input: StudentInput
): Promise<StudentChangeResult> {
	return db.transaction(async (tx): Promise<StudentChangeResult> => {
		await lockHistoryConnection(tx, accountId)
		if ((await unresolvedCommands(tx, accountId)).length > 0) return { kind: 'command_pending' }
		const [student] = await tx
			.select({ name: students.displayName, status: students.status })
			.from(students)
			.where(eq(students.id, input.studentId))
			.for('share')
		if (!student || student.status !== 'active' || input.studentId === input.expectedStudentId)
			return { kind: 'invalid' }
		const row =
			target.kind === 'series' ? await lockSeries(tx, target.seriesId) : await lockLesson(tx, target.lessonId)
		if (!row) return { kind: 'not_found' }
		if (row.studentId !== input.expectedStudentId) return { kind: 'changed' }
		const set = { studentId: input.studentId, updatedAt: sql`now()` }
		if (target.kind === 'series') {
			await tx.update(lessonSeries).set(set).where(eq(lessonSeries.id, target.seriesId))
			await rebindMappingStudent(tx, accountId, target.seriesId, input.studentId)
		} else {
			await tx.update(lessons).set(set).where(eq(lessons.id, target.lessonId))
			await rebindMappingStudent(tx, accountId, target.lessonId, input.studentId)
		}
		return { kind: 'ok', studentId: input.studentId, studentName: student.name }
	})
}
