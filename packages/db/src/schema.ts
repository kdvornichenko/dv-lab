import { relations, sql } from 'drizzle-orm'
import {
	boolean,
	date,
	foreignKey,
	index,
	integer,
	numeric,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

export const studentStatus = pgEnum('student_status', ['active', 'paused', 'archived'])
export const billingMode = pgEnum('billing_mode', ['per_lesson', 'monthly', 'package'])
export const lessonStatus = pgEnum('lesson_status', ['planned', 'completed', 'cancelled', 'rescheduled'])
export const attendanceStatus = pgEnum('attendance_status', [
	'planned',
	'attended',
	'absent',
	'cancelled',
	'rescheduled',
])
export const paymentMethod = pgEnum('payment_method', ['cash', 'bank_transfer', 'card', 'other'])
export const calendarProvider = pgEnum('calendar_provider', ['google'])
export const calendarConnectionStatus = pgEnum('calendar_connection_status', [
	'not_connected',
	'authorization_required',
	'connected',
	'expired',
	'error',
])
export const calendarSyncStatus = pgEnum('calendar_sync_status', ['not_synced', 'synced', 'failed', 'disabled'])

export const teacherProfiles = pgTable('teacher_profiles', {
	id: uuid('id').primaryKey().defaultRandom(),
	authUserId: uuid('auth_user_id').notNull().unique(),
	email: text('email'),
	displayName: text('display_name'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const students = pgTable(
	'students',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teacherId: uuid('teacher_id')
			.notNull()
			.references(() => teacherProfiles.id, { onDelete: 'cascade' }),
		fullName: text('full_name').notNull(),
		email: text('email'),
		phone: text('phone'),
		level: text('level'),
		status: studentStatus('status').notNull().default('active'),
		notes: text('notes'),
		defaultLessonPrice: numeric('default_lesson_price', { precision: 12, scale: 2 }).notNull().default('0'),
		packageMonths: integer('package_months').notNull().default(0),
		packageLessonCount: integer('package_lesson_count').notNull().default(0),
		packageTotalPrice: numeric('package_total_price', { precision: 12, scale: 2 }).notNull().default('0'),
		billingMode: billingMode('billing_mode').notNull().default('per_lesson'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
	},
	(table) => ({
		teacherStatusIdx: index('students_teacher_status_idx').on(table.teacherId, table.status),
		nameSearchIdx: index('students_name_search_idx').on(table.teacherId, table.fullName),
		teacherStudentUniq: unique('students_teacher_id_id_uniq').on(table.teacherId, table.id),
	})
)

export const lessons = pgTable(
	'lessons',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teacherId: uuid('teacher_id')
			.notNull()
			.references(() => teacherProfiles.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		durationMinutes: integer('duration_minutes').notNull().default(60),
		topic: text('topic'),
		notes: text('notes'),
		status: lessonStatus('status').notNull().default('planned'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		teacherStartsAtIdx: index('lessons_teacher_starts_at_idx').on(table.teacherId, table.startsAt),
		teacherLessonUniq: unique('lessons_teacher_id_id_uniq').on(table.teacherId, table.id),
	})
)

export const lessonStudents = pgTable(
	'lesson_students',
	{
		teacherId: uuid('teacher_id').notNull(),
		lessonId: uuid('lesson_id')
			.notNull()
			.references(() => lessons.id, { onDelete: 'cascade' }),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'cascade' }),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.lessonId, table.studentId] }),
		teacherLessonFk: foreignKey({
			columns: [table.teacherId, table.lessonId],
			foreignColumns: [lessons.teacherId, lessons.id],
			name: 'lesson_students_teacher_lesson_fk',
		}).onDelete('cascade'),
		teacherStudentFk: foreignKey({
			columns: [table.teacherId, table.studentId],
			foreignColumns: [students.teacherId, students.id],
			name: 'lesson_students_teacher_student_fk',
		}).onDelete('cascade'),
	})
)

