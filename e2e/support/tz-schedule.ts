import { expect, type Page } from '@playwright/test'

import { api } from './api.ts'
import { BASE, ownedStudent, quote, sql } from './data.ts'
import { addDays, mondayOf, VN, vnToday, zonedDate, zonedTime } from './dates.ts'
import { integer, list, record, text, uuid } from './input.ts'
import type { Card, Fx } from './test.ts'
import { MSK, NY, setMain } from './tz-settings.ts'
import { balanceEverywhere, openLesson } from './ui.ts'

export const KIR = 'Pacific/Kiritimati'

export async function schedule(page: Page, card: Card, date: string) {
	const response = record(await api(page.request, 'GET', `/schedule/week?start=${mondayOf(date)}`))
	return {
		defaultTimeZone: text(response.defaultTimeZone),
		asOf: text(response.asOf),
		blocks: list(response.blocks)
			.map(record)
			.filter((row) => row.studentId === card.id),
		series: list(response.series)
			.map(record)
			.filter((row) => row.studentId === card.id),
	}
}

export async function seriesAt(page: Page, card: Card, date: string, id: string) {
	const row = (await schedule(page, card, date)).series.find((entry) => entry.id === id)
	if (!row) throw new Error('Expected series is absent from the public week')
	return row
}

function instant(value: unknown): string {
	return new Date(text(value)).toISOString()
}

function stable(row: Record<string, unknown>) {
	return {
		key: text(row.key),
		ref: record(row.ref),
		startsAt: instant(row.startsAt),
		durationMinutes: integer(row.durationMinutes),
		timeZone: text(row.timeZone),
		mark: row.mark,
		outcome: text(row.outcome),
		movedTo: row.movedTo,
		movedFrom: row.movedFrom,
	}
}

export async function immutableSchedule(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2185')
	const day = addDays(mondayOf(vnToday()), -5)
	const id = await fx.once(card.id, day, '14:00')
	await fx.mark(id, 'done')
	const seriesId = fx.pastSeries(card.id, day, '16:00', VN)
	await fx.moveOccurrence(seriesId, day, day, '17:00', VN)
	await fx.markOccurrence(seriesId, day, 'no_show')
	const before = await schedule(page, card, day)
	const rule = await seriesAt(page, card, day, seriesId)
	for (const zone of [MSK, NY, KIR, 'UTC', VN]) {
		await setMain(page.request, zone)
		const after = await schedule(page, card, day)
		expect(after.defaultTimeZone).toBe(zone)
		expect(after.blocks.map(stable)).toEqual(before.blocks.map(stable))
		const next = await seriesAt(page, card, day, seriesId)
		for (const key of ['id', 'weekday', 'startTime', 'durationMinutes', 'startsOn', 'endsOn', 'timeZone'])
			expect(next[key]).toEqual(rule[key])
	}
}

export async function mixedWindow(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2185')
	const monday = addDays(mondayOf(vnToday()), 14)
	await setMain(page.request, KIR)
	const seriesId = await fx.weekly(card.id, monday, '00:30', KIR)
	await setMain(page.request, NY)
	const previous = await schedule(page, card, addDays(monday, -1))
	const following = await schedule(page, card, monday)
	const key = `s:${seriesId}:${monday}`
	const rows = previous.blocks.filter((row) => row.key === key)
	const row = record(rows[0])
	expect(rows).toHaveLength(1)
	expect(row.ref).toEqual({ kind: 'series', seriesId, originalOn: monday })
	expect(instant(row.startsAt)).toBe(`${addDays(monday, -1)}T10:30:00.000Z`)
	expect(zonedDate(new Date(text(row.startsAt)), NY)).toBe(addDays(monday, -1))
	expect(following.blocks.filter((entry) => entry.key === key)).toHaveLength(0)
	expect(following.blocks.filter((entry) => entry.key === `s:${seriesId}:${addDays(monday, 7)}`)).toHaveLength(1)
	await setMain(page.request, KIR)
	expect((await schedule(page, card, monday)).blocks.filter((entry) => entry.key === key)).toHaveLength(1)
}

