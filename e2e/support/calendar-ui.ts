import type { APIRequestContext, APIResponse, Locator, Page, Request } from '@playwright/test'

import { z } from 'zod'

import {
	calendarCommandReceipt,
	calendarCommandSnapshot,
	calendarIssue,
	calendarReadStatus,
	calendarWriteStatus,
	nextLessonRead,
	createCalendarLessonRequest,
	googleScheduleWindow,
} from '../../packages/contracts/src/calendar.ts'
import { mondayOf, zonedParts } from '../../packages/core/src/index.ts'
import { api, teacherId } from './api.ts'
import { expectClosedGestures, openView } from './calendar-view.ts'
import { HTTPS_TARGET, NAMES, ownedStudent, PRIVATE_DIR, quote, sql } from './data.ts'
import { integer, list, record, text } from './input.ts'
import { readPrivateJson, targetBinding } from './target.ts'
import { expect } from './test.ts'
import { pickDate, pickTime } from './ui.ts'

const fixtureSchema = z.strictObject({
	origin: z.string(),
	apiBuildSha: z.string(),
	persistenceFingerprint: z.string(),
	accountId: z.uuid(),
	studentId: z.uuid(),
	studentName: z.enum(NAMES),
	commandWritesAuthorized: z.literal(true),
	expiresAt: z.iso.datetime(),
	date: z.iso.date(),
	time: z.string().regex(/^\d{2}:\d{2}$/),
	mode: z.enum(['ready', 'projection_pending', 'resume', 'failed_none', 'blocked']),
	requestId: z.uuid().optional(),
	historyLessonId: z.uuid().optional(),
	blockedReason: calendarIssue.optional(),
})

async function uiFixture(request: APIRequestContext, mode: z.infer<typeof fixtureSchema>['mode']) {
	if (!HTTPS_TARGET) throw new Error('Connected UI journey requires the attested HTTPS target')
	const binding = targetBinding()
	const parsed = fixtureSchema.safeParse(readPrivateJson(`${PRIVATE_DIR}/calendar-ui.json`))
	if (!parsed.success) throw new Error('Observed synthetic Calendar UI fixture is required')
	const fixture = parsed.data
	if (
		fixture.mode !== mode ||
		fixture.origin !== binding.origin ||
		fixture.apiBuildSha !== binding.apiBuildSha ||
		fixture.persistenceFingerprint !== binding.persistenceFingerprint ||
		Date.parse(fixture.expiresAt) <= Date.now() ||
		fixture.accountId !== (await teacherId(request))
	)
		throw new Error('Calendar UI fixture does not match the active authority')
	ownedStudent(fixture.studentId)
	const count = sql(
		`select count(*)::int as n from students where id = ${quote(fixture.studentId)}::uuid and display_name = ${quote(fixture.studentName)} and import_key is null`
	)
	if (integer(count[0]?.n) !== 1) throw new Error('Calendar UI fixture is outside the synthetic ledger')
	if (mode === 'ready') {
		const today = record(await api(request, 'GET', '/today'))
		if (today.date !== fixture.date) throw new Error('C2 fixture requires a future lesson in the current teaching day')
	}
	return fixture
}

async function openNew(page: Page, fixture: Awaited<ReturnType<typeof uiFixture>>) {
	const window = await openView(page, mondayOf(fixture.date))
	expect(window.write.state).toBe('ready')
	await page.getByRole('button', { name: 'New lesson', exact: true }).click()
	const dialog = page.getByRole('dialog', { name: 'New lesson', exact: true })
	await dialog.getByLabel('Student', { exact: true }).click()
	await page.getByRole('option', { name: fixture.studentName, exact: true }).click()
	await pickDate(page, fixture.date, 'new-lesson-date')
	await pickTime(page, fixture.time, 'new-lesson-time')
	await dialog.locator('#new-lesson-length').fill('60')
	return dialog
}

function captureCreates(page: Page) {
	const bodies: z.infer<typeof createCalendarLessonRequest>[] = []
	const raw: string[] = []
	const observe = (request: Request) => {
		if (request.method() !== 'POST' || new URL(request.url()).pathname !== '/api/schedule/lessons') return
		const value: unknown = request.postDataJSON()
		const parsed = createCalendarLessonRequest.safeParse(value)
		if (!parsed.success) throw new Error('Calendar UI sent an invalid create command')
		bodies.push(parsed.data)
		raw.push(request.postData() ?? '')
	}
	page.on('request', observe)
	return { bodies, raw, stop: () => page.off('request', observe) }
}

