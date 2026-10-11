import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import { googleScheduleWindow } from '../../packages/contracts/src/calendar.ts'
import { api } from './api.ts'
import { calendarCommandFixture, parseCalendarResponse } from './calendar-commands.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { PRIVATE_DIR, quote, sql } from './data.ts'
import { mondayOf } from './dates.ts'
import { record } from './input.ts'
import { readPrivateJson, targetBinding } from './target.ts'
import { expect } from './test.ts'

export async function admissionBudget(request: APIRequestContext) {
	const fixture = await calendarCommandFixture(request)
	const retained = z
		.strictObject({
			origin: z.string(),
			apiBuildSha: z.string(),
			persistenceFingerprint: z.string(),
			studentId: z.uuid(),
			lessonId: z.uuid(),
			date: z.iso.date(),
			naturalDisappearanceObserved: z.literal(true),
			identityPageCount: z.number().int().min(6),
		})
		.parse(readPrivateJson(`${PRIVATE_DIR}/calendar-admission.json`))
	const binding = targetBinding()
	expect(retained.origin).toBe(binding.origin)
	expect(retained.apiBuildSha).toBe(binding.apiBuildSha)
	expect(retained.persistenceFingerprint).toBe(binding.persistenceFingerprint)
	expect(retained.studentId).toBe(fixture.studentId)
	const window = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(retained.date)}`)
	)
	expect(window.read.state).toBe('fresh')
	const event = window.events.find(
		(item) =>
			item.binding.kind === 'lesson' &&
			item.binding.ref.kind === 'single' &&
			item.binding.ref.lessonId === retained.lessonId
	)
	if (!event || event.binding.kind !== 'lesson' || event.when.kind !== 'timed')
		throw new Error('Retained single is not visible')
	const requestId = randomUUID()
	const before = sql(
		`select status, starts_at from lessons where id = ${quote(retained.lessonId)}::uuid and student_id = ${quote(fixture.studentId)}::uuid`
	)
	expect(before).toHaveLength(1)
	const fault = armCalendarFault({
		method: 'GET',
		resource: 'events',
		page: 'any',
		action: 'delay_response',
		delayMs: 6500,
		pageSize: 1,
	})
	try {
		const started = performance.now()
		const response = await request
			.fetch<unknown>(`${binding.origin}/api/schedule/lessons/${retained.lessonId}/restore`, {
				method: 'POST',
				headers: { origin: binding.origin },
				timeout: 40000,
				failOnStatusCode: false,
				data: { requestId, expectedVersion: event.binding.version, expectedStartsAt: event.when.startsAt },
			})
			.catch(() => {
				throw new Error('Public admission request failed; details suppressed')
			})
		expect(response.status()).toBe(409)
		const body = record(await response.json())
		await response.dispose()
		expect(performance.now() - started).toBeLessThan(35000)
		expect(performance.now() - started).toBeGreaterThan(25000)
		expect(record(body.error).code).toBe('not_applied')
		expect(calendarFaultEvidence(fault).filter((item) => item.phase === 'response_held').length).toBeGreaterThanOrEqual(
			4
		)
		await api(request, 'GET', `/google/commands/by-request/${requestId}`, undefined, 404)
		expect(sql(`select status, starts_at from lessons where id = ${quote(retained.lessonId)}::uuid`)).toEqual(before)
	} finally {
		disarmCalendarFault(fault)
	}
}
