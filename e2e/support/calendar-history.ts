import { expect, type APIRequestContext } from '@playwright/test'

import { readFileSync } from 'node:fs'
import { z } from 'zod'

import { api, readStudent, readToday, teacherId } from './api.ts'
import ensureCalendarTarget from './calendar.ts'
import { FIXTURE_DATABASE, HTTPS_TARGET, ownedStudent, PRIVATE_DIR, quote, sql } from './data.ts'
import { integer, record, text } from './input.ts'
import { readPrivateJson } from './target.ts'

const historyCase = z.strictObject({
	kind: z.enum(['old_marked', 'old_unmarked', 'legacy_elapsed', 'confirmed', 'pending']),
	studentId: z.uuid(),
	ref: z.discriminatedUnion('kind', [
		z.strictObject({ kind: z.literal('single'), lessonId: z.uuid() }),
		z.strictObject({ kind: z.literal('series'), seriesId: z.uuid(), originalOn: z.iso.date() }),
	]),
	startsAt: z.iso.datetime({ offset: true }),
})

type HistoryCase = z.output<typeof historyCase>

function readFixture(): unknown {
	try {
		const path = `${PRIVATE_DIR}/calendar-history.json`
		if (FIXTURE_DATABASE === 'prelaunch') return readPrivateJson(path)
		return JSON.parse(readFileSync(path, 'utf8')) as unknown
	} catch {
		throw new Error('Observed synthetic history fixture is required')
	}
}

async function historyFixture(request: APIRequestContext) {
	if (FIXTURE_DATABASE !== 'test' && FIXTURE_DATABASE !== 'prelaunch')
		throw new Error('Calendar history requires authorized test or attested prelaunch persistence')
	if (!HTTPS_TARGET) throw new Error('Calendar history requires the attested HTTPS runtime and test persistence')
	await ensureCalendarTarget()
	const parsed = z
		.strictObject({
			kind: z.literal('observed-google-history'),
			ownership: z.literal('dv-lab-synthetic'),
			accountId: z.uuid(),
			cutoverAt: z.iso.datetime({ offset: true }),
			externalEventKey: z.string().regex(/^[0-9a-f]{64}$/),
			cases: z.array(historyCase).min(5),
		})
		.safeParse(readFixture())
	if (!parsed.success) throw new Error('Observed synthetic history fixture is invalid')
	const fixture = parsed.data
	if ((await teacherId(request)) !== fixture.accountId) throw new Error('History fixture belongs to another teacher')
	const connection = sql(
		`select history_cutover_at from google_connections where account_id = ${quote(fixture.accountId)}::uuid`
	)[0]
	if (!connection || new Date(text(connection.history_cutover_at)).toISOString() !== fixture.cutoverAt)
		throw new Error('History fixture cutoff does not match persistence')
	const kinds = new Set(fixture.cases.map((item) => item.kind))
	if (kinds.size !== 5) throw new Error('History fixture must include every required failure path')
	for (const item of fixture.cases) {
		if (FIXTURE_DATABASE === 'prelaunch') ownedStudent(item.studentId)
		const rows = sql(
			`select count(*)::int as n from students where id = ${quote(item.studentId)}::uuid and display_name like 'Alex Example %' and import_key is null`
		)
		if (integer(rows[0]?.n) !== 1) throw new Error('History fixture student is outside the synthetic set')
		const before = item.kind === 'old_marked' || item.kind === 'old_unmarked'
		if (
			new Date(item.startsAt) < new Date(fixture.cutoverAt) !== before ||
			new Date(item.startsAt).getTime() >= Date.now()
		)
			throw new Error('History fixture does not span the immutable cutoff')
		const owner =
			item.ref.kind === 'single'
				? `select student_id from lessons where id = ${quote(item.ref.lessonId)}::uuid`
				: `select student_id from lesson_series where id = ${quote(item.ref.seriesId)}::uuid`
		if (sql(owner)[0]?.student_id !== item.studentId) throw new Error('History reference is outside the synthetic card')
	}
	return fixture
}

function key(item: HistoryCase) {
	return item.ref.kind === 'single' ? `l:${item.ref.lessonId}` : `s:${item.ref.seriesId}:${item.ref.originalOn}`
}

function markPath(item: HistoryCase) {
	return item.ref.kind === 'single'
		? `/schedule/lessons/${item.ref.lessonId}/mark`
		: `/schedule/series/${item.ref.seriesId}/occurrences/${item.ref.originalOn}/mark`
}

function storedMark(item: HistoryCase) {
	const where =
		item.ref.kind === 'single'
			? `lesson_id = ${quote(item.ref.lessonId)}::uuid`
			: `series_id = ${quote(item.ref.seriesId)}::uuid and original_on = ${quote(item.ref.originalOn)}::date`
	const row = sql(`select kind from lesson_marks where ${where}`)[0]
	return row ? text(row.kind) : null
}

export async function calendarHistoryRead(request: APIRequestContext) {
	const fixture = await historyFixture(request)
	const before = new Map(
		await Promise.all(
			fixture.cases.map(async (item) => [item.studentId, await readStudent(request, item.studentId)] as const)
		)
	)
	const today = await readToday(request)
	for (const item of fixture.cases) {
		const visible = [...today.lessons, ...today.earlier].some((block) => block.key === key(item))
		if (item.kind !== 'old_marked')
			expect(
				visible === ['old_unmarked', 'confirmed'].includes(item.kind),
				'History visibility follows cutoff and confirmed binding'
			).toBe(true)
		else expect(['done', 'no_show'].includes(storedMark(item) ?? ''), 'Historical mark remains stored').toBe(true)
		const after = await readStudent(request, item.studentId)
		expect(after.balanceMinutes === before.get(item.studentId)?.balanceMinutes, 'History reads preserve balances').toBe(
			true
		)
	}
	expect(
		[...today.lessons, ...today.earlier].some((block) => block.key === fixture.externalEventKey),
		'External events are not payable lessons'
	).toBe(false)
}

export async function calendarHistoryMarks(request: APIRequestContext) {
	const fixture = await historyFixture(request)
	for (const item of fixture.cases) {
		const before = await readStudent(request, item.studentId)
		const mark = storedMark(item)
		const refused = item.kind === 'legacy_elapsed' || item.kind === 'pending'
		if (refused) {
			const response = record(
				await api(request, 'POST', markPath(item), { kind: 'done', expectedStartsAt: item.startsAt }, 409)
			)
			expect(text(record(response.error).code)).toBe('lesson_changed')
			expect(storedMark(item) === mark, 'Refused marks do not alter history').toBe(true)
		} else if (item.kind === 'old_marked') {
			expect(mark === 'done' || mark === 'no_show', 'Historical mark remains stored').toBe(true)
		} else {
			try {
				await api(request, 'POST', markPath(item), { kind: 'done', expectedStartsAt: item.startsAt }, 200)
				expect(storedMark(item) === 'done', 'Confirmed or pre-cutover history accepts a mark').toBe(true)
			} finally {
				await api(request, 'POST', markPath(item), { kind: mark ?? 'none', expectedStartsAt: item.startsAt }, 200)
			}
		}
		const after = await readStudent(request, item.studentId)
		expect(
			after.balanceMinutes === before.balanceMinutes,
			'Refusal or mark correction preserves the original balance'
		).toBe(true)
	}
	await api(request, 'POST', `/schedule/lessons/${fixture.externalEventKey}/mark`, { kind: 'done' }, 404)
}