async function submitNew(page: Page) {
	const response = page.waitForResponse(
		(response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/schedule/lessons'
	)
	await page.getByRole('button', { name: 'Add lesson', exact: true }).click()
	const result = await response
	expect(result.status()).toBe(202)
	const body: unknown = await result.json()
	const parsed = calendarCommandReceipt.safeParse(body)
	if (!parsed.success) throw new Error('Public command receipt is invalid')
	return parsed.data
}

async function command(request: APIRequestContext, path: string) {
	const parsed = calendarCommandSnapshot.safeParse(await api(request, 'GET', path))
	if (!parsed.success) throw new Error('Public command status is invalid')
	return parsed.data
}

async function assertApplied(page: Page, requestId: string, date: string) {
	const status = await command(page.request, `/google/commands/by-request/${requestId}`)
	expect(status.state).toBe('applied')
	if (status.confirmedRevision === null) throw new Error('Applied command needs a confirmed revision')
	const parsed = googleScheduleWindow.safeParse(
		await api(page.request, 'GET', `/schedule/week?start=${mondayOf(date)}`)
	)
	if (!parsed.success || parsed.data.read.state !== 'fresh') throw new Error('Fresh public projection is required')
	expect(parsed.data.connection.generation).toBe(status.generation)
	expect(BigInt(parsed.data.read.revision) >= BigInt(status.confirmedRevision)).toBe(true)
	expect(
		parsed.data.events.filter(
			(event) =>
				event.binding.kind === 'lesson' &&
				status.affectedRefs.some(
					(ref) => event.binding.kind === 'lesson' && JSON.stringify(ref) === JSON.stringify(event.binding.ref)
				)
		).length
	).toBeGreaterThan(0)
	return status
}

export async function pendingUi(page: Page) {
	const fixture = await uiFixture(page.request, 'ready')
	await openNew(page, fixture)
	const captured = captureCreates(page)
	let release = () => {}
	const delivery = new Promise<void>((resolve) => {
		release = resolve
	})
	const pattern = /\/api\/google\/commands\/[0-9a-f-]{36}$/
	await page.route(pattern, async (route) => {
		const response: APIResponse<unknown> = await route.fetch<unknown>()
		await delivery
		await route.fulfill({ response })
	})
	try {
		const receipt = await submitNew(page)
		await expect(page.getByRole('dialog', { name: 'New lesson', exact: true })).toBeVisible()
		await expect(page.getByText('Lesson added', { exact: true })).toHaveCount(0)
		await expect(page.getByRole('button', { name: 'Adding…', exact: true })).toBeDisabled()
		release()
		await expect(page.getByRole('dialog', { name: 'New lesson', exact: true })).toHaveCount(0, { timeout: 60000 })
		await expect(page.getByText('Lesson added', { exact: true })).toHaveCount(1)
		expect(captured.bodies.length).toBe(1)
		const applied = await assertApplied(page, captured.bodies[0].requestId, fixture.date)
		expect(applied.commandId).toBe(receipt.commandId)
		expect(applied.expectedVersion === captured.bodies[0].expectedVersion).toBe(true)
		await appliedAcrossScreens(page, applied, fixture)
		await page.reload()
		await expect(page.getByRole('link', { name: fixture.studentName, exact: true })).toBeVisible()
		await expect(page.getByText('Lesson added', { exact: true })).toHaveCount(0)
	} finally {
		release()
		await page.unroute(pattern)
		captured.stop()
	}
}

export async function lostPostUi(page: Page) {
	const fixture = await uiFixture(page.request, 'ready')
	await openNew(page, fixture)
	const captured = captureCreates(page)
	let first = true
	await page.route('**/api/schedule/lessons', async (route) => {
		if (first) {
			first = false
			await route.abort('connectionfailed')
		} else await route.continue()
	})
	try {
		const absent = page.waitForResponse((response) =>
			new URL(response.url()).pathname.includes('/google/commands/by-request/')
		)
		await page.getByRole('button', { name: 'Add lesson', exact: true }).click()
		expect((await absent).status()).toBe(404)
		await expect(page.getByRole('dialog', { name: 'New lesson', exact: true })).toHaveCount(0, { timeout: 60000 })
		expect(captured.bodies.length).toBe(2)
		expect(captured.raw[0] === captured.raw[1], 'Transport retry preserves exact request ID and body').toBe(true)
		await assertApplied(page, captured.bodies[0].requestId, fixture.date)
		await expect(page.getByText('Lesson added', { exact: true })).toHaveCount(1)
	} finally {
		await page.unroute('**/api/schedule/lessons')
		captured.stop()
	}
}

export async function recoveryUi(page: Page, mode: 'projection_pending' | 'resume') {
	const fixture = await uiFixture(page.request, mode)
	if (!fixture.requestId) throw new Error('Observed recovery request identity is required')
	const before = await command(page.request, `/google/commands/by-request/${fixture.requestId}`)
	if (mode === 'projection_pending') expect(before.state).toBe('projection_pending')
	else {
		expect(['partial_recovery', 'recovery_required'].includes(before.state)).toBe(true)
		expect(before.nextAction).toBe('resume_recovery')
	}
	let resumes = 0
	page.on('request', (request) => {
		if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/resume')) resumes++
	})
	await page.goto('/schedule')
	const row = page.locator(`[data-command-id="${before.commandId}"]`)
	await expect(row).toBeVisible()
	await expect(page.getByText('Lesson added', { exact: true })).toHaveCount(0)
	await page.reload()
	await expect(row).toBeVisible()
	expect(resumes).toBe(0)
	if (mode === 'projection_pending') {
		await expect(
			row.getByText('Google Calendar confirmed the change. Updating the displayed calendar…', { exact: true })
		).toBeVisible()
		await expect(row.getByRole('button', { name: 'Resume recovery', exact: true })).toHaveCount(0)
	} else {
		const response = page.waitForResponse(
			(response) =>
				response.request().method() === 'POST' &&
				new URL(response.url()).pathname === `/api/google/commands/${before.commandId}/resume`
		)
		await row.getByRole('button', { name: 'Resume recovery', exact: true }).click()
		expect((await response).ok()).toBe(true)
		expect(resumes).toBe(1)
		const after = await command(page.request, `/google/commands/by-request/${fixture.requestId}`)
		expect(after.commandId).toBe(before.commandId)
		expect(after.requestId).toBe(before.requestId)
	}
	await expect(page.getByText('Lesson added', { exact: true })).toHaveCount(0)
}

export async function failedNoneUi(page: Page) {
	const fixture = await uiFixture(page.request, 'failed_none')
	const dialog = await openNew(page, fixture)
	const captured = captureCreates(page)
	try {
		await submitNew(page)
		await expect(
			dialog.getByText('This change was not applied. Refresh the calendar before trying again.', { exact: true })
		).toBeVisible({ timeout: 60000 })
		const first = await command(page.request, `/google/commands/by-request/${captured.bodies[0].requestId}`)
		expect(first.state === 'failed' && first.effect === 'none' && first.nextAction === 'retry_new_command').toBe(true)
		await expect(dialog.locator('#new-lesson-length')).toHaveValue('60')
		expect(captured.bodies.length).toBe(1)
		const refreshed = page.waitForResponse(
			(response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/schedule/week'
		)
		await submitNew(page)
		const body: unknown = await (await refreshed).json()
		const window = googleScheduleWindow.safeParse(body)
		if (!window.success || window.data.read.state !== 'fresh')
			throw new Error('New Save requires a fresh public window')
		expect(captured.bodies.length).toBe(2)
		expect(captured.bodies[0].requestId !== captured.bodies[1].requestId).toBe(true)
		expect(captured.bodies[1].expectedVersion === window.data.read.revision).toBe(true)
	} finally {
		captured.stop()
	}
}

export async function blockedHistoryUi(page: Page) {
	const fixture = await uiFixture(page.request, 'blocked')
	if (!fixture.historyLessonId || !fixture.blockedReason)
		throw new Error('Observed historical lesson and write-block reason are required')
	await assertBlockedCommand(page.request, fixture)
	const count = sql(
		`select count(*)::int as n from lessons where id = ${quote(fixture.historyLessonId)}::uuid and student_id = ${quote(fixture.studentId)}::uuid`
	)
	if (integer(count[0]?.n) !== 1) throw new Error('Historical fixture is outside the synthetic ledger')
	const window = await openView(page, mondayOf(fixture.date))
	expect(window.write.state === 'blocked' && window.write.reason === fixture.blockedReason).toBe(true)
	await expect(page.getByRole('button', { name: 'New lesson', exact: true })).toBeDisabled()
	await expectClosedGestures(page)
	const today = await navigateRead(page, 'Today', '/today')
	const write = calendarWriteStatus.safeParse(today.calendarWrite)
	if (!write.success || write.data.state !== 'blocked') throw new Error('Today must retain the observed write barrier')
	expect(write.data.reason === fixture.blockedReason).toBe(true)
	expect(
		list(today.earlier).some((item) => record(item).key === `l:${fixture.historyLessonId}`),
		'Historical fixture must be an eligible earlier lesson'
	).toBe(true)
	const row = page.locator(`[data-slot="today-row"][data-key="l:${fixture.historyLessonId}"]`)
	await expect(row).toBeVisible()
	await row.locator('[data-slot="today-row-open"]').click()
	await expect(page.getByRole('button', { name: 'Move lesson', exact: true })).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Cancel lesson', exact: true })).toHaveCount(0)
	await page.keyboard.press('Escape')
	const saved = page.waitForResponse(
		(response) =>
			response.request().method() === 'POST' &&
			new URL(response.url()).pathname === `/api/schedule/lessons/${fixture.historyLessonId}/mark`
	)
	await row.getByRole('button', { name: /as done$/ }).click()
	expect((await saved).status()).toBe(200)
	await page.reload()
	await expect(row).toHaveCount(0)
	await studentNextUi(page, fixture.studentId)
}

async function navigateRead(page: Page, section: 'Today' | 'Students', path: string) {
	const reading = page.waitForResponse(
		(response) => response.request().method() === 'GET' && new URL(response.url()).pathname === `/api${path}`
	)
	await page.getByRole('link', { name: section, exact: true }).click()
	const response = await reading
	expect(response.status()).toBe(200)
	const body: unknown = await response.json()
	return record(body)
}

async function appliedAcrossScreens(
	page: Page,
	applied: z.infer<typeof calendarCommandSnapshot>,
	fixture: Awaited<ReturnType<typeof uiFixture>>
) {
	const today = await navigateRead(page, 'Today', '/today')
	const read = calendarReadStatus.safeParse(today.calendarRead)
	const write = calendarWriteStatus.safeParse(today.calendarWrite)
	if (!read.success || read.data.state !== 'fresh' || applied.confirmedRevision === null)
		throw new Error('Applied Today needs a fresh projection')
	expect(BigInt(read.data.revision) >= BigInt(applied.confirmedRevision)).toBe(true)
	expect(write.success && write.data.state === 'ready').toBe(true)
	const lesson = list(today.lessons)
		.map(record)
		.find((item) => applied.affectedRefs.some((ref) => JSON.stringify(ref) === JSON.stringify(item.ref)))
	if (!lesson || lesson.studentId !== fixture.studentId)
		throw new Error('Applied lesson must be visible on Today for its owned student')
	await expect(page.locator(`[data-slot="today-row"][data-key="${text(lesson.key)}"]`)).toBeVisible()
	const next = await studentNextUi(page, fixture.studentId)
	if (next.status.state !== 'fresh' || next.result !== 'known')
		throw new Error('Applied student next needs fresh proof')
	expect(BigInt(next.status.revision) >= BigInt(applied.confirmedRevision)).toBe(true)
}

async function studentNextUi(page: Page, studentId: string) {
	const data = await navigateRead(page, 'Students', '/students')
	const student = list(data.students)
		.map(record)
		.find((item) => item.id === studentId)
	if (!student) throw new Error('Owned student is missing from the public list')
	const parsed = nextLessonRead.safeParse(student.nextLesson)
	if (!parsed.success) throw new Error('Public next lesson failed schema validation')
	const link = page.locator(`a[href="/students/${studentId}"]`)
	const row = page.getByRole('row').filter({ has: link })
	await expect(row).toBeVisible()
	await assertNextDisplay(row.getByRole('cell').last(), parsed.data, text(data.defaultTimeZone))
	return parsed.data
}

async function assertNextDisplay(cell: Locator, next: z.infer<typeof nextLessonRead>, timeZone: string) {
	if (next.result === 'unknown' || next.status.state === 'unavailable') {
		await expect(cell).toContainText('Next lesson could not be determined.')
		return
	}
	if (next.result === 'none') {
		await expect(cell).toContainText(
			next.status.state === 'last_known' ? 'No next lesson at the last check' : 'No next lesson'
		)
		return
	}
	const at = new Date(next.startsAt)
	const parts = new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric', month: 'short' }).formatToParts(at)
	const day = parts.find((part) => part.type === 'day')?.value
	const month = parts.find((part) => part.type === 'month')?.value
	await expect(cell).toContainText(`${day} ${month}`)
	await expect(cell).toContainText(zonedParts(at, timeZone).time)
	await expect(cell.getByText('Last known next lesson:', { exact: false })).toHaveCount(
		next.status.state === 'last_known' ? 1 : 0
	)
}

async function assertBlockedCommand(request: APIRequestContext, fixture: Awaited<ReturnType<typeof uiFixture>>) {
	if (fixture.blockedReason !== 'command_pending') return
	if (!fixture.requestId) throw new Error('Pending mark journey requires the observed command identity')
	const before = await command(request, `/google/commands/by-request/${fixture.requestId}`)
	expect(
		before.state !== 'applied' && before.state !== 'failed',
		'Pending barrier must belong to an unresolved real command'
	).toBe(true)
}
