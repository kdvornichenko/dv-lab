import type { APIRequestContext } from '@playwright/test'

import { randomUUID } from 'node:crypto'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	googleScheduleWindow,
} from '../../packages/contracts/src/calendar.ts'
import { googleCommandPlan } from '../../packages/db/src/calendar-values.ts'
import { api, readSettings, studentFacts } from './api.ts'
import { calendarCommandFixture, parseCalendarResponse } from './calendar-commands.ts'
import { armCalendarFault, calendarFaultEvidence, disarmCalendarFault } from './calendar-fault-control.ts'
import { recurringJourney } from './calendar-recurring.ts'
import { quote, sql } from './data.ts'
import { mondayOf } from './dates.ts'
import { record } from './input.ts'
import { expect, test } from './test.ts'
import { setMain } from './tz-settings.ts'

type CutCase = NonNullable<Awaited<ReturnType<typeof calendarCommandFixture>>['cuts']>['cases'][number]

function domain(id: string) {
	return {
		series: sql(`select id, ends_on from lesson_series where id = ${quote(id)}::uuid`),
		lessons: sql(
			`select id, starts_at, time_zone, duration_minutes, status from lessons where student_id = (select student_id from lesson_series where id = ${quote(id)}::uuid) order by id`
		),
		exceptions: sql(
			`select original_on, kind, starts_at, duration_minutes from lesson_exceptions where series_id = ${quote(id)}::uuid order by original_on`
		),
		marks: sql(`select id, kind from lesson_marks where series_id = ${quote(id)}::uuid order by id`),
	}
}

async function cutInput(request: APIRequestContext, sample: CutCase) {
	const settings = await readSettings(request)
	const view = parseCalendarResponse(
		googleScheduleWindow,
		await api(request, 'GET', `/schedule/week?start=${mondayOf(sample.from)}`)
	)
	expect(view.read.state).toBe('fresh')
	const context = view.series.find((item) => item.series.id === sample.seriesId)
	if (!context) throw new Error('Owned bound cut context is unavailable')
	const meta = {
		requestId: randomUUID(),
		expectedVersion: context.version,
		expectedDefaultTimeZone: settings.defaultTimeZone,
	}
	return sample.operation === 'move_series'
		? { ...meta, from: sample.from, weekday: sample.weekday, startTime: sample.startTime }
		: { ...meta, lastOn: sample.lastOn }
}

async function submit(request: APIRequestContext, sample: CutCase, input: Awaited<ReturnType<typeof cutInput>>) {
	return parseCalendarResponse(
		calendarCommandReceipt,
		await api(
			request,
			'POST',
			`/schedule/series/${sample.seriesId}/${sample.operation === 'move_series' ? 'move' : 'end'}`,
			input,
			202
		)
	)
}

async function status(request: APIRequestContext, commandId: string) {
	return parseCalendarResponse(calendarCommandSnapshot, await api(request, 'GET', `/google/commands/${commandId}`))
}

async function prepareJourney(request: APIRequestContext) {
	const fixture = await calendarCommandFixture(request)
	if (!fixture.cuts) throw new Error('Retained cut cases are required')
	const settings = await readSettings(request)
	const refused = record(
		await api(
			request,
			'POST',
			`/schedule/series/${fixture.cuts.legacySeriesId}/end`,
			{
				requestId: randomUUID(),
				expectedVersion: 'legacy',
				lastOn: fixture.cuts.cases[0].lastOn,
				expectedDefaultTimeZone: settings.defaultTimeZone,
			},
			409
		)
	)
	expect(record(refused.error).code).toBe('history_only')
	for (const sample of fixture.cuts.cases.filter((item) => ['finite', 'empty', 'cross_zone'].includes(item.scenario))) {
		await setMain(request, sample.timeZone)
		const input = await cutInput(request, sample)
		const before = domain(sample.seriesId)
		const fault = armCalendarFault({
			method: 'PATCH',
			resource: 'events',
			page: 'any',
			action: 'delay_response',
			delayMs: 5000,
		})
		try {
			const receipt = await submit(request, sample, input)
			await expect
				.poll(() => calendarFaultEvidence(fault).some((item) => item.phase === 'response_held'), { timeout: 20000 })
				.toBe(true)
			expect(domain(sample.seriesId)).toEqual(before)
			const plan = sql(`select plan from google_commands where id = ${quote(receipt.commandId)}::uuid`)
			expect(await submit(request, sample, input)).toEqual(receipt)
			expect(sql(`select plan from google_commands where id = ${quote(receipt.commandId)}::uuid`)).toEqual(plan)
			await expect
				.poll(async () => (await status(request, receipt.commandId)).state, { timeout: 90000 })
				.toBe('applied')
		} finally {
			disarmCalendarFault(fault)
		}
	}
}

