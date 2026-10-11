import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	googleScheduleWindow,
	googleUnresolvedCommandsResponse,
} from '../../packages/contracts/src/calendar.ts'
import { api, readSettings, teacherId } from './api.ts'
import { HTTPS_TARGET, NAMES, PRIVATE_DIR, quote, retainedStudent, sql, teacherCredentials } from './data.ts'
import { addDays, mondayOf, vnToday } from './dates.ts'
import { integer, record } from './input.ts'
import { readPrivateJson, targetBinding } from './target.ts'
import { expect } from './test.ts'

export function parseCalendarResponse<T>(schema: z.ZodType<T>, value: unknown): T {
	const parsed = schema.safeParse(value)
	if (!parsed.success) throw new Error('Calendar public response failed validation')
	return parsed.data
}

export async function calendarCommandFixture(request: APIRequestContext) {
	if (!HTTPS_TARGET) throw new Error('Connected command journeys require the attested HTTPS target')
	const binding = targetBinding()
	const parsed = z
		.strictObject({
			origin: z.string(),
			apiBuildSha: z.string(),
			persistenceFingerprint: z.string(),
			studentId: z.uuid(),
			studentName: z.enum(NAMES),
			accountId: z.uuid(),
			commandWritesAuthorized: z.literal(true),
			unknownRequestId: z.uuid().optional(),
			cuts: z
				.strictObject({
					legacySeriesId: z.uuid(),
					cases: z
						.array(
							z.strictObject({
								seriesId: z.uuid(),
								from: z.iso.date(),
								lastOn: z.iso.date(),
								weekday: z.literal([1, 2, 3, 4, 5, 6, 7]),
								startTime: z.string(),
								timeZone: z.string(),
								markOriginalOn: z.iso.date().optional(),
								scenario: z.enum(['finite', 'empty', 'cross_zone', 'history']),
								operation: z.enum(['move_series', 'end_series']),
							})
						)
						.min(1),
				})
				.optional(),
			expiresAt: z.iso.datetime(),
		})
		.safeParse(readPrivateJson(`${PRIVATE_DIR}/calendar-command.json`))
	if (!parsed.success) throw new Error('Calendar command fixture failed validation')
	const fixture = parsed.data
	if (
		fixture.origin !== binding.origin ||
		fixture.apiBuildSha !== binding.apiBuildSha ||
		fixture.persistenceFingerprint !== binding.persistenceFingerprint ||
		Date.parse(fixture.expiresAt) <= Date.now()
	)
		throw new Error('Calendar command fixture does not match the active runtime authority')
	retainedStudent(fixture.studentId)
	if ((await teacherId(request)) !== fixture.accountId)
		throw new Error('Calendar command fixture belongs to another teacher')
	const rows = sql(
		`select count(*)::int as n from students where id = ${quote(fixture.studentId)}::uuid and display_name = ${quote(fixture.studentName)} and import_key is null`
	)
	if (integer(rows[0]?.n) !== 1) throw new Error('Calendar command fixture is outside the owned synthetic set')
	return fixture
}

export async function commandInput(request: APIRequestContext, studentId: string) {
	const settings = await readSettings(request)
	return {
		studentId,
		date: addDays(vnToday(), 7),
		startTime: '13:00',
		durationMinutes: 60,
		repeats: 'once',
		expectedDefaultTimeZone: settings.defaultTimeZone,
		requestId: randomUUID(),
		expectedVersion: '0',
	}
}

export async function disconnectedCommand(request: APIRequestContext) {
	await api(request, 'POST', '/auth/sign-in', teacherCredentials())
	try {
		await disconnectedAdmission(request)
	} finally {
		await api(request, 'POST', '/auth/sign-out', {})
	}
}

async function disconnectedAdmission(request: APIRequestContext) {
	const window = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(vnToday())}`)
	)
	expect(window.connection.state, 'This journey requires a disconnected runtime').toBe('not_connected')
	const input = await commandInput(request, randomUUID())
	const before = parseCalendarResponse(
		googleUnresolvedCommandsResponse,
		await api(request, 'GET', '/google/commands?state=unresolved')
	)
	const refused = record(await api(request, 'POST', '/schedule/lessons', input, 409))
	expect(record(refused.error).code).toBe('connection_required')
	await api(request, 'GET', `/google/commands/by-request/${input.requestId}`, undefined, 404)
	expect(await api(request, 'GET', '/google/commands?state=unresolved')).toEqual(before)
	for (const action of ['move', 'cancel', 'restore']) {
		const meta = { requestId: randomUUID(), expectedVersion: '0' }
		const body =
			action === 'move'
				? {
						...meta,
						date: input.date,
						startTime: input.startTime,
						expectedDefaultTimeZone: input.expectedDefaultTimeZone,
					}
				: meta
		await api(request, 'POST', `/schedule/lessons/${input.studentId}/${action}`, body, 409)
	}
}

export async function commandTracer(request: APIRequestContext, studentId: string) {
	const input = await commandInput(request, studentId)
	const window = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(input.date)}`)
	)
	expect(window.read.state, 'Real connected provider window').toBe('fresh')
	if (window.read.state !== 'fresh') throw new Error('Real provider readiness is required')
	input.expectedVersion = window.read.revision
	const outside = { ...input, date: addDays(input.date, 14), requestId: randomUUID() }
	const outsideResult = record(await api(request, 'POST', '/schedule/lessons', outside, 409))
	expect(record(outsideResult.error).code).toBe('precondition_failed')
	await api(request, 'GET', `/google/commands/by-request/${outside.requestId}`, undefined, 404)
	const receipt = parseCalendarResponse(
		calendarCommandReceipt,
		await api(request, 'POST', '/schedule/lessons', input, 202)
	)
	expect(
		parseCalendarResponse(calendarCommandReceipt, await api(request, 'POST', '/schedule/lessons', input, 202))
	).toEqual(receipt)
	const conflict = record(await api(request, 'POST', '/schedule/lessons', { ...input, startTime: '14:00' }, 409))
	expect(record(conflict.error).code).toBe('precondition_failed')
	const lookup = parseCalendarResponse(
		calendarCommandSnapshot,
		await api(request, 'GET', `/google/commands/by-request/${input.requestId}`)
	)
	expect(lookup.commandId).toBe(receipt.commandId)
	await expect
		.poll(
			async () => {
				const status = parseCalendarResponse(
					calendarCommandSnapshot,
					await api(request, 'GET', `/google/commands/${receipt.commandId}`)
				)
				return status.state
			},
			{ timeout: 60000 }
		)
		.toBe('applied')
	const status = parseCalendarResponse(
		calendarCommandSnapshot,
		await api(request, 'GET', `/google/commands/${receipt.commandId}`)
	)
	expect(status.effect).toBe('confirmed')
	expect(status.confirmedRevision).not.toBeNull()
	expect(status.affectedRefs).toHaveLength(1)
	expect(
		parseCalendarResponse(calendarCommandReceipt, await api(request, 'POST', '/schedule/lessons', input, 202))
	).toEqual(receipt)
	const after = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(input.date)}`)
	)
	expect(after.read.state).toBe('fresh')
	const ref = status.affectedRefs[0]
	expect(
		after.events.filter(
			(event) => event.binding.kind === 'lesson' && JSON.stringify(event.binding.ref) === JSON.stringify(ref)
		).length
	).toBe(1)
	const stale = record(await api(request, 'POST', '/schedule/lessons', { ...input, requestId: randomUUID() }, 409))
	expect(record(stale.error).code).toBe('precondition_failed')
}
