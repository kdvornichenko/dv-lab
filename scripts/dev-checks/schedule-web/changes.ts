import type { Page } from '@playwright/test'

import type {
	ScheduleLessonResponse,
	ErrorResponse,
	ScheduleWeekResponse,
} from '../../../packages/contracts/src/index.ts'
import * as core from '../../../packages/core/src/index.ts'
import { api, check, sql, shot, failures, signIn } from '../browser-context.ts'
import { withBrowser } from '../browser-journey.ts'
import {
	openBlockDialog,
	dialogButtons,
	pickDate,
	pickTime,
	moveFormFacts,
	toastText,
	waitBlock,
	calendarDayState,
	closeDialog,
} from './dialogs.ts'
import { cleanupFixtures } from './fixtures.ts'
import { quote, whenText } from './format.ts'
import { VN, goToWeek, setTheme, openSchedule } from './navigation.ts'
import { occurrenceMove } from './occurrence-move.ts'
import { occurrenceState } from './occurrence-state.ts'
import { createCard } from './read-fixtures.ts'
import { seriesChanges } from './series-changes.ts'

export const CHANGES_LIKE = 'Alex Example 2008%'

export const CH_A = 'Alex Example 2008 A'

export const CH_B = 'Alex Example 2008 B'

export const CH_C = 'Alex Example 2008 C'

export const CH_D = 'Alex Example 2008 D'

export async function changesFixtures(page: Page) {
	const today = core.zonedParts(new Date(), VN).date
	const wed = core.firstOnOrAfter(core.addDays(today, 1), 3)
	const a = await createCard(page, CH_A, 60, null)
	const b = await createCard(page, CH_B, 60, null)
	const startsOn = core.addDays(wed, -21)
	const inserted = sql<{ id: string }>(
		`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on) values (${quote(a)}, 3, '18:00', 60, ${quote(startsOn)}) returning id`
	)
	check('series A with past lessons created through sql', inserted.rowCount === 1)
	const single = await api<ScheduleLessonResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
		studentId: b,
		date: wed,
		startTime: '12:00',
		durationMinutes: 60,
		repeats: 'once',
	})
	check('single B created through the api', single.status === 201, String(single.status))
	return {
		today,
		a,
		b,
		seriesId: inserted.rows?.[0]?.id,
		startsOn,
		wed,
		thursday: core.addDays(wed, 1),
		friday: core.addDays(wed, 2),
		pastWed: core.addDays(wed, -14),
		staleWed: core.addDays(wed, 7),
		laterWed: core.addDays(wed, 14),
	}
}

export async function pastSnapshot(page: Page, fx: Awaited<ReturnType<typeof changesFixtures>>) {
	const lines: string[] = []
	for (const monday of [core.mondayOf(fx.startsOn), core.mondayOf(fx.pastWed)]) {
		const result = await api<ScheduleWeekResponse & Partial<ErrorResponse>>(
			page,
			'GET',
			`/schedule/week?start=${monday}`
		)
		for (const block of result.json?.blocks ?? []) {
			if (block.studentId !== fx.a) continue
			lines.push(
				[block.key, block.startsAt, block.durationMinutes, block.outcome, block.movedTo, block.movedFrom].join('|')
			)
		}
	}
	return lines.sort()
}

export const MOVE_PAST_LIKE = 'Alex Example 2141%'

export const MOVE_PAST = 'Alex Example 2141 A'

export async function weekHasBlock(page: Page, studentId: string, date: string, time?: string) {
	const result = await api<ScheduleWeekResponse & Partial<ErrorResponse>>(
		page,
		'GET',
		`/schedule/week?start=${core.mondayOf(date)}`
	)
	const prefix = date
	return (result.json?.blocks ?? []).filter(
		(block) =>
			block.studentId === studentId &&
			core.zonedParts(new Date(block.startsAt), VN).date === prefix &&
			(time === undefined || block.startsAt === whenText(date, time))
	).length
}

export async function moveThroughDialog(page: Page, nav: { monday: string }, from: string, to: string, time: string) {
	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, core.mondayOf(from))
	await openBlockDialog(page, MOVE_PAST, from)
	const buttons = await dialogButtons(page)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(400)
	await pickDate(page, to, 'move-lesson-date')
	await pickTime(page, time, 'move-lesson-time')
	const form = await moveFormFacts(page)
	const fieldError = await page.locator('#move-lesson-time-error').count()
	await dialog.getByRole('group', { name: 'Move lesson' }).getByRole('button', { name: 'Move lesson' }).click()
	const toast = await toastText(page, 'Lesson moved', MOVE_PAST)
	nav.monday = core.mondayOf(to)
	const placed = await waitBlock(page, MOVE_PAST, to, 'to', `${time}–`)
	return { buttons, form, fieldError, toast, placed }
}

