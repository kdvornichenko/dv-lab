import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	googleConnectionSnapshot,
	googleScheduleWindow,
	googleUnresolvedCommandsResponse,
} from '../../packages/contracts/src/calendar.ts'
import { api, readSettings } from './api.ts'
import { HTTPS_TARGET, PRIVATE_DIR } from './data.ts'
import { addDays, mondayOf, vnToday } from './dates.ts'
import { record } from './input.ts'
import { readPrivateJson, targetBinding } from './target.ts'
import { expect } from './test.ts'

export function calendarCommandFixture() {
	if (!HTTPS_TARGET) throw new Error('Connected command journeys require the attested HTTPS target')
	const binding = targetBinding()
	const fixture = z
		.strictObject({
			origin: z.string(),
			apiBuildSha: z.string(),
			persistenceFingerprint: z.string(),
			studentId: z.uuid(),
			commandWritesAuthorized: z.literal(true),
			expiresAt: z.iso.datetime(),
		})
		.parse(readPrivateJson(`${PRIVATE_DIR}/calendar-command.json`))
	if (
		fixture.origin !== binding.origin ||
		fixture.apiBuildSha !== binding.apiBuildSha ||
		fixture.persistenceFingerprint !== binding.persistenceFingerprint ||
		Date.parse(fixture.expiresAt) <= Date.now()
	)
		throw new Error('Calendar command fixture does not match the active runtime authority')
	return fixture
}

async function commandInput(request: APIRequestContext, studentId: string) {
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
	const connection = googleConnectionSnapshot.parse(await api(request, 'GET', '/google/connection'))
	expect(connection.state, 'This journey requires a disconnected runtime').toBe('not_connected')
	const input = await commandInput(request, randomUUID())
	const before = googleUnresolvedCommandsResponse.parse(await api(request, 'GET', '/google/commands?state=unresolved'))
	const refused = record(await api(request, 'POST', '/schedule/lessons', input, 409))
	expect(record(refused.error).code).toBe('connection_required')
	await api(request, 'GET', `/google/commands/by-request/${input.requestId}`, undefined, 404)
	expect(await api(request, 'GET', '/google/commands?state=unresolved')).toEqual(before)
	for (const action of ['move', 'cancel', 'restore']) {
		await api(request, 'POST', `/schedule/lessons/${input.studentId}/${action}`, {}, 409)
	}
}

export async function commandTracer(request: APIRequestContext, studentId: string) {
	const input = await commandInput(request, studentId)
	const window = googleScheduleWindow.parse(await api(request, 'GET', `/schedule/week?start=${mondayOf(input.date)}`))
	expect(window.read.state, 'Real connected provider window').toBe('fresh')
	if (window.read.state !== 'fresh') throw new Error('Real provider readiness is required')
	input.expectedVersion = window.read.revision
	const receipt = calendarCommandReceipt.parse(await api(request, 'POST', '/schedule/lessons', input, 202))
	expect(calendarCommandReceipt.parse(await api(request, 'POST', '/schedule/lessons', input, 202))).toEqual(receipt)
	const conflict = record(await api(request, 'POST', '/schedule/lessons', { ...input, startTime: '14:00' }, 409))
	expect(record(conflict.error).code).toBe('precondition_failed')
	const lookup = calendarCommandSnapshot.parse(
		await api(request, 'GET', `/google/commands/by-request/${input.requestId}`)
	)
	expect(lookup.commandId).toBe(receipt.commandId)
	await expect
		.poll(
			async () => {
				const status = calendarCommandSnapshot.parse(await api(request, 'GET', `/google/commands/${receipt.commandId}`))
				return status.state
			},
			{ timeout: 60000 }
		)
		.toBe('applied')
	const status = calendarCommandSnapshot.parse(await api(request, 'GET', `/google/commands/${receipt.commandId}`))
	expect(status.effect).toBe('confirmed')
	expect(status.confirmedRevision).not.toBeNull()
	expect(status.affectedRefs).toHaveLength(1)
	expect(calendarCommandReceipt.parse(await api(request, 'POST', '/schedule/lessons', input, 202))).toEqual(receipt)
	const after = googleScheduleWindow.parse(await api(request, 'GET', `/schedule/week?start=${mondayOf(input.date)}`))
	expect(after.read.state).toBe('fresh')
	const ref = status.affectedRefs[0]
	expect(
		after.events.filter(
			(event) => event.binding.kind === 'lesson' && JSON.stringify(event.binding.ref) === JSON.stringify(ref)
		)
	).toHaveLength(1)
	const stale = record(await api(request, 'POST', '/schedule/lessons', { ...input, requestId: randomUUID() }, 409))
	expect(record(stale.error).code).toBe('precondition_failed')
}
