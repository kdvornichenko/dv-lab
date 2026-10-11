import { expect, type APIRequestContext } from '@playwright/test'

import { createHash } from 'node:crypto'

import {
	googleScheduleWindow,
	nextLessonRead,
	type GoogleScheduleWindow,
} from '../../packages/contracts/src/calendar.ts'
import { saveStudentRequest } from '../../packages/contracts/src/students.ts'
import { api } from './api.ts'
import { parseCalendarResponse } from './calendar-commands.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { calendarReadFixture, requireUncachedWindow, type CalendarReadFixture } from './calendar-read-fixture.ts'
import { teacherCredentials } from './data.ts'
import { list, record } from './input.ts'

async function withReadFixture(request: APIRequestContext, check: (fixture: CalendarReadFixture) => Promise<void>) {
	await api(request, 'POST', '/auth/sign-in', teacherCredentials())
	try {
		await check(await calendarReadFixture(request))
	} finally {
		await api(request, 'POST', '/auth/sign-out', undefined, 204)
	}
}

async function windowFor(request: APIRequestContext, start: string) {
	return parseCalendarResponse(googleScheduleWindow, await api(request, 'GET', `/schedule/week?start=${start}`))
}

function eventFacts(window: GoogleScheduleWindow) {
	const facts = window.events.map(({ editBlock: _editBlock, ...event }) => event)
	return createHash('sha256').update(JSON.stringify(facts)).digest('hex')
}

function firstPageLesson(window: GoogleScheduleWindow, fixture: CalendarReadFixture) {
	const event = window.events[0]
	expect(window.events.length >= 2, 'The real provider fixture spans at least two one-event pages').toBe(true)
	expect(
		event?.binding.kind === 'lesson' &&
			event.binding.ref.kind === 'single' &&
			event.binding.ref.lessonId === fixture.first.lessonId &&
			event.when.kind === 'timed' &&
			event.when.startsAt === fixture.first.startsAt,
		'The first real provider page proves the earliest synthetic lesson'
	).toBe(true)
}

async function requireDroppedResponse(ruleId: string) {
	const evidence = await calendarFaultEvidence(ruleId)
	expect(
		evidence.some((item) => item.phase === 'response_dropped' && item.status === 200),
		'A real successful provider response was lost at the owned transport'
	).toBe(true)
}

export async function calendarWindowRecovery(request: APIRequestContext) {
	await withReadFixture(request, async (fixture) => {
		const before = await windowFor(request, fixture.weekStart)
		expect(before.read.state === 'fresh' && before.write.state === 'ready', 'A complete writable snapshot exists').toBe(
			true
		)
		if (before.read.state !== 'fresh') throw new Error('A fresh Calendar snapshot is required')
		firstPageLesson(before, fixture)
		const next = await armCalendarFault({
			method: 'GET',
			resource: 'events',
			page: 'next',
			action: 'drop_response',
			delayMs: 0,
			pageSize: 1,
		})
		try {
			const after = await windowFor(request, fixture.weekStart)
			expect(
				after.read.state === 'last_known' && after.write.state === 'blocked',
				'Partial traversal stays read-only'
			).toBe(true)
			if (after.read.state !== 'last_known') throw new Error('The previous complete window must remain available')
			expect(
				after.read.revision === before.read.revision && after.read.fetchedAt === before.read.fetchedAt,
				'A partial page never replaces the complete revision'
			).toBe(true)
			expect(eventFacts(after) === eventFacts(before), 'All complete event facts survive the failed next page').toBe(
				true
			)
			await requireDroppedResponse(next)
		} finally {
			await disarmCalendarFault(next)
		}
		requireUncachedWindow(fixture)
		const first = await armCalendarFault({
			method: 'GET',
			resource: 'events',
			page: 'first',
			action: 'drop_response',
			delayMs: 0,
		})
		try {
			const unavailable = await windowFor(request, fixture.uncachedWeekStart)
			expect(
				unavailable.requestedRange.start === fixture.uncachedWindowStart,
				'The absence check covers the requested range'
			).toBe(true)
			expect(
				unavailable.read.state === 'unavailable' &&
					unavailable.snapshotRange === null &&
					unavailable.events.length === 0,
				'An unchecked range never becomes an empty confirmed calendar'
			).toBe(true)
			await requireDroppedResponse(first)
		} finally {
			await disarmCalendarFault(first)
		}
	})
}

