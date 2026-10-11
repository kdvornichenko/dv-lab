import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	googleScheduleWindow,
} from '../../packages/contracts/src/calendar.ts'
import { occurrenceAt, scheduleDate, seriesStart, zonedParts } from '../../packages/core/src/index.ts'
import { api, readSettings } from './api.ts'
import { calendarCommandFixture, parseCalendarResponse } from './calendar-commands.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { PRIVATE_DIR, quote, sql } from './data.ts'
import { mondayOf } from './dates.ts'
import { record } from './input.ts'
import { readPrivateJson, targetBinding } from './target.ts'
import { expect, test } from './test.ts'
import { setMain } from './tz-settings.ts'

const sample = z.strictObject({
	date: z.iso.date(),
	startTime: z.string(),
	timeZone: z.string(),
	sampleOn: z.array(z.iso.date()).min(1),
	outcome: z.enum(['applied', 'gap_rejected']),
	transport: z.enum(['delay_response', 'drop_response']),
})

async function recurringFixture(request: APIRequestContext) {
	const fixture = await calendarCommandFixture(request)
	const binding = targetBinding()
	const input = z
		.strictObject({
			origin: z.string(),
			apiBuildSha: z.string(),
			persistenceFingerprint: z.string(),
			studentId: z.uuid(),
			masterCases: z.array(sample).min(1),
			finiteSeriesIds: z.array(z.uuid()).min(1),
			instance: sample,
			lookupFailures: z
				.array(
					z.strictObject({
						seriesId: z.uuid(),
						originalOn: z.iso.date(),
						expectedVersion: z.string(),
						scenario: z.enum(['missing', 'ambiguous']),
					})
				)
				.min(2),
		})
		.parse(readPrivateJson(`${PRIVATE_DIR}/calendar-recurring.json`))
	expect(input.origin).toBe(binding.origin)
	expect(input.apiBuildSha).toBe(binding.apiBuildSha)
	expect(input.persistenceFingerprint).toBe(binding.persistenceFingerprint)
	expect(input.studentId).toBe(fixture.studentId)
	return input
}

