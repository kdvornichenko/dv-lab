import type { APIRequestContext } from '@playwright/test'

import { z } from 'zod'

import { teacherId } from './api.ts'
import ensureCalendarTarget from './calendar.ts'
import { HTTPS_TARGET, NAMES, retainedStudent, PRIVATE_DIR, quote, sql } from './data.ts'
import { integer } from './input.ts'
import { readPrivateJson, targetBinding } from './target.ts'

const student = z.strictObject({ id: z.uuid(), name: z.enum(NAMES) })
const scheduledStudent = student.extend({ lessonId: z.uuid(), startsAt: z.iso.datetime() })
const readFixture = z.strictObject({
	kind: z.literal('google-read-recovery'),
	origin: z.literal('https://dv-lab.dev'),
	apiBuildSha: z.string().regex(/^[a-f0-9]{40}$/),
	persistenceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
	accountId: z.uuid(),
	providerReadsAuthorized: z.literal(true),
	cardMutationsAuthorized: z.literal(true),
	weekStart: z.iso.date(),
	uncachedWeekStart: z.iso.date(),
	uncachedWindowStart: z.iso.datetime(),
	first: scheduledStudent,
	later: scheduledStudent,
	none: student,
	expiresAt: z.iso.datetime(),
})

export type CalendarReadFixture = z.infer<typeof readFixture>

export async function calendarReadFixture(request: APIRequestContext): Promise<CalendarReadFixture> {
	if (!HTTPS_TARGET) throw new Error('Provider read recovery requires the attested HTTPS target')
	await ensureCalendarTarget()
	const parsed = readFixture.safeParse(readPrivateJson(`${PRIVATE_DIR}/calendar-read.json`))
	if (!parsed.success) throw new Error('Calendar read fixture failed validation')
	const fixture = parsed.data
	const binding = targetBinding()
	if (
		fixture.apiBuildSha !== binding.apiBuildSha ||
		fixture.origin !== binding.origin ||
		fixture.persistenceFingerprint !== binding.persistenceFingerprint ||
		Date.parse(fixture.expiresAt) <= Date.now() ||
		Date.parse(fixture.first.startsAt) <= Date.now() ||
		Date.parse(fixture.first.startsAt) >= Date.parse(fixture.later.startsAt) ||
		fixture.weekStart === fixture.uncachedWeekStart ||
		(await teacherId(request)) !== fixture.accountId
	)
		throw new Error('Calendar read fixture does not match the current authority')
	const students = [fixture.first, fixture.later, fixture.none]
	if (new Set(students.map((item) => item.id)).size !== students.length)
		throw new Error('Calendar read fixture requires three distinct synthetic cards')
	for (const item of students) {
		retainedStudent(item.id)
		const rows = sql(
			`select count(*)::int as n from students where id = ${quote(item.id)}::uuid and display_name = ${quote(item.name)} and import_key is null`
		)
		if (integer(rows[0]?.n) !== 1) throw new Error('Calendar read fixture is outside the owned synthetic set')
	}
	return fixture
}

export function requireUncachedWindow(fixture: CalendarReadFixture): void {
	const rows = sql(
		`select count(*)::int as n from google_read_windows where account_id = ${quote(fixture.accountId)}::uuid and window_start = ${quote(fixture.uncachedWindowStart)}::timestamptz`
	)
	if (integer(rows[0]?.n) !== 0) throw new Error('The unread Calendar range already has a persisted snapshot')
}