export async function duplicateZone(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2185')
	const day = addDays(vnToday(), 14)
	const old = await fx.weekly(card.id, day, '09:00', VN)
	await setMain(page.request, NY)
	const next = await fx.weekly(card.id, day, '09:00', NY)
	expect(next).not.toBe(old)
	await setMain(page.request, 'US/Eastern')
	expect(await fx.weekly(card.id, day, '09:00', 'US/Eastern')).toBe(next)
	expect(fx.scheduleCounts(card.id).series).toBe(2)
	expect((await seriesAt(page, card, day, old)).timeZone).toBe(VN)
	const before = await seriesAt(page, card, day, next)
	expect(before.timeZone).toBe(NY)
	const counts = fx.scheduleCounts(card.id)
	await api(
		page.request,
		'POST',
		`/schedule/series/${next}/move`,
		{ from: day, weekday: integer(before.weekday), startTime: '09:00', expectedDefaultTimeZone: 'US/Eastern' },
		400
	)
	const dialog = await openLesson(page, card, day, '09:00')
	await dialog.getByRole('button', { name: 'Move series', exact: true }).click()
	await page.getByRole('dialog').getByRole('button', { name: 'Move series', exact: true }).click()
	await expect(page.getByText('Choose a different day or time.', { exact: true })).toBeVisible()
	expect(fx.scheduleCounts(card.id)).toEqual(counts)
	expect(await seriesAt(page, card, day, next)).toEqual(before)
}

async function futureDst(page: Page) {
	const now = new Date(text(record(await api(page.request, 'GET', '/today')).asOf))
	const year = Number(zonedDate(now, NY).slice(0, 4)) + 1
	const sunday = (month: string, week: number) => {
		const first = `${year}-${month}-01`
		return addDays(first, ((7 - new Date(`${first}T12:00:00Z`).getUTCDay()) % 7) + (week - 1) * 7)
	}
	const spring = sunday('03', 2)
	return { spring, fall: sunday('11', 1), before: addDays(spring, -7), after: addDays(spring, 7) }
}

export async function dstRules(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2185')
	await setMain(page.request, NY)
	const { spring, fall, before, after } = await futureDst(page)
	for (const [first, second, firstHour, secondHour] of [
		[before, spring, '14', '13'],
		[addDays(fall, -7), fall, '13', '14'],
	]) {
		const id = await fx.weekly(card.id, first, '09:00', NY)
		for (const [date, hour] of [
			[first, firstHour],
			[second, secondHour],
		]) {
			const row = record((await schedule(page, card, date)).blocks.find((entry) => entry.key === `s:${id}:${date}`))
			expect(instant(row.startsAt)).toBe(`${date}T${hour}:00:00.000Z`)
			expect(zonedTime(new Date(text(row.startsAt)), NY)).toBe('09:00')
			expect(row.timeZone).toBe(NY)
		}
	}
	const gapSeries = await fx.weekly(card.id, before, '02:30', NY)
	expect((await schedule(page, card, spring)).blocks.some((row) => row.key === `s:${gapSeries}:${spring}`)).toBe(false)
	const next = record((await schedule(page, card, after)).blocks.find((row) => row.key === `s:${gapSeries}:${after}`))
	expect(instant(next.startsAt)).toBe(`${after}T06:30:00.000Z`)
}

export async function foldInstants(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2185')
	await setMain(page.request, NY)
	const first = await fx.once(card.id, '2027-11-07', '01:30', 60, NY)
	const second = fx.historicalLesson(card.id, '2027-11-07T06:30:00Z', NY)
	const rows = (await schedule(page, card, '2027-11-07')).blocks
	for (const [id, hour] of [
		[first, '05'],
		[second, '06'],
	]) {
		const row = record(rows.find((entry) => entry.key === `l:${id}`))
		expect(instant(row.startsAt)).toBe(`2027-11-07T${hour}:30:00.000Z`)
		expect(zonedTime(new Date(text(row.startsAt)), NY)).toBe('01:30')
		expect(row.durationMinutes).toBe(60)
	}
	await setMain(page.request, 'UTC')
	expect((await schedule(page, card, '2027-11-07')).blocks.map(stable)).toEqual(rows.map(stable))
}

export async function civilWindows(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2185')
	for (const [zone, day, start, end, hours] of [
		[NY, '2027-03-14', '2027-03-14T05:00:00Z', '2027-03-15T04:00:00Z', 23],
		[NY, '2027-11-07', '2027-11-07T04:00:00Z', '2027-11-08T05:00:00Z', 25],
		['America/Sao_Paulo', '2018-11-04', '2018-11-04T03:00:00Z', '2018-11-05T02:00:00Z', 23],
		['Pacific/Apia', '2011-12-30', '2011-12-30T10:00:00Z', '2011-12-30T10:00:00Z', 0],
	] as const) {
		await setMain(page.request, zone)
		const startMs = Date.parse(start)
		const endMs = Date.parse(end)
		expect((endMs - startMs) / 3600000).toBe(hours)
		const ids = [startMs - 60000, startMs, endMs - 60000, endMs].map((at) =>
			fx.historicalLesson(card.id, new Date(at).toISOString(), zone)
		)
		const week = await schedule(page, card, day)
		const after = await schedule(page, card, addDays(mondayOf(day), 7))
		const joined = [...week.blocks, ...after.blocks]
		for (const id of ids) expect(joined.filter((row) => row.key === `l:${id}`)).toHaveLength(1)
		const onDay = week.blocks.filter((row) => zonedDate(new Date(text(row.startsAt)), zone) === day)
		expect(onDay.filter((row) => ids.includes(text(record(row.ref).lessonId)))).toHaveLength(hours === 0 ? 0 : 2)
		if (hours === 0) expect(zonedDate(new Date(start), zone)).toBe(addDays(day, 1))
		else expect(zonedDate(new Date(start), zone)).toBe(day)
		if (zone === 'America/Sao_Paulo') expect(zonedTime(new Date(start), zone)).toBe('01:00')
	}
}

