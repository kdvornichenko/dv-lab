import { and, asc, desc, eq, sql } from 'drizzle-orm'

import type { DB } from './factory'
import { calendarBlocks, calendarConnections, calendarSyncEvents, lessons, lessonStudents, students } from './schema'

export type CalendarConnectionRow = typeof calendarConnections.$inferSelect
export type CalendarSyncEventRow = typeof calendarSyncEvents.$inferSelect
export type CalendarBlockRow = typeof calendarBlocks.$inferSelect
export type CalendarConnectionUpsertValues = typeof calendarConnections.$inferInsert
export type CalendarSyncEventUpsertValues = typeof calendarSyncEvents.$inferInsert
export type CalendarBlockInsertValues = Omit<typeof calendarBlocks.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
export type CalendarBlockUpdateValues = Partial<
	Omit<typeof calendarBlocks.$inferInsert, 'id' | 'teacherId' | 'createdAt' | 'updatedAt'>
>
export type CalendarLessonContext = {
	lesson: typeof lessons.$inferSelect
	students: {
		id: string
		firstName: string
		lastName: string
		fullName: string
		email: string | null
		special: string | null
	}[]
}

export async function getCalendarConnectionRow(db: DB, teacherId: string): Promise<CalendarConnectionRow | null> {
	const [connection] = await db
		.select()
		.from(calendarConnections)
		.where(and(eq(calendarConnections.teacherId, teacherId), eq(calendarConnections.provider, 'google')))
		.limit(1)

	return connection ?? null
}

export async function upsertCalendarConnectionRow(
	db: DB,
	values: CalendarConnectionUpsertValues
): Promise<CalendarConnectionRow> {
	const [connection] = await db
		.insert(calendarConnections)
		.values(values)
		.onConflictDoUpdate({
			target: [calendarConnections.teacherId, calendarConnections.provider],
			set: {
				providerAccountEmail: sql`excluded.provider_account_email`,
				requiredScopes: sql`excluded.required_scopes`,
				grantedScopes: sql`excluded.granted_scopes`,
				tokenAvailable: sql`excluded.token_available`,
				encryptedAccessToken: sql`coalesce(excluded.encrypted_access_token, ${calendarConnections.encryptedAccessToken})`,
				encryptedRefreshToken: sql`coalesce(excluded.encrypted_refresh_token, ${calendarConnections.encryptedRefreshToken})`,
				tokenExpiresAt: sql`coalesce(excluded.token_expires_at, ${calendarConnections.tokenExpiresAt})`,
				selectedCalendarId: sql`coalesce(excluded.selected_calendar_id, ${calendarConnections.selectedCalendarId})`,
				selectedCalendarName: sql`coalesce(excluded.selected_calendar_name, ${calendarConnections.selectedCalendarName})`,
				status: sql`excluded.status`,
				connectedAt: sql`coalesce(excluded.connected_at, ${calendarConnections.connectedAt})`,
				updatedAt: new Date(),
			},
		})
		.returning()

	if (!connection) throw new Error('Calendar connection upsert did not return a row')
	return connection
}

export async function selectCalendarConnectionRow(
	db: DB,
	teacherId: string,
	calendarId: string,
	calendarName: string
): Promise<CalendarConnectionRow | null> {
	const [connection] = await db
		.update(calendarConnections)
		.set({
			selectedCalendarId: calendarId,
			selectedCalendarName: calendarName,
			updatedAt: new Date(),
		})
		.where(and(eq(calendarConnections.teacherId, teacherId), eq(calendarConnections.provider, 'google')))
		.returning()

	return connection ?? null
}

export async function listCalendarSyncEventRows(db: DB, teacherId: string): Promise<CalendarSyncEventRow[]> {
	return db
		.select()
		.from(calendarSyncEvents)
		.where(and(eq(calendarSyncEvents.teacherId, teacherId), eq(calendarSyncEvents.provider, 'google')))
		.orderBy(desc(calendarSyncEvents.updatedAt))
}

export async function listCalendarBlockRows(db: DB, teacherId: string): Promise<CalendarBlockRow[]> {
	return db
		.select()
		.from(calendarBlocks)
		.where(eq(calendarBlocks.teacherId, teacherId))
		.orderBy(asc(calendarBlocks.startsAt))
}