export const attendanceRecords = pgTable(
	'attendance_records',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teacherId: uuid('teacher_id').notNull(),
		lessonId: uuid('lesson_id')
			.notNull()
			.references(() => lessons.id, { onDelete: 'cascade' }),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'cascade' }),
		status: attendanceStatus('status').notNull().default('planned'),
		billable: boolean('billable').notNull().default(true),
		note: text('note'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		lessonStudentUniq: uniqueIndex('attendance_lesson_student_uniq').on(
			table.teacherId,
			table.lessonId,
			table.studentId
		),
		studentStatusIdx: index('attendance_student_status_idx').on(table.teacherId, table.studentId, table.status),
		teacherLessonFk: foreignKey({
			columns: [table.teacherId, table.lessonId],
			foreignColumns: [lessons.teacherId, lessons.id],
			name: 'attendance_records_teacher_lesson_fk',
		}).onDelete('cascade'),
		teacherStudentFk: foreignKey({
			columns: [table.teacherId, table.studentId],
			foreignColumns: [students.teacherId, students.id],
			name: 'attendance_records_teacher_student_fk',
		}).onDelete('cascade'),
	})
)

export const payments = pgTable(
	'payments',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teacherId: uuid('teacher_id')
			.notNull()
			.references(() => teacherProfiles.id, { onDelete: 'cascade' }),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'cascade' }),
		amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
		paidAt: date('paid_at', { mode: 'string' }).notNull(),
		method: paymentMethod('method').notNull().default('bank_transfer'),
		comment: text('comment'),
		correctionOfPaymentId: uuid('correction_of_payment_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		studentPaidAtIdx: index('payments_student_paid_at_idx').on(table.teacherId, table.studentId, table.paidAt),
		teacherStudentFk: foreignKey({
			columns: [table.teacherId, table.studentId],
			foreignColumns: [students.teacherId, students.id],
			name: 'payments_teacher_student_fk',
		}).onDelete('cascade'),
	})
)

export const calendarConnections = pgTable(
	'calendar_connections',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teacherId: uuid('teacher_id')
			.notNull()
			.references(() => teacherProfiles.id, { onDelete: 'cascade' }),
		provider: calendarProvider('provider').notNull().default('google'),
		providerAccountEmail: text('provider_account_email'),
		requiredScopes: text('required_scopes')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		grantedScopes: text('granted_scopes')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		tokenAvailable: boolean('token_available').notNull().default(false),
		encryptedAccessToken: text('encrypted_access_token'),
		encryptedRefreshToken: text('encrypted_refresh_token'),
		tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
		selectedCalendarId: text('selected_calendar_id'),
		selectedCalendarName: text('selected_calendar_name'),
		status: calendarConnectionStatus('status').notNull().default('not_connected'),
		connectedAt: timestamp('connected_at', { withTimezone: true }),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		teacherProviderUniq: uniqueIndex('calendar_connections_teacher_provider_uniq').on(table.teacherId, table.provider),
	})
)

export const calendarSyncEvents = pgTable(
	'calendar_sync_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		teacherId: uuid('teacher_id').notNull(),
		lessonId: uuid('lesson_id')
			.notNull()
			.references(() => lessons.id, { onDelete: 'cascade' }),
		provider: calendarProvider('provider').notNull().default('google'),
		externalEventId: text('external_event_id'),
		externalCalendarId: text('external_calendar_id'),
		status: calendarSyncStatus('status').notNull().default('not_synced'),
		lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
		lastError: text('last_error'),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => ({
		lessonProviderUniq: uniqueIndex('calendar_sync_events_lesson_provider_uniq').on(
			table.teacherId,
			table.lessonId,
			table.provider
		),
		teacherLessonFk: foreignKey({
			columns: [table.teacherId, table.lessonId],
			foreignColumns: [lessons.teacherId, lessons.id],
			name: 'calendar_sync_events_teacher_lesson_fk',
		}).onDelete('cascade'),
	})
)

export const studentsRelations = relations(students, ({ many }) => ({
	lessonStudents: many(lessonStudents),
	attendanceRecords: many(attendanceRecords),
	payments: many(payments),
}))

export const lessonsRelations = relations(lessons, ({ many, one }) => ({
	lessonStudents: many(lessonStudents),
	attendanceRecords: many(attendanceRecords),
	calendarSync: one(calendarSyncEvents),
}))

export const schemaVersion = sql`2026_04_25_teacher_crm_v1`