export async function referenceSelection(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2185')
	await setMain(page.request, NY)
	const { spring, before, after } = await futureDst(page)
	const moved = addDays(spring, 1)
	const id = await fx.weekly(card.id, before, '09:00', NY)
	await api(page.request, 'POST', `/schedule/series/${id}/occurrences/${before}/cancel`, {})
	await fx.moveOccurrence(id, spring, moved, '12:00', NY)
	let rule = await seriesAt(page, card, before, id)
	expect(rule.referenceOccurrence).toEqual({
		originalOn: spring,
		actualStartsAt: `${moved}T16:00:00.000Z`,
		ruleStartsAt: `${spring}T13:00:00.000Z`,
	})
	await fx.end(id, before, NY)
	rule = await seriesAt(page, card, before, id)
	expect(rule.referenceOccurrence).toBeNull()
	const gap = await fx.weekly(card.id, before, '02:30', NY)
	await api(page.request, 'POST', `/schedule/series/${gap}/occurrences/${before}/cancel`, {})
	await fx.moveOccurrence(gap, after, moved, '12:00', NY)
	expect(record((await seriesAt(page, card, before, gap)).referenceOccurrence).originalOn).toBe(after)
}

export async function missingRuleReference(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2185')
	await setMain(page.request, NY)
	const { spring, before } = await futureDst(page)
	const moved = `${addDays(spring, 1)}T16:00:00.000Z`
	const id = await fx.weekly(card.id, before, '02:30', NY)
	await api(page.request, 'POST', `/schedule/series/${id}/occurrences/${before}/cancel`, {})
	sql(`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes)
select id, ${quote(spring)}, 'moved', ${quote(moved)}, 60 from lesson_series
where id = ${quote(id)}::uuid and student_id = ${quote(ownedStudent(card.id))}::uuid`)
	const reference = record((await seriesAt(page, card, before, id)).referenceOccurrence)
	expect(reference).toEqual({
		originalOn: spring,
		actualStartsAt: moved,
		ruleStartsAt: null,
	})
}

export async function markedPastMove(page: Page, fx: Fx): Promise<void> {
	const card = await fx.card('Alex Example 2186')
	const day = addDays(vnToday(), -2)
	await fx.opening(card.id, 300, addDays(day, -5), VN)
	const id = await fx.once(card.id, day, '14:00')
	await fx.mark(id, 'done')
	const before = record((await schedule(page, card, day)).blocks.find((row) => row.key === `l:${id}`))
	await setMain(page.request, NY)
	const moved = record(record(await fx.move(id, day, '09:00', text(before.startsAt), NY)).lesson)
	expect(moved.timeZone).toBe(VN)
	expect(zonedTime(new Date(text(moved.startsAt)), NY)).toBe('09:00')
	const stale = record(
		await api(
			page.request,
			'POST',
			`/schedule/lessons/${id}/move`,
			{ date: day, startTime: '10:00', expectedStartsAt: text(before.startsAt), expectedDefaultTimeZone: NY },
			409
		)
	)
	expect(record(stale.error).code).toBe('lesson_changed')
	const after = record((await schedule(page, card, day)).blocks.find((row) => row.key === `l:${id}`))
	expect(after.mark).toBe('done')
	expect(after.startsAt).toBe(moved.startsAt)
	expect(fx.markCount(card.id)).toBe(1)
	await balanceEverywhere(page, fx, card, '2 lessons left', 120)
}

async function markedTail(fx: Fx, id: string, original: string, target: string, restore: boolean) {
	await fx.moveOccurrence(id, original, target, '09:00', NY)
	await fx.markOccurrence(id, original, 'done')
	if (restore) await fx.moveOccurrence(id, original, original, '23:30', NY)
}

