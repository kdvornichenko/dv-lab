import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	googleScheduleWindow,
} from '../../packages/contracts/src/calendar.ts'
import { api } from './api.ts'
import { calendarCommandFixture, commandInput, parseCalendarResponse } from './calendar-commands.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { PRIVATE_DIR, quote, sql } from './data.ts'
import { mondayOf } from './dates.ts'
import { record, text } from './input.ts'
import { readPrivateJson, targetBinding } from './target.ts'
import { expect } from './test.ts'

async function applied(request: APIRequestContext, commandId: string) {
	await expect
		.poll(
			async () =>
				parseCalendarResponse(calendarCommandSnapshot, await api(request, 'GET', `/google/commands/${commandId}`))
					.state,
			{ timeout: 60000 }
		)
		.toBe('applied')
	return parseCalendarResponse(calendarCommandSnapshot, await api(request, 'GET', `/google/commands/${commandId}`))
}

export async function presentTombstone(request: APIRequestContext) {
	const { input, lessonId } = await create(request)
	const before = sql(
		`select event_id, representation_generation from google_event_mappings where local_entity_id = ${quote(lessonId)}::uuid and state = 'active'`
	)
	for (const operation of ['cancel', 'restore']) {
		const meta = await target(request, input.date, lessonId)
		const receipt = parseCalendarResponse(
			calendarCommandReceipt,
			await api(request, 'POST', `/schedule/lessons/${lessonId}/${operation}`, meta, 202)
		)
		await applied(request, receipt.commandId)
	}
	expect(
		sql(
			`select event_id, representation_generation from google_event_mappings where local_entity_id = ${quote(lessonId)}::uuid and state = 'active'`
		)
	).toEqual(before)
}

export async function disappearedTombstone(request: APIRequestContext) {
	const fixture = await calendarCommandFixture(request)
	const binding = targetBinding()
	const retained = z
		.strictObject({
			origin: z.string(),
			apiBuildSha: z.string(),
			persistenceFingerprint: z.string(),
			studentId: z.uuid(),
			lessonId: z.uuid(),
			date: z.iso.date(),
			naturalDisappearanceObserved: z.literal(true),
		})
		.parse(readPrivateJson(`${PRIVATE_DIR}/calendar-single.json`))
	if (
		retained.origin !== binding.origin ||
		retained.apiBuildSha !== binding.apiBuildSha ||
		retained.persistenceFingerprint !== binding.persistenceFingerprint ||
		retained.studentId !== fixture.studentId
	)
		throw new Error('Disappeared tombstone fixture does not match the runtime authority')
	const owned = sql(
		`select id from lessons where id = ${quote(retained.lessonId)}::uuid and student_id = ${quote(fixture.studentId)}::uuid and status = 'cancelled'`
	)
	expect(owned).toHaveLength(1)
	const before = sql(
		`select event_id, representation_generation::text from google_event_mappings where local_entity_id = ${quote(retained.lessonId)}::uuid and state = 'active'`
	)
	expect(before).toHaveLength(1)
	const meta = await target(request, retained.date, retained.lessonId)
	const receipt = parseCalendarResponse(
		calendarCommandReceipt,
		await api(request, 'POST', `/schedule/lessons/${retained.lessonId}/restore`, meta, 202)
	)
	await applied(request, receipt.commandId)
	const proof = sql(
		`select acknowledgement from google_command_stages where command_id = ${quote(receipt.commandId)}::uuid and acknowledgement->>'kind' = 'absence'`
	)
	expect(proof).toHaveLength(1)
	expect(record(proof[0].acknowledgement)).toMatchObject({
		calendarAccessConfirmed: true,
		identitySearchComplete: true,
		eventId: text(before[0].event_id),
	})
	const after = sql(
		`select event_id, representation_generation::text from google_event_mappings where local_entity_id = ${quote(retained.lessonId)}::uuid and state = 'active'`
	)
	expect(after).toHaveLength(1)
	expect(after[0].event_id).not.toEqual(before[0].event_id)
	expect(Number(text(after[0].representation_generation))).toBeGreaterThan(
		Number(text(before[0].representation_generation))
	)
	expect(
		sql(
			`select id from google_event_mappings where local_entity_id = ${quote(retained.lessonId)}::uuid and event_id = ${quote(text(before[0].event_id))} and state = 'retired'`
		)
	).toHaveLength(1)
	expect(
		parseCalendarResponse(
			calendarCommandReceipt,
			await api(request, 'POST', `/schedule/lessons/${retained.lessonId}/restore`, meta, 202)
		).commandId
	).toBe(receipt.commandId)
	await target(request, retained.date, retained.lessonId)
}

