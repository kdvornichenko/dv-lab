import type { APIRequestContext } from '@playwright/test'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	googleScheduleWindow,
} from '../../packages/contracts/src/calendar.ts'
import { api } from './api.ts'
import { calendarCommandFixture, commandInput, parseCalendarResponse } from './calendar-commands.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { quote, sql } from './data.ts'
import { mondayOf } from './dates.ts'
import { integer, record } from './input.ts'
import { expect } from './test.ts'

async function prepare(request: APIRequestContext) {
	const fixture = await calendarCommandFixture(request)
	const input = await commandInput(request, fixture.studentId)
	const window = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(input.date)}`)
	)
	if (window.read.state !== 'fresh') throw new Error('Command recovery requires a fresh real provider window')
	input.expectedVersion = window.read.revision
	return input
}

async function status(request: APIRequestContext, commandId: string) {
	const parsed = calendarCommandSnapshot.safeParse(await api(request, 'GET', `/google/commands/${commandId}`))
	if (!parsed.success) throw new Error('Command recovery status failed validation')
	return parsed.data
}

async function applied(request: APIRequestContext, commandId: string) {
	await expect.poll(async () => (await status(request, commandId)).state, { timeout: 60000 }).toBe('applied')
	const snapshot = await status(request, commandId)
	expect(snapshot.effect).toBe('confirmed')
	expect(snapshot.confirmedRevision !== null).toBe(true)
	expect(snapshot.affectedRefs.length).toBe(1)
}

export async function delayedCommand(request: APIRequestContext) {
	const input = await prepare(request)
	const fault = armCalendarFault({
		method: 'POST',
		resource: 'events',
		page: 'any',
		action: 'delay_response',
		delayMs: 5000,
	})
	try {
		const receipt = parseCalendarResponse(
			calendarCommandReceipt,
			await api(request, 'POST', '/schedule/lessons', input, 202)
		)
		await expect
			.poll(() => calendarFaultEvidence(fault).some((item) => item.phase === 'response_held'), { timeout: 20000 })
			.toBe(true)
		const pending = await status(request, receipt.commandId)
		expect(pending.state).toBe('dispatching')
		expect(pending.confirmedRevision).toBeNull()
		const [ref] = pending.affectedRefs
		if (ref?.kind !== 'single') throw new Error('Create command must reserve a single lesson reference')
		const rows = sql(`select count(*)::int as n from lessons where id = ${quote(ref.lessonId)}::uuid`)
		expect(integer(rows[0]?.n)).toBe(0)
		await applied(request, receipt.commandId)
	} finally {
		disarmCalendarFault(fault)
	}
}

export async function lostProviderResponse(request: APIRequestContext) {
	const input = await prepare(request)
	const fault = armCalendarFault({
		method: 'POST',
		resource: 'events',
		page: 'any',
		action: 'drop_response',
		delayMs: 0,
	})
	try {
		const receipt = parseCalendarResponse(
			calendarCommandReceipt,
			await api(request, 'POST', '/schedule/lessons', input, 202)
		)
		await expect
			.poll(
				() =>
					calendarFaultEvidence(fault).some(
						(item) =>
							item.phase === 'response_dropped' && item.status !== null && item.status >= 200 && item.status < 300
					),
				{ timeout: 20000 }
			)
			.toBe(true)
		const found = parseCalendarResponse(
			calendarCommandSnapshot,
			await api(request, 'GET', `/google/commands/by-request/${input.requestId}`)
		)
		expect(found.commandId).toBe(receipt.commandId)
		await applied(request, receipt.commandId)
		const repeated = parseCalendarResponse(
			calendarCommandReceipt,
			await api(request, 'POST', '/schedule/lessons', input, 202)
		)
		expect(repeated.commandId).toBe(receipt.commandId)
		expect(calendarFaultEvidence(fault).filter((item) => item.phase === 'request_matched').length).toBe(1)
	} finally {
		disarmCalendarFault(fault)
	}
}

export async function unknownAbsence(request: APIRequestContext) {
	const fixture = await calendarCommandFixture(request)
	if (!fixture.unknownRequestId)
		throw new Error('Recovery requires an owned interrupted dispatch fixture with real provider absence')
	const original = parseCalendarResponse(
		calendarCommandSnapshot,
		await api(request, 'GET', `/google/commands/by-request/${fixture.unknownRequestId}`)
	)
	const owned = sql(
		`select count(*)::int as n from google_commands where id = ${quote(original.commandId)}::uuid and account_id = ${quote(fixture.accountId)}::uuid and plan->'input'->>'studentId' = ${quote(fixture.studentId)}`
	)
	if (integer(owned[0]?.n) !== 1) throw new Error('Interrupted command is outside the owned synthetic fixture')
	await expect
		.poll(async () => (await status(request, original.commandId)).state, { timeout: 60000 })
		.toBe('recovery_required')
	await api(request, 'POST', `/google/commands/${original.commandId}/resume`, {}, 202)
	const snapshot = await status(request, original.commandId)
	expect(snapshot.state).toBe('recovery_required')
	expect(snapshot.effect).toBe('unknown')
	expect(snapshot.nextAction).toBe('resume_recovery')
	expect(snapshot.confirmedRevision).toBeNull()
	const absence = sql(
		`select count(*)::int as n from google_command_stages where command_id = ${quote(original.commandId)}::uuid and acknowledgement->>'kind' = 'absence'`
	)
	expect(integer(absence[0]?.n)).toBe(1)
	const reserved = sql(
		`select count(*)::int as n from google_event_mappings where command_id = ${quote(original.commandId)}::uuid and state = 'reserved'`
	)
	expect(integer(reserved[0]?.n)).toBe(1)
	const next = await commandInput(request, fixture.studentId)
	const refused = record(await api(request, 'POST', '/schedule/lessons', next, 409))
	expect(record(refused.error).code).toBe('command_pending')
	await api(request, 'GET', `/google/commands/by-request/${next.requestId}`, undefined, 404)
}