export async function crossZoneTail(page: Page, fx: Fx, action: 'cut' | 'end'): Promise<void> {
	const card = await fx.card('Alex Example 2186')
	await fx.opening(card.id, 1000, addDays(vnToday(), -20), VN)
	await setMain(page.request, NY)
	const first = addDays(zonedDate(new Date(), NY), 7)
	const tail = addDays(first, 7)
	const from = addDays(tail, 1)
	const end = addDays(first, 42)
	const id = await fx.weekly(card.id, first, '23:30', NY)
	await fx.end(id, end, NY)
	const last = record((await schedule(page, card, end)).blocks.find((row) => row.key === `s:${id}:${end}`))
	const past = addDays(vnToday(), -2)
	await markedTail(fx, id, tail, past, false)
	await markedTail(fx, id, addDays(tail, 7), past, true)
	await api(page.request, 'POST', `/schedule/series/${id}/occurrences/${addDays(tail, 14)}/cancel`, {})
	await fx.moveOccurrence(id, addDays(tail, 21), addDays(tail, 22), '12:00', NY)
	const originalDates = [tail, addDays(tail, 7)]
	const lineage = originalDates.map((date) => fx.occurrenceState(card.id, id, date))
	const preserved: ReturnType<typeof stable>[] = []
	for (const date of [past, addDays(tail, 7), addDays(tail, 14), addDays(tail, 22)]) {
		const rows = (await schedule(page, card, date)).blocks
		preserved.push(
			...rows
				.filter(
					(row) =>
						row.outcome !== 'moved' && (row.mark === 'done' || row.outcome === 'cancelled' || row.movedFrom !== null)
				)
				.map(stable)
		)
	}
	await setMain(page.request, KIR)
	const prefixBefore = record(
		(await schedule(page, card, addDays(first, 1))).blocks.find((row) => row.key === `s:${id}:${first}`)
	)
	if (action === 'cut') {
		const result = record(record(await fx.cut(id, from, 3, '09:00', KIR)).series)
		expect(result).toMatchObject({ weekday: 3, startTime: '09:00', timeZone: KIR })
		const oldEnd = new Date(text((await seriesAt(page, card, addDays(first, 1), id)).endsOn) + 'T00:00Z')
		expect(oldEnd.toISOString().slice(0, 10)).toBe(addDays(tail, -1))
		expect(result.endsOn).not.toBeNull()
		const final = (await schedule(page, card, text(result.endsOn))).blocks.filter(
			(row) => record(row.ref).seriesId === result.id
		)
		expect(final.length).toBeGreaterThan(0)
		for (const row of final) expect(Date.parse(text(row.startsAt))).toBeLessThanOrEqual(Date.parse(text(last.startsAt)))
		expect(
			(await schedule(page, card, addDays(text(result.endsOn), 7))).blocks.some(
				(row) => record(row.ref).seriesId === result.id
			)
		).toBe(false)
	} else await fx.end(id, addDays(from, -1), KIR)
	const prefixAfter = record(
		(await schedule(page, card, addDays(first, 1))).blocks.find((row) => row.key === `s:${id}:${first}`)
	)
	expect(stable(prefixAfter)).toEqual(stable(prefixBefore))
	const visible: Record<string, unknown>[] = []
	for (const date of [past, addDays(tail, 8), addDays(tail, 15), addDays(tail, 23)])
		visible.push(...(await schedule(page, card, date)).blocks)
	for (const saved of preserved) {
		const matches = visible.filter((row) => instant(row.startsAt) === saved.startsAt && row.outcome === saved.outcome)
		expect(matches).toHaveLength(1)
		expect(matches[0]).toMatchObject({ timeZone: NY, durationMinutes: saved.durationMinutes, mark: saved.mark })
	}
	for (const [index, date] of originalDates.entries())
		expect(fx.occurrenceState(card.id, id, date)).toEqual(lineage[index])
	await balanceEverywhere(page, fx, card, '8 lessons left', 480)
	const counts = fx.scheduleCounts(card.id)
	const repeated = await page.request.post<unknown>(`/api/schedule/series/${id}/${action === 'cut' ? 'move' : 'end'}`, {
		data:
			action === 'cut'
				? { from, weekday: 3, startTime: '09:00', expectedDefaultTimeZone: KIR }
				: { lastOn: addDays(from, -1), expectedDefaultTimeZone: KIR },
		headers: { origin: BASE },
	})
	try {
		expect([200, 400, 409]).toContain(repeated.status())
	} finally {
		await repeated.dispose()
	}
	expect(fx.scheduleCounts(card.id)).toEqual(counts)
	await balanceEverywhere(page, fx, card, '8 lessons left', 480)
}