async function target(request: APIRequestContext, date: string, lessonId: string) {
	const window = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(date)}`)
	)
	if (window.read.state !== 'fresh') throw new Error('Single changes require a fresh real provider window')
	const event = window.events.find(
		(item) =>
			item.binding.kind === 'lesson' && item.binding.ref.kind === 'single' && item.binding.ref.lessonId === lessonId
	)
	if (!event || event.binding.kind !== 'lesson' || event.when.kind !== 'timed')
		throw new Error('Owned single is not visible')
	return { requestId: randomUUID(), expectedVersion: event.binding.version, expectedStartsAt: event.when.startsAt }
}

async function create(request: APIRequestContext) {
	const fixture = await calendarCommandFixture(request)
	const input = await commandInput(request, fixture.studentId)
	const window = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(input.date)}`)
	)
	if (window.read.state !== 'fresh') throw new Error('Single journey requires real connected Google')
	input.expectedVersion = window.read.revision
	const receipt = parseCalendarResponse(
		calendarCommandReceipt,
		await api(request, 'POST', '/schedule/lessons', input, 202)
	)
	const status = await applied(request, receipt.commandId)
	const ref = status.affectedRefs[0]
	if (ref?.kind !== 'single') throw new Error('Create did not reserve a single')
	return { input, lessonId: ref.lessonId }
}

function lessonState(lessonId: string) {
	return sql(
		`select starts_at::text, status, time_zone, duration_minutes from lessons where id = ${quote(lessonId)}::uuid`
	)
}

export async function singleChanges(request: APIRequestContext) {
	const { input, lessonId } = await create(request)
	for (const startTime of ['14:00', '15:00']) {
		const meta = await target(request, input.date, lessonId)
		const before = lessonState(lessonId)
		const fault = armCalendarFault({
			method: 'PATCH',
			resource: 'events',
			page: 'any',
			action: 'delay_response',
			delayMs: 5000,
		})
		try {
			const receipt = parseCalendarResponse(
				calendarCommandReceipt,
				await api(
					request,
					'POST',
					`/schedule/lessons/${lessonId}/move`,
					{
						...meta,
						date: input.date,
						startTime,
						expectedDefaultTimeZone: input.expectedDefaultTimeZone,
					},
					202
				)
			)
			await expect
				.poll(() => calendarFaultEvidence(fault).some((entry) => entry.phase === 'response_held'), { timeout: 20000 })
				.toBe(true)
			expect(lessonState(lessonId)).toEqual(before)
			await applied(request, receipt.commandId)
			expect(lessonState(lessonId)).not.toEqual(before)
		} finally {
			disarmCalendarFault(fault)
		}
	}
	for (const operation of ['cancel', 'restore']) {
		const meta = await target(request, input.date, lessonId)
		const receipt = parseCalendarResponse(
			calendarCommandReceipt,
			await api(request, 'POST', `/schedule/lessons/${lessonId}/${operation}`, meta, 202)
		)
		await applied(request, receipt.commandId)
		expect(record(lessonState(lessonId)[0]).status).toBe(operation === 'cancel' ? 'cancelled' : 'scheduled')
	}
	const meta = await target(request, input.date, lessonId)
	const before = lessonState(lessonId)
	const rejected = record(
		await api(
			request,
			'POST',
			`/schedule/lessons/${lessonId}/cancel`,
			{ ...meta, expectedStartsAt: '2000-01-01T00:00:00.000Z' },
			409
		)
	)
	expect(record(rejected.error).code).toBe('precondition_failed')
	expect(lessonState(lessonId)).toEqual(before)
}

export async function singleRace(request: APIRequestContext) {
	const { input, lessonId } = await create(request)
	const meta = await target(request, input.date, lessonId)
	const receipt = parseCalendarResponse(
		calendarCommandReceipt,
		await api(request, 'POST', `/schedule/lessons/${lessonId}/cancel`, meta, 202)
	)
	const rejected = record(
		await api(request, 'POST', `/schedule/lessons/${lessonId}/cancel`, { ...meta, requestId: randomUUID() }, 409)
	)
	expect(['command_pending', 'precondition_failed']).toContain(text(record(rejected.error).code))
	await applied(request, receipt.commandId)
	expect(
		parseCalendarResponse(
			calendarCommandReceipt,
			await api(request, 'POST', `/schedule/lessons/${lessonId}/cancel`, meta, 202)
		).commandId
	).toBe(receipt.commandId)
	await api(request, 'POST', `/schedule/lessons/${lessonId}/restore`, { ...meta, requestId: randomUUID() }, 409)
}
