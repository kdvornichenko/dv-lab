import { sql } from 'drizzle-orm'
import { check, date, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { lessonSeries, lessons, students } from './schema.ts'

export const studentNotes = pgTable(
	'student_notes',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		sectionKind: text('section_kind').notNull(),
		body: text('body').notNull(),
		revision: integer('revision').notNull().default(1),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
		retractedAt: timestamp('retracted_at', { withTimezone: true }),
	},
	(table) => [
		index('student_notes_student_created_idx').on(table.studentId, table.createdAt, table.id),
		check(
			'student_notes_section_kind_ck',
			sql`${table.sectionKind} in ('general_info', 'interests', 'level', 'goals', 'typical_mistakes', 'lesson_ideas')`
		),
		check('student_notes_body_ck', sql`char_length(${table.body}) between 1 and 2000`),
		check('student_notes_revision_ck', sql`${table.revision} >= 1`),
	]
)

export const lessonComments = pgTable(
	'lesson_comments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		seriesId: uuid('series_id').references(() => lessonSeries.id, { onDelete: 'restrict' }),
		originalOn: date('original_on'),
		lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'restrict' }),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		body: text('body').notNull(),
		revision: integer('revision').notNull().default(1),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
		retractedAt: timestamp('retracted_at', { withTimezone: true }),
	},
	(table) => [
		index('lesson_comments_occurrence_idx').on(table.seriesId, table.originalOn),
		index('lesson_comments_lesson_idx').on(table.lessonId),
		index('lesson_comments_student_idx').on(table.studentId),
		check('lesson_comments_body_ck', sql`char_length(${table.body}) between 1 and 2000`),
		check('lesson_comments_revision_ck', sql`${table.revision} >= 1`),
		check(
			'lesson_comments_ref_ck',
			sql`(${table.seriesId} is null) = (${table.originalOn} is null) and (${table.seriesId} is null) <> (${table.lessonId} is null)`
		),
	]
)