export async function insertCalendarBlockRow(
	db: DB,
	values: CalendarBlockInsertValues
): Promise<CalendarBlockRow> {
	const [block] = await db.insert(calendarBlocks).values(values).returning()
	if (!block) throw new Error('Calendar block insert did not return a row')
	return block
}

export async function updateCalendarBlockRow(
	db: DB,
	teacherId: string,
	blockId: string,
	values: CalendarBlockUpdateValues
): Promise<CalendarBlockRow | null> {
	const [block] = await db
		.update(calendarBlocks)
		.set({ ...values, updatedAt: new Date() })
		.where(and(eq(calendarBlocks.teacherId, teacherId), eq(calendarBlocks.id, blockId)))
		.returning()

	return block ?? null
}

export async function deleteCalendarBlockRow(
	db: DB,
	teacherId: string,
	blockId: string
): Promise<CalendarBlockRow | null> {
	const [block] = await db
		.delete(calendarBlocks)
		.where(and(eq(calendarBlocks.teacherId, teacherId), eq(calendarBlocks.id, blockId)))
		.returning()

	return block ?? null
}

export async function getCalendarSyncEventRow(
	db: DB,
	teacherId: string,
	lessonId: string
): Promise<CalendarSyncEventRow | null> {
	const [syncEvent] = await db
		.select()
		.from(calendarSyncEvents)
		.where(
			and(
				eq(calendarSyncEvents.teacherId, teacherId),
				eq(calendarSyncEvents.lessonId, lessonId),
				eq(calendarSyncEvents.provider, 'google')
			)
		)
		.limit(1)

	return syncEvent ?? null
}

export async function upsertCalendarSyncEventRow(
	db: DB,
	values: CalendarSyncEventUpsertValues
): Promise<CalendarSyncEventRow> {
	const [syncEvent] = await db
		.insert(calendarSyncEvents)
		.values(values)
		.onConflictDoUpdate({
			target: [calendarSyncEvents.teacherId, calendarSyncEvents.lessonId, calendarSyncEvents.provider],
			set: {
				externalEventId: sql`coalesce(excluded.external_event_id, ${calendarSyncEvents.externalEventId})`,
				externalCalendarId: sql`coalesce(excluded.external_calendar_id, ${calendarSyncEvents.externalCalendarId})`,
				status: sql`excluded.status`,
				lastSyncedAt: sql`coalesce(excluded.last_synced_at, ${calendarSyncEvents.lastSyncedAt})`,
				lastError: sql`excluded.last_error`,
				updatedAt: new Date(),
			},
		})
		.returning()

	if (!syncEvent) throw new Error('Calendar sync event upsert did not return a row')
	return syncEvent
}

export async function lessonExistsForTeacher(db: DB, teacherId: string, lessonId: string): Promise<boolean> {
	const [lesson] = await db
		.select({ id: lessons.id })
		.from(lessons)
		.where(and(eq(lessons.teacherId, teacherId), eq(lessons.id, lessonId)))
		.limit(1)

	return Boolean(lesson)
}

export async function getCalendarLessonContext(
	db: DB,
	teacherId: string,
	lessonId: string
): Promise<CalendarLessonContext | null> {
	const rows = await db
		.select({
			lesson: lessons,
			studentId: students.id,
			firstName: students.firstName,
			lastName: students.lastName,
			fullName: students.fullName,
			email: students.email,
			special: students.special,
		})
		.from(lessons)
		.leftJoin(
			lessonStudents,
			and(eq(lessonStudents.teacherId, lessons.teacherId), eq(lessonStudents.lessonId, lessons.id))
		)
		.leftJoin(students, and(eq(students.teacherId, lessons.teacherId), eq(students.id, lessonStudents.studentId)))
		.where(and(eq(lessons.teacherId, teacherId), eq(lessons.id, lessonId)))

	if (rows.length === 0) return null
	const lesson = rows[0]?.lesson
	if (!lesson) return null

	return {
		lesson,
		students: rows
			.filter((row): row is typeof row & { studentId: string; fullName: string } =>
				Boolean(row.studentId && row.fullName)
			)
			.map((row) => ({
				id: row.studentId,
				firstName: row.firstName ?? '',
				lastName: row.lastName ?? '',
				fullName: row.fullName,
				email: row.email,
				special: row.special,
			})),
	}
}