function cardFor(response: unknown, studentId: string) {
	const student = list(record(response).students)
		.map(record)
		.find((item) => item.id === studentId)
	if (!student) throw new Error('The owned Calendar fixture card is absent')
	return student
}

function cardNext(response: unknown, studentId: string) {
	return parseCalendarResponse(nextLessonRead, cardFor(response, studentId).nextLesson)
}

export async function calendarNextPrefixRecovery(request: APIRequestContext) {
	await withReadFixture(request, async (fixture) => {
		const window = await windowFor(request, fixture.weekStart)
		firstPageLesson(window, fixture)
		const before = await api(request, 'GET', '/students')
		expect(
			cardNext(before, fixture.first.id).result === 'known' && cardNext(before, fixture.later.id).result === 'known',
			'Both mapped lessons have a checked next time'
		).toBe(true)
		expect(cardNext(before, fixture.none.id).result === 'none', 'An unbound synthetic card has no next lesson').toBe(
			true
		)
		const rule = await armCalendarFault({
			method: 'GET',
			resource: 'events',
			page: 'next',
			action: 'drop_response',
			delayMs: 0,
			pageSize: 1,
		})
		try {
			const partial = await api(request, 'GET', '/students')
			const known = cardNext(partial, fixture.first.id)
			const unknown = cardNext(partial, fixture.later.id)
			const none = cardNext(partial, fixture.none.id)
			expect(
				known.result === 'known' && known.startsAt === fixture.first.startsAt && known.status.state === 'fresh',
				'A verified ordered prefix keeps its first next lesson'
			).toBe(true)
			expect(
				unknown.result === 'unknown' && unknown.startsAt === null && unknown.status.state === 'unavailable',
				'A failed remaining page is unknown, never none'
			).toBe(true)
			expect(
				none.result === 'none' && none.startsAt === null,
				'A proven empty synthetic card remains distinct from unknown'
			).toBe(true)
			await requireDroppedResponse(rule)
		} finally {
			await disarmCalendarFault(rule)
		}
	})
}

export async function calendarCachedNext(request: APIRequestContext) {
	await withReadFixture(request, async (fixture) => {
		const listed = await api(request, 'GET', '/students')
		const before = cardNext(listed, fixture.first.id)
		expect(
			before.result === 'known' && before.startsAt === fixture.first.startsAt,
			'The next time was checked against the provider'
		).toBe(true)
		const current = record(record(await api(request, 'GET', `/students/${fixture.first.id}`)).student)
		const detailNext = parseCalendarResponse(nextLessonRead, current.nextLesson)
		expect(
			detailNext.result === 'known' && detailNext.startsAt === fixture.first.startsAt,
			'The detail response has the same checked next instant'
		).toBe(true)
		const input = parseCalendarResponse(saveStudentRequest, {
			displayName: current.displayName,
			rateMinor: current.rateMinor,
			currency: current.currency,
			defaultLessonMinutes: current.defaultLessonMinutes,
			parent: current.parent,
			level: current.level,
			goals: current.goals,
			timeZone: current.timeZone,
			noShowDeducts: current.noShowDeducts,
		})
		const response = record(await api(request, 'PATCH', `/students/${fixture.first.id}`, input))
		const saved = parseCalendarResponse(nextLessonRead, record(response.student).nextLesson)
		expect(
			saved.result === 'known' && saved.startsAt === fixture.first.startsAt && saved.status.state === 'last_known',
			'A card mutation preserves the checked instant and labels its cached status honestly'
		).toBe(true)
	})
}