async function recoveryJourney(request: APIRequestContext, history = false, sparse = false, unreserved = false) {
	const fixture = await calendarCommandFixture(request)
	const sample = fixture.cuts?.cases.find((item) =>
		history
			? item.scenario === (sparse ? 'sparse_cancelled_history' : unreserved ? 'unreserved_mark_history' : 'history')
			: item.scenario === 'recovery'
	)
	if (!sample) throw new Error('Retained cut recovery case is required')
	await setMain(request, sample.timeZone)
	const input = await cutInput(request, sample)
	const before = domain(sample.seriesId)
	if (sparse && (!sample.cancelledOriginalOn || !sample.cancelledPrefixOriginalOn))
		throw new Error('Retained native sparse cancelled tail is required')
	if (unreserved && !sample.unreservedMarkOriginalOn)
		throw new Error('Retained initially-none unreserved mark target is required')
	const fault = armCalendarFault({
		method: history ? 'PATCH' : 'POST',
		resource: 'events',
		page: 'any',
		action: history ? 'delay_response' : 'drop_response',
		delayMs: history ? 5000 : 0,
	})
	try {
		const receipt = await submit(request, sample, input)
		if (history) {
			await expect
				.poll(() => calendarFaultEvidence(fault).some((item) => item.phase === 'response_held'), { timeout: 20000 })
				.toBe(true)
			expect(domain(sample.seriesId).series).toEqual(before.series)
			expect(domain(sample.seriesId).lessons).toEqual(before.lessons)
			if (!sample.markOriginalOn) throw new Error('Retained effective-past mark target is required')
			await api(
				request,
				'POST',
				`/schedule/series/${sample.seriesId}/occurrences/${sample.markOriginalOn}/mark`,
				{ kind: 'no_show' },
				200
			)
		}
		if (sample.unreservedMarkOriginalOn) {
			await api(
				request,
				'POST',
				`/schedule/series/${sample.seriesId}/occurrences/${sample.unreservedMarkOriginalOn}/mark`,
				{ kind: 'done' },
				200
			)
			await expect
				.poll(async () => (await status(request, receipt.commandId)).state, { timeout: 90000 })
				.toMatch(/partial_recovery|recovery_required/)
			expect((await status(request, receipt.commandId)).confirmedRevision).toBeNull()
			expect(domain(sample.seriesId).series).toEqual(before.series)
			return
		}
		const balance = studentFacts(await api(request, 'GET', `/students/${fixture.studentId}`)).balanceMinutes
		await expect
			.poll(async () => (await status(request, receipt.commandId)).state, { timeout: 90000 })
			.toMatch(/applied|partial_recovery|recovery_required/)
		let current = await status(request, receipt.commandId)
		if (current.state !== 'applied') {
			expect(current.confirmedRevision).toBeNull()
			expect(domain(sample.seriesId).series).toEqual(before.series)
			const reserved = sql(`select plan from google_commands where id = ${quote(receipt.commandId)}::uuid`)
			await api(request, 'POST', `/google/commands/${receipt.commandId}/resume`, undefined, 202)
			await expect
				.poll(async () => (await status(request, receipt.commandId)).state, { timeout: 90000 })
				.toBe('applied')
			expect(sql(`select plan from google_commands where id = ${quote(receipt.commandId)}::uuid`)).toEqual(reserved)
			current = await status(request, receipt.commandId)
		}
		expect(current.effect).toBe('confirmed')
		expect(domain(sample.seriesId).exceptions).toEqual(before.exceptions)
		if (history)
			expect(studentFacts(await api(request, 'GET', `/students/${fixture.studentId}`)).balanceMinutes).toBe(balance)
		const rows = sql(`select plan from google_commands where id = ${quote(receipt.commandId)}::uuid`)
		const plan = googleCommandPlan.parse(rows[0].plan)
		verifyHistory(plan, sample, history, sparse)
	} finally {
		disarmCalendarFault(fault)
	}
}

export async function calendarJourney(
	request: APIRequestContext,
	kind: 'recurring master' | 'recurring instance' | 'cut prepare' | 'cut recovery'
) {
	test.setTimeout(300000)
	if (kind === 'recurring master') return recurringJourney(request, 'master')
	if (kind === 'recurring instance') return recurringJourney(request, 'instance')
	if (kind === 'cut prepare') return prepareJourney(request)
	return recoveryJourney(request)
}

export async function cutHistory(request: APIRequestContext) {
	test.setTimeout(300000)
	await recoveryJourney(request, true)
	await recoveryJourney(request, true, true)
	await recoveryJourney(request, true, false, true)
}

function verifyHistory(
	plan: ReturnType<typeof googleCommandPlan.parse>,
	sample: CutCase,
	history: boolean,
	sparse: boolean
) {
	if (sparse) {
		const preserved = plan.cut?.cancelledTail.find((item) => item.originalOn === sample.cancelledOriginalOn)
		expect(preserved).toBeDefined()
		expect(preserved?.current.start).toBeUndefined()
		expect(preserved?.current.end).toBeUndefined()
		expect(preserved?.current.etag).toBeUndefined()
		const prefix = plan.cut?.cancelledPrefix.find((item) => item.originalOn === sample.cancelledPrefixOriginalOn)
		expect(prefix).toBeDefined()
		expect(prefix?.current.start).toBeUndefined()
	}
	const lineage = plan.lineage
	for (const item of lineage) {
		const entry = item
		const to = entry.to
		if (to.kind !== 'single') continue
		expect(
			sql(`select starts_at, time_zone, duration_minutes from lessons where id = ${quote(String(to.lessonId))}::uuid`)
		).toHaveLength(1)
		if (sparse && entry.from.kind === 'series' && entry.from.originalOn === sample.cancelledOriginalOn)
			expect(sql(`select status from lessons where id = ${quote(to.lessonId)}::uuid`)[0].status).toBe('cancelled')
		if (history && record(entry.from).originalOn === sample.markOriginalOn)
			expect(sql(`select kind from lesson_marks where lesson_id = ${quote(String(to.lessonId))}::uuid`)[0].kind).toBe(
				'no_show'
			)
	}
}
