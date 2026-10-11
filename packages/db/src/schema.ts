import { sql } from 'drizzle-orm'
import {
	boolean,
	check,
	date,
	index,
	integer,
	numeric,
	pgTable,
	primaryKey,
	smallint,
	text,
	time,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core'

export const appInfo = pgTable('app_info', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const accounts = pgTable(
	'accounts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		login: text('login').notNull(),
		displayName: text('display_name').notNull(),
		role: text('role').notNull(),
		status: text('status').default('active').notNull(),
		passwordHash: text('password_hash').notNull(),
		authEpoch: integer('auth_epoch').default(0).notNull(),
		studentId: uuid('student_id').references(() => students.id, { onDelete: 'restrict' }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('accounts_student_uq')
			.on(table.studentId)
			.where(sql`${table.studentId} is not null and ${table.status} = 'active'`),
		check('accounts_student_role_ck', sql`${table.studentId} is null or ${table.role} = 'student'`),
		uniqueIndex('accounts_active_login_uq')
			.on(table.login)
			.where(sql`${table.status} = 'active'`),
		uniqueIndex('accounts_one_active_teacher_uq')
			.on(table.role)
			.where(sql`${table.role} = 'teacher' and ${table.status} = 'active'`),
		check('accounts_role_ck', sql`${table.role} in ('teacher', 'student')`),
		check('accounts_status_ck', sql`${table.status} in ('active', 'deactivated')`),
		check('accounts_auth_epoch_ck', sql`${table.authEpoch} >= 0`),
		check(
			'accounts_login_normalized_ck',
			sql`${table.login} = lower(btrim(${table.login})) and char_length(${table.login}) between 3 and 254`
		),
		check('accounts_student_login_ck', sql`${table.role} <> 'student' or ${table.login} ~ '^[a-z0-9._-]{3,32}$'`),
		check('accounts_display_name_ck', sql`char_length(${table.displayName}) between 1 and 80`),
	]
)

export const sessions = pgTable(
	'sessions',
	{
		tokenHash: text('token_hash').primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		authEpoch: integer('auth_epoch').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	},
	(table) => [
		index('sessions_account_idx').on(table.accountId),
		check('sessions_token_hash_ck', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
	]
)

export const signInThrottles = pgTable(
	'sign_in_throttles',
	{
		keyHash: text('key_hash').primaryKey(),
		failureCount: integer('failure_count').notNull(),
		windowStartedAt: timestamp('window_started_at', { withTimezone: true }).notNull(),
		lockedUntil: timestamp('locked_until', { withTimezone: true }),
	},
	(table) => [
		index('sign_in_throttles_window_idx').on(table.windowStartedAt),
		check('sign_in_throttles_key_hash_ck', sql`${table.keyHash} ~ '^[0-9a-f]{64}$'`),
		check('sign_in_throttles_failure_count_ck', sql`${table.failureCount} >= 0`),
	]
)

export const students = pgTable(
	'students',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		displayName: text('display_name').notNull(),
		status: text('status').default('active').notNull(),
		rateMinor: integer('rate_minor'),
		currency: text('currency'),
		defaultLessonMinutes: integer('default_lesson_minutes').default(60).notNull(),
		noShowDeducts: boolean('no_show_deducts').default(true).notNull(),
		parent: text('parent'),
		level: text('level'),
		goals: text('goals'),
		timeZone: text('time_zone'),
		openingBalanceMinutes: integer('opening_balance_minutes'),
		openingBalanceOn: date('opening_balance_on'),
		importKey: text('import_key').unique('students_import_key_uq'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
		archivedAt: timestamp('archived_at', { withTimezone: true }),
	},
	(table) => [
		check('students_status_ck', sql`${table.status} in ('active', 'archived')`),
		check('students_archived_at_ck', sql`(${table.status} = 'archived') = (${table.archivedAt} is not null)`),
		check('students_display_name_ck', sql`char_length(${table.displayName}) between 1 and 80`),
		check(
			'students_rate_ck',
			sql`(${table.rateMinor} is null) = (${table.currency} is null) and (${table.rateMinor} is null or ${table.rateMinor} > 0)`
		),
		check('students_currency_ck', sql`${table.currency} is null or ${table.currency} ~ '^[A-Z]{3}$'`),
		check('students_lesson_minutes_ck', sql`${table.defaultLessonMinutes} between 15 and 240`),
		check(
			'students_text_ck',
			sql`(${table.parent} is null or char_length(${table.parent}) between 1 and 200) and (${table.level} is null or char_length(${table.level}) between 1 and 200) and (${table.goals} is null or char_length(${table.goals}) between 1 and 200)`
		),
		check('students_time_zone_ck', sql`${table.timeZone} is null or char_length(${table.timeZone}) between 1 and 64`),
		check(
			'students_opening_ck',
			sql`(${table.openingBalanceMinutes} is null) = (${table.openingBalanceOn} is null) and (${table.openingBalanceMinutes} is null or ${table.openingBalanceMinutes} >= 0)`
		),
	]
)

export const studentSections = pgTable(
	'student_sections',
	{
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		kind: text('kind').notNull(),
		body: text('body').notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ name: 'student_sections_pk', columns: [table.studentId, table.kind] }),
		check(
			'student_sections_kind_ck',
			sql`${table.kind} in ('general_info', 'interests', 'level', 'goals', 'typical_mistakes', 'lesson_ideas')`
		),
		check('student_sections_body_ck', sql`char_length(${table.body}) <= 20000`),
	]
)

export const studentTerms = pgTable(
	'student_terms',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		term: text('term').notNull(),
		note: text('note'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('student_terms_term_uq').on(table.studentId, sql`lower(${table.term})`),
		check(
			'student_terms_term_ck',
			sql`${table.term} = btrim(${table.term}) and char_length(${table.term}) between 1 and 200`
		),
		check('student_terms_note_ck', sql`${table.note} is null or char_length(${table.note}) between 1 and 2000`),
	]
)

export const payments = pgTable(
	'payments',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id').references(() => students.id, { onDelete: 'restrict' }),
		paidOn: date('paid_on').notNull(),
		amountMinor: integer('amount_minor').notNull(),
		currency: text('currency'),
		lessonsCount: numeric('lessons_count', { precision: 7, scale: 2 }),
		creditedMinutes: integer('credited_minutes').default(0).notNull(),
		note: text('note'),
		source: text('source').notNull(),
		importKey: text('import_key').unique('payments_import_key_uq'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('payments_student_paid_idx').on(table.studentId, table.paidOn),
		check('payments_amount_ck', sql`${table.amountMinor} > 0`),
		check('payments_currency_format_ck', sql`${table.currency} is null or ${table.currency} ~ '^[A-Z]{3}$'`),
		check(
			'payments_currency_ck',
			sql`${table.currency} is not null or (${table.lessonsCount} is null and ${table.creditedMinutes} = 0)`
		),
		check(
			'payments_unassigned_ck',
			sql`${table.studentId} is not null or (${table.lessonsCount} is null and ${table.creditedMinutes} = 0)`
		),
		check(
			'payments_credited_ck',
			sql`${table.creditedMinutes} >= 0 and (${table.lessonsCount} is not null or ${table.creditedMinutes} = 0)`
		),
		check('payments_lessons_ck', sql`${table.lessonsCount} is null or ${table.lessonsCount} >= 0`),
		check('payments_note_ck', sql`${table.note} is null or char_length(${table.note}) between 1 and 500`),
		check('payments_source_ck', sql`${table.source} in ('manual', 'vault')`),
	]
)

export const lessonSeries = pgTable(
	'lesson_series',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		weekday: smallint('weekday').notNull(),
		startTime: time('start_time').notNull(),
		durationMinutes: integer('duration_minutes').notNull(),
		startsOn: date('starts_on').notNull(),
		endsOn: date('ends_on'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('lesson_series_student_idx').on(table.studentId),
		check('lesson_series_weekday_ck', sql`${table.weekday} between 1 and 7`),
		check('lesson_series_starts_on_ck', sql`extract(isodow from ${table.startsOn}) = ${table.weekday}`),
		check('lesson_series_ends_on_ck', sql`${table.endsOn} is null or ${table.endsOn} >= ${table.startsOn} - 1`),
		check('lesson_series_start_time_ck', sql`extract(second from ${table.startTime}) = 0`),
		check('lesson_series_minutes_ck', sql`${table.durationMinutes} between 15 and 240`),
	]
)

export const lessonExceptions = pgTable(
	'lesson_exceptions',
	{
		seriesId: uuid('series_id')
			.notNull()
			.references(() => lessonSeries.id, { onDelete: 'restrict' }),
		originalOn: date('original_on').notNull(),
		kind: text('kind').notNull(),
		startsAt: timestamp('starts_at', { withTimezone: true }),
		durationMinutes: integer('duration_minutes'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		primaryKey({ name: 'lesson_exceptions_pk', columns: [table.seriesId, table.originalOn] }),
		index('lesson_exceptions_moved_idx')
			.on(table.startsAt)
			.where(sql`${table.kind} = 'moved'`),
		check('lesson_exceptions_kind_ck', sql`${table.kind} in ('cancelled', 'moved', 'restored')`),
		check(
			'lesson_exceptions_moved_ck',
			sql`(${table.kind} <> 'moved' or ${table.startsAt} is not null) and (${table.startsAt} is null) = (${table.durationMinutes} is null)`
		),
		check(
			'lesson_exceptions_minutes_ck',
			sql`${table.durationMinutes} is null or ${table.durationMinutes} between 15 and 240`
		),
	]
)

export const lessons = pgTable(
	'lessons',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		studentId: uuid('student_id')
			.notNull()
			.references(() => students.id, { onDelete: 'restrict' }),
		startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
		durationMinutes: integer('duration_minutes').notNull(),
		status: text('status').default('scheduled').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('lessons_starts_at_idx').on(table.startsAt),
		index('lessons_student_starts_idx').on(table.studentId, table.startsAt),
		check('lessons_status_ck', sql`${table.status} in ('scheduled', 'cancelled')`),
		check('lessons_minutes_ck', sql`${table.durationMinutes} between 15 and 240`),
	]
)

export const lessonMarks = pgTable(
	'lesson_marks',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		seriesId: uuid('series_id').references(() => lessonSeries.id, { onDelete: 'restrict' }),
		originalOn: date('original_on'),
		lessonId: uuid('lesson_id').references(() => lessons.id, { onDelete: 'restrict' }),
		kind: text('kind').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('lesson_marks_occurrence_uq').on(table.seriesId, table.originalOn),
		uniqueIndex('lesson_marks_lesson_uq').on(table.lessonId),
		check('lesson_marks_kind_ck', sql`${table.kind} in ('done', 'no_show', 'none')`),
		check(
			'lesson_marks_ref_ck',
			sql`(${table.seriesId} is null) = (${table.originalOn} is null) and (${table.seriesId} is null) <> (${table.lessonId} is null)`
		),
	]
)

export const teacherSettings = pgTable(
	'teacher_settings',
	{
		accountId: uuid('account_id')
			.primaryKey()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		paysSoonLessons: integer('pays_soon_lessons').notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [check('teacher_settings_pays_soon_ck', sql`${table.paysSoonLessons} between 0 and 20`)]
)