export async function changesMovePast(
	page: Page,
	fx: Awaited<ReturnType<typeof changesFixtures>>,
	nav: { monday: string }
) {
	const studentId = await createCard(page, MOVE_PAST, 60, null)
	const yesterday = core.addDays(fx.today, -1)
	const dayBefore = core.addDays(fx.today, -2)
	const tomorrow = core.addDays(fx.today, 1)
	const once = (date: string, startTime: string) =>
		api<ScheduleLessonResponse & Partial<ErrorResponse>>(page, 'POST', '/schedule/lessons', {
			studentId,
			date,
			startTime,
			durationMinutes: 60,
			repeats: 'once',
		})
	const past = await once(yesterday, '10:00')
	check('move-past: the past lesson is created', past.status === 201, String(past.status))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)

	const dialog = page.getByRole('dialog')
	await goToWeek(page, nav, core.mondayOf(yesterday))
	await openBlockDialog(page, MOVE_PAST, yesterday)
	const pastButtons = await dialogButtons(page)
	check(
		'move-past: the past lesson has Move lesson and Cancel lesson',
		pastButtons.includes('Move lesson') && pastButtons.includes('Cancel lesson'),
		pastButtons.join('|')
	)
	await dialog.getByRole('button', { name: 'Move lesson' }).click()
	await page.waitForTimeout(400)
	await page.locator('#move-lesson-date').click()
	await page.waitForTimeout(300)
	const dayBeforeOff = await calendarDayState(page, dayBefore)
	check('move-past: the day before yesterday can be picked', dayBeforeOff === false, String(dayBeforeOff))
	await shot(page, 'sched-changes', 'move-past-calendar')
	await page.locator('#move-lesson-date').click()
	await page.waitForTimeout(300)
	await closeDialog(page)

	const back = await moveThroughDialog(page, nav, yesterday, dayBefore, '09:00')
	check(
		'move-past: 09:00 the day before yesterday gives no field error',
		back.fieldError === 0 && back.form !== null && !back.form.text.includes('Choose'),
		back.form?.text.slice(0, 200)
	)
	check('move-past: the toast says Lesson moved', back.toast.includes(MOVE_PAST), back.toast)
	check('move-past: the block stands the day before yesterday at 09:00', back.placed)
	await shot(page, 'sched-changes', 'move-past-moved')
	await closeDialog(page)
	check(
		'move-past: the lesson is on the day before yesterday at 09:00 and nothing is left yesterday',
		(await weekHasBlock(page, studentId, dayBefore, '09:00')) === 1 &&
			(await weekHasBlock(page, studentId, yesterday)) === 0
	)

	const future = await once(tomorrow, '10:00')
	check('move-past: the future lesson is created', future.status === 201, String(future.status))
	await page.reload()
	await page.locator('[data-slot="week-grid"]').waitFor({ timeout: 45000 })
	nav.monday = core.mondayOf(fx.today)
	const pulled = await moveThroughDialog(page, nav, tomorrow, yesterday, '12:00')
	check('move-past: the future lesson moved to yesterday gives no field error', pulled.fieldError === 0)
	check('move-past: the future lesson stands yesterday at 12:00', pulled.placed)
	await closeDialog(page)
	check(
		'move-past: the week has the lesson yesterday at 12:00',
		(await weekHasBlock(page, studentId, yesterday, '12:00')) === 1 &&
			(await weekHasBlock(page, studentId, tomorrow)) === 0
	)
}

export async function changes() {
	cleanupFixtures('changes start')
	cleanupFixtures('changes move-past start', MOVE_PAST_LIKE)

	const posts: { url: string; body: string | null }[] = []
	await withBrowser(
		{ width: 1440, height: 900 },
		async ({ page, problems }) => {
			await setTheme(page)
			await signIn(page)
			const fx = await changesFixtures(page)
			const before = await pastSnapshot(page, fx)
			check('past weeks snapshot holds two A blocks', before.length === 2, String(before.length))
			page.on('request', (request) => {
				if (request.method() === 'POST' && request.url().includes('/api/schedule/')) {
					posts.push({ url: request.url(), body: request.postData() })
				}
			})
			await openSchedule(page)
			const nav = { monday: core.mondayOf(fx.today) }
			await occurrenceState(page, fx, nav, posts)
			const afterPart1 = await pastSnapshot(page, fx)
			check('past weeks snapshot is unchanged after part 1', afterPart1.join('\n') === before.join('\n'))
			console.log('CHANGES_PART1_OK')
			await occurrenceMove(page, fx, nav, posts)
			const afterPart2 = await pastSnapshot(page, fx)
			check('past weeks snapshot is unchanged after part 2', afterPart2.join('\n') === before.join('\n'))
			console.log('CHANGES_PART2_OK')
			await seriesChanges(page, fx, nav, posts, before)
			const afterAll = await pastSnapshot(page, fx)
			check('past weeks snapshot is unchanged after every change', afterAll.join('\n') === before.join('\n'))
			console.log('CHANGES_PART3_OK')
			await changesMovePast(page, fx, nav)
			console.log('CHANGES_MOVE_PAST_OK')
			const real = problems.filter(
				(problem) => !problem.includes('net::ERR_FAILED') && !/status of (400|404|409)/.test(problem)
			)
			check('no console problems', real.length === 0, real.slice(0, 2).join(' | '))
		},
		() => cleanupFixtures('changes end', CHANGES_LIKE),
		() => cleanupFixtures('changes move-past end', MOVE_PAST_LIKE)
	)
	if (failures() === 0) console.log('SCHEDULE_WEB_CHANGES_OK')
}