async function window(request: APIRequestContext, date: string) {
	const value = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(date)}`)
	)
	expect(value.read.state).toBe('fresh')
	return value
}

async function applied(request: APIRequestContext, id: string) {
	await expect
		.poll(
			async () =>
				parseCalendarResponse(calendarCommandSnapshot, await api(request, 'GET', `/google/commands/${id}`)).state,
			{ timeout: 60000 }
		)
		.toBe('applied')
	const result = parseCalendarResponse(calendarCommandSnapshot, await api(request, 'GET', `/google/commands/${id}`))
	expect(result.effect).toBe('confirmed')
	return result
}

async function createMaster(request: APIRequestContext, studentId: string, input: z.infer<typeof sample>) {
	await setMain(request, input.timeZone)
	const view = await window(request, input.date)
	if (view.read.state !== 'fresh') throw new Error('Fresh provider coverage is required')
	const body = {
		studentId,
		date: input.date,
		startTime: input.startTime,
		repeats: 'weekly',
		durationMinutes: 60,
		requestId: randomUUID(),
		expectedDefaultTimeZone: input.timeZone,
		expectedVersion: view.read.revision,
	}
	if (input.outcome === 'gap_rejected') {
		const refused = record(await api(request, 'POST', '/schedule/lessons', body, 400))
		expect(record(refused.error).code).toBe('nonexistent_local_time')
		await api(request, 'GET', `/google/commands/by-request/${body.requestId}`, undefined, 404)
		return null
	}
	const fault = armCalendarFault({
		method: 'POST',
		resource: 'events',
		page: 'any',
		action: input.transport,
		delayMs: input.transport === 'delay_response' ? 5000 : 0,
	})
	try {
		const receipt = parseCalendarResponse(
			calendarCommandReceipt,
			await api(request, 'POST', '/schedule/lessons', body, 202)
		)
		const pending = parseCalendarResponse(
			calendarCommandSnapshot,
			await api(request, 'GET', `/google/commands/${receipt.commandId}`)
		)
		const ref = pending.affectedRefs[0]
		if (ref?.kind !== 'series') throw new Error('Master command did not reserve a series')
		if (input.transport === 'delay_response') {
			await expect
				.poll(() => calendarFaultEvidence(fault).some((item) => item.phase === 'response_held'), { timeout: 20000 })
				.toBe(true)
			expect(sql(`select id from lesson_series where id = ${quote(ref.seriesId)}::uuid`)).toHaveLength(0)
		}
		await applied(request, receipt.commandId)
		const fresh = await window(request, input.date)
		if (fresh.read.state !== 'fresh') throw new Error('Fresh master coverage is required')
		const duplicate = record(
			await api(
				request,
				'POST',
				'/schedule/lessons',
				{ ...body, requestId: randomUUID(), expectedVersion: fresh.read.revision },
				409
			)
		)
		expect(record(duplicate.error).code).toBe('precondition_failed')
		expect(
			parseCalendarResponse(calendarCommandReceipt, await api(request, 'POST', '/schedule/lessons', body, 202))
		).toEqual(receipt)
		const stages = sql(
			`select request, acknowledgement from google_command_stages where command_id = ${quote(receipt.commandId)}::uuid and kind = 'write'`
		)
		expect(stages).toHaveLength(1)
		expect(record(stages[0].acknowledgement).kind).toBe('master')
		const evidence = calendarFaultEvidence(fault)
		expect(evidence.filter((item) => item.phase === 'request_matched')).toHaveLength(1)
		expect(evidence.some((item) => item.status !== null && item.status >= 200 && item.status < 300)).toBe(true)
		expect(
			sql(
				`select id from google_event_mappings where local_entity_id = ${quote(ref.seriesId)}::uuid and entity_kind = 'series' and state = 'active'`
			)
		).toHaveLength(1)
		return ref.seriesId
	} finally {
		disarmCalendarFault(fault)
	}
}

async function parity(request: APIRequestContext, seriesId: string, dates: readonly string[], studentId: string) {
	for (const date of dates) {
		const view = await window(request, date)
		const context = view.series.find((item) => item.series.id === seriesId)
		if (!context) throw new Error('Verified recurring context is unavailable')
		expect(context.series.studentId).toBe(studentId)
		const expected = occurrenceAt(context.series, date)
		const actual = view.events.filter(
			(event) =>
				event.binding.kind === 'lesson' &&
				event.binding.ref.kind === 'series' &&
				event.binding.ref.seriesId === seriesId &&
				event.binding.ref.originalOn === date
		)
		if (!expected) {
			expect(actual).toHaveLength(0)
			continue
		}
		expect(actual).toHaveLength(1)
		expect(actual[0].when).toMatchObject({ kind: 'timed', startsAt: expected.startsAt.toISOString() })
	}
}

async function masterJourney(request: APIRequestContext) {
	const fixture = await recurringFixture(request)
	const original = await readSettings(request)
	try {
		for (const input of fixture.masterCases) {
			const id = await createMaster(request, fixture.studentId, input)
			if (!id) continue
			await parity(request, id, input.sampleOn, fixture.studentId)
			const before = sql(
				`select event_id from google_event_mappings where local_entity_id = ${quote(id)}::uuid and state = 'active'`
			)
			const commands = sql(
				`select id from google_commands where plan->'input'->>'studentId' = ${quote(fixture.studentId)}`
			)
			await setMain(request, input.timeZone === 'UTC' ? 'Asia/Ho_Chi_Minh' : 'UTC')
			expect(
				sql(`select id from google_commands where plan->'input'->>'studentId' = ${quote(fixture.studentId)}`)
			).toEqual(commands)
			expect(
				sql(
					`select event_id from google_event_mappings where local_entity_id = ${quote(id)}::uuid and state = 'active'`
				)
			).toEqual(before)
		}
		for (const id of fixture.finiteSeriesIds) {
			const view = await window(request, fixture.instance.date)
			const context = view.series.find((item) => item.series.id === id)
			if (!context?.series.endsOn) throw new Error('Retained finite master is unavailable')
			await parity(request, id, [context.series.startsOn, context.series.endsOn], fixture.studentId)
		}
	} finally {
		await setMain(request, original.defaultTimeZone)
	}
}

async function instanceJourney(request: APIRequestContext) {
	const fixture = await recurringFixture(request)
	const id = await createMaster(request, fixture.studentId, fixture.instance)
	if (!id) throw new Error('Instance fixture must create a real master')
	const view = await window(request, fixture.instance.date)
	const context = view.series.find((item) => item.series.id === id)
	if (!context) throw new Error('Real master context is unavailable')
	const originalOn = fixture.instance.sampleOn[0]
	const natural = seriesStart(context.series, originalOn)
	if (!natural) throw new Error('Natural instance must exist')
	const before = sql(`select id from lessons where student_id = ${quote(fixture.studentId)}::uuid`)
	const marks = sql(`select id, kind from lesson_marks where series_id = ${quote(id)}::uuid order by id`)
	for (const operation of ['move', 'cancel', 'restore'] as const) {
		const settings = await readSettings(request)
		const current = await window(request, scheduleDate(natural, settings.defaultTimeZone))
		const event = current.events.find(
			(item) =>
				item.binding.kind === 'lesson' &&
				item.binding.ref.kind === 'series' &&
				item.binding.ref.seriesId === id &&
				item.binding.ref.originalOn === originalOn
		)
		if (!event || event.binding.kind !== 'lesson' || event.when.kind !== 'timed')
			throw new Error('Canonical instance is unavailable')
		const body = {
			requestId: randomUUID(),
			expectedVersion: event.binding.version,
			expectedStartsAt: event.when.startsAt,
		}
		const input =
			operation === 'move'
				? {
						...body,
						date: scheduleDate(natural, settings.defaultTimeZone),
						startTime:
							zonedParts(new Date(event.when.startsAt), settings.defaultTimeZone).time === '18:00' ? '19:00' : '18:00',
						expectedDefaultTimeZone: settings.defaultTimeZone,
					}
				: body
		const previous = sql(
			`select original_on, kind, starts_at from lesson_exceptions where series_id = ${quote(id)}::uuid`
		)
		const siblings = current.events
			.filter(
				(item) =>
					item.binding.kind === 'lesson' &&
					item.binding.ref.kind === 'series' &&
					item.binding.ref.seriesId === id &&
					item.binding.ref.originalOn !== originalOn
			)
			.map((item) => ({ eventKey: item.eventKey, when: item.when }))
		const fault = armCalendarFault({
			method: 'PATCH',
			resource: 'events',
			page: 'any',
			action: operation === 'move' ? 'drop_response' : 'delay_response',
			delayMs: operation === 'move' ? 0 : 5000,
		})
		try {
			const receipt = parseCalendarResponse(
				calendarCommandReceipt,
				await api(request, 'POST', `/schedule/series/${id}/occurrences/${originalOn}/${operation}`, input, 202)
			)
			if (operation !== 'move') {
				await expect
					.poll(() => calendarFaultEvidence(fault).some((item) => item.phase === 'response_held'), { timeout: 20000 })
					.toBe(true)
				expect(
					sql(`select original_on, kind, starts_at from lesson_exceptions where series_id = ${quote(id)}::uuid`)
				).toEqual(previous)
			}
			await applied(request, receipt.commandId)
			const stale = record(
				await api(
					request,
					'POST',
					`/schedule/series/${id}/occurrences/${originalOn}/${operation}`,
					{ ...input, requestId: randomUUID() },
					409
				)
			)
			expect(record(stale.error).code).toBe('precondition_failed')
			const after = await window(request, scheduleDate(natural, settings.defaultTimeZone))
			expect(
				after.events
					.filter(
						(item) =>
							item.binding.kind === 'lesson' &&
							item.binding.ref.kind === 'series' &&
							item.binding.ref.seriesId === id &&
							item.binding.ref.originalOn !== originalOn
					)
					.map((item) => ({ eventKey: item.eventKey, when: item.when }))
			).toEqual(siblings)
			expect(calendarFaultEvidence(fault).filter((item) => item.phase === 'request_matched')).toHaveLength(1)
			const stages = sql(
				`select request from google_command_stages where command_id = ${quote(receipt.commandId)}::uuid and kind = 'write'`
			)
			expect(stages.every((stage) => record(stage.request).method === 'patch')).toBe(true)
		} finally {
			disarmCalendarFault(fault)
		}
		expect(
			sql(
				`select original_on, kind from lesson_exceptions where series_id = ${quote(id)}::uuid and original_on = ${quote(originalOn)}::date`
			)
		).toHaveLength(1)
		expect(sql(`select id from lessons where student_id = ${quote(fixture.studentId)}::uuid`)).toEqual(before)
		expect(sql(`select id, kind from lesson_marks where series_id = ${quote(id)}::uuid order by id`)).toEqual(marks)
	}
	const mapping = sql(
		`select event_id, original_start_time from google_event_mappings where local_entity_id = ${quote(id)}::uuid and entity_kind = 'occurrence' and original_on = ${quote(originalOn)}::date and state = 'active'`
	)
	expect(mapping).toHaveLength(1)
	expect(record(mapping[0].original_start_time).dateTime).toBe(natural.toISOString())
	for (const failure of fixture.lookupFailures) {
		const receipt = parseCalendarResponse(
			calendarCommandReceipt,
			await api(
				request,
				'POST',
				`/schedule/series/${failure.seriesId}/occurrences/${failure.originalOn}/cancel`,
				{ requestId: randomUUID(), expectedVersion: failure.expectedVersion },
				202
			)
		)
		const status = parseCalendarResponse(
			calendarCommandSnapshot,
			await api(request, 'GET', `/google/commands/${receipt.commandId}`)
		)
		expect(status.state).toBe('recovery_required')
		expect(status.confirmedRevision).toBeNull()
		await expect
			.poll(
				async () =>
					parseCalendarResponse(
						calendarCommandSnapshot,
						await api(request, 'GET', `/google/commands/${receipt.commandId}`)
					).state,
				{ timeout: 40000 }
			)
			.toBe('failed')
	}
}

export async function recurringJourney(request: APIRequestContext, kind: 'master' | 'instance') {
	test.setTimeout(240000)
	if (kind === 'master') await masterJourney(request)
	else await instanceJourney(request)
}
