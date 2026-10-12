import type { APIRequestContext } from '@playwright/test'

import { z } from 'zod'

import {
	googleConflictRequest,
	googleConflictResult,
	googleScheduleWindow,
} from '../../packages/contracts/src/calendar.ts'
import { api } from './api.ts'
import { calendarCommandFixture, parseCalendarResponse } from './calendar-commands.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { BASE, PRIVATE_DIR } from './data.ts'
import { readPrivateJson, targetBinding } from './target.ts'
import { expect, test } from './test.ts'

const cases = z
	.array(
		z.strictObject({
			name: z.enum([
				'single',
				'finite_last_overlap',
				'all_pages',
				'all_day_exclusive',
				'DST',
				'exact_instance',
				'missing_check_through',
				'stale_context',
			]),
			weekStart: z.iso.date(),
			request: googleConflictRequest,
			expectedState: z.enum(['complete', 'not_checked', 'unavailable']),
			expectedEventKeys: z.array(z.string()),
			expectedMatches: z
				.array(z.strictObject({ eventKey: z.string(), startsAt: z.array(z.iso.datetime()).min(1) }))
				.optional(),
			expectedRange: z
				.strictObject({ start: z.iso.datetime(), end: z.iso.datetime(), timeZone: z.string() })
				.optional(),
		})
	)
	.min(8)

async function conflictFixture(request: APIRequestContext) {
	const owner = await calendarCommandFixture(request)
	const binding = targetBinding()
	const fixture = z
		.strictObject({
			origin: z.string(),
			apiBuildSha: z.string(),
			persistenceFingerprint: z.string(),
			accountId: z.uuid(),
			studentId: z.uuid(),
			expiresAt: z.iso.datetime(),
			cases,
		})
		.parse(readPrivateJson(`${PRIVATE_DIR}/calendar-conflicts.json`))
	if (
		fixture.origin !== binding.origin ||
		fixture.apiBuildSha !== binding.apiBuildSha ||
		fixture.persistenceFingerprint !== binding.persistenceFingerprint ||
		fixture.accountId !== owner.accountId ||
		fixture.studentId !== owner.studentId ||
		Date.parse(fixture.expiresAt) <= Date.now()
	)
		throw new Error('Conflict fixture does not match the retained runtime authority')
	return fixture
}

export async function conflictsJourney(request: APIRequestContext) {
	test.setTimeout(300000)
	const fixture = await conflictFixture(request)
	expect(new Set(fixture.cases.map((sample) => sample.name))).toEqual(
		new Set([
			'single',
			'finite_last_overlap',
			'all_pages',
			'all_day_exclusive',
			'DST',
			'exact_instance',
			'missing_check_through',
			'stale_context',
		])
	)
	for (const sample of fixture.cases) {
		const input = await freshRequest(request, sample)
		const result = await postCheck(request, input)
		expect(result.state, sample.name).toBe(sample.expectedState)
		if (result.state === 'complete') {
			expect(sample.expectedRange).toBeDefined()
			expect(result.complete).toBe(true)
			expect(result.events.map((event) => event.eventKey).sort()).toEqual([...sample.expectedEventKeys].sort())
			if (sample.expectedRange) expect(result.checkedRange).toEqual(sample.expectedRange)
			if (sample.name === 'finite_last_overlap') expect(sample.expectedMatches?.length).toBeGreaterThan(0)
			for (const match of sample.expectedMatches ?? [])
				expect(result.events.find((event) => event.eventKey === match.eventKey)?.matchedStartsAt).toEqual(
					match.startsAt
				)
			for (const event of result.events) {
				expect(event.blocksTime).toBe(true)
				expect(event.status).not.toBe('cancelled')
				expect(event.matchedStartsAt.length).toBeGreaterThan(0)
			}
		}
	}
	const paged = fixture.cases.find((sample) => sample.name === 'all_pages')
	if (!paged) throw new Error('Retained several-page conflict case is required')
	const input = await freshRequest(request, paged)
	const fault = armCalendarFault({
		method: 'GET',
		resource: 'events',
		page: 'next',
		action: 'drop_response',
		delayMs: 0,
	})
	try {
		const result = await postCheck(request, input)
		expect(result.state).toBe('unavailable')
		expect(calendarFaultEvidence(fault).some((item) => item.phase === 'response_dropped')).toBe(true)
	} finally {
		disarmCalendarFault(fault)
	}
}

async function postCheck(request: APIRequestContext, input: z.infer<typeof googleConflictRequest>) {
	const response = await request.post<unknown>(`${BASE}/api/google/conflicts`, {
		headers: { origin: BASE },
		data: input,
	})
	expect(response.status()).toBe(200)
	const raw: unknown = await response.json()
	return parseCalendarResponse(googleConflictResult, raw)
}

async function freshRequest(request: APIRequestContext, sample: z.infer<typeof cases>[number]) {
	const view = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${sample.weekStart}`)
	)
	if (sample.name === 'stale_context') return sample.request
	if (view.read.state !== 'fresh' || view.write.state !== 'ready')
		throw new Error('Conflict fixture requires a ready complete read')
	const input = sample.request
	if (input.proposal.operation === 'create') return { ...input, expectedVersion: view.read.revision }
	const ref = input.editedRef
	if (!ref) throw new Error('Retained target reference is required')
	if (input.proposal.operation === 'move_series' && ref.kind === 'series') {
		const context = view.series.find((item) => item.series.id === ref.seriesId)
		if (!context) throw new Error('Retained whole-series context is required')
		return { ...input, expectedVersion: context.version }
	}
	const event = view.events.find(
		(item) => item.binding.kind === 'lesson' && JSON.stringify(item.binding.ref) === JSON.stringify(ref)
	)
	if (event?.binding.kind !== 'lesson') throw new Error('Retained occurrence context is required')
	return { ...input, expectedVersion: event.binding.version }
}
