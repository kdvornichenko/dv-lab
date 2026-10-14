import * as core from '../../../packages/core/src/index.ts'
import { call, quote, sql } from '../schedule-api/io.ts'
import { cardBody, check, createCard, instant, patchCard, setOpening } from './context.ts'
import { heldLesson, insertLessonAt, pay } from './ledger.ts'
import type { Context } from './types.ts'

type Payment = { id: string; paidOn: string; amountMinor: number; currency: string | null; paidAfter: boolean }

type Lesson = {
	key: string
	date: string
	startsAt: string
	durationMinutes: number
	outcome: string
	movedFrom: string | null
	movedTo: string | null
	actions: Record<string, boolean>
	counted: boolean
	deductedMinutes: number
	balanceAfterMinutes: number | null
	projected: boolean
	payment: Payment | null
	held: boolean
	sinceLastPayment: boolean
}

type Lessons = {
	studentId: string
	from: string
	to: string
	clipped: boolean
	coverage: string
	defaultLessonMinutes: number
	lastPayment: { id: string; paidOn: string } | null
	sinceLastPaymentFrom: string | null
	lessons: Lesson[]
	totals: Record<string, number>
}

async function lessonsOf(ctx: Context, studentId: string, query: string) {
	const res = await call(ctx.api, 'GET', `/students/${studentId}/lessons?${query}`, { cookie: ctx.cookie })
	return { status: res.status, body: res.json as unknown as Lessons, cache: res.headers.get('cache-control') }
}

async function readLessons(ctx: Context, studentId: string, query: string) {
	const res = await lessonsOf(ctx, studentId, query)
	if (res.status !== 200) throw new Error(`lessons ${query} returned ${res.status}`)
	return res.body
}

function insertSeriesOn(studentId: string, date: string, minutes = 60) {
	return String(
		(
			sql(
				`insert into lesson_series (student_id, weekday, start_time, duration_minutes, starts_on, ends_on) values (${quote(studentId)}, ${core.weekdayOf(date)}, '10:00', ${minutes}, ${quote(date)}, ${quote(date)}) returning id`
			).rows as unknown as Array<{ id: string }>
		)[0]?.id
	)
}

async function markOccurrence(ctx: Context, seriesId: string, originalOn: string, kind: string) {
	const res = await call(ctx.api, 'POST', `/schedule/series/${seriesId}/occurrences/${originalOn}/mark`, {
		cookie: ctx.cookie,
		body: { kind },
	})
	if (res.status !== 200) throw new Error(`occurrence mark returned ${res.status}`)
}

const single = (id: string) => `l:${id}`

const byKey = (body: Lessons, key: string) => body.lessons.find((lesson) => lesson.key === key)

function expectRow(
	label: string,
	row: Lesson | undefined,
	expected: Partial<Omit<Lesson, 'payment'>> & { payment?: { id: string; paidAfter: boolean } | null }
) {
	if (!row) {
		check(`${label}: row is present`, false)
		return
	}
	const problems: string[] = []
	for (const [field, value] of Object.entries(expected)) {
		const got = (row as unknown as Record<string, unknown>)[field]
		if (field === 'payment') {
			const want = value as { id: string; paidAfter: boolean } | null
			const have = got as Payment | null
			const same = want === null ? have === null : have?.id === want.id && have?.paidAfter === want.paidAfter
			if (!same) problems.push(`payment ${JSON.stringify(have)}`)
		} else if (got !== value) problems.push(`${field} ${JSON.stringify(got)}`)
	}
	check(`${label}: ${Object.keys(expected).join(', ')}`, problems.length === 0, problems.join('; '))
}

async function mainCard(ctx: Context, day: (shift: number) => string) {
	const studentId = await createCard(ctx, 'Alex Example 2540')
	await setOpening(ctx, studentId, 0, day(-20))
	const l1 = await heldLesson(ctx, studentId, day(-15), 'done')
	const l2 = await heldLesson(ctx, studentId, day(-14), 'done')
	const p1 = await pay(ctx, studentId, day(-12), 300)
	const l3 = await heldLesson(ctx, studentId, day(-10), 'no_show')
	const l4 = insertLessonAt(studentId, instant(day(-9), '10:00'), 60, 'cancelled')
	const seriesId = insertSeriesOn(studentId, day(-8))
	sql(
		`insert into lesson_exceptions (series_id, original_on, kind, starts_at, duration_minutes) values (${quote(seriesId)}, ${quote(day(-8))}, 'moved', ${quote(instant(day(-7), '12:00'))}, 60)`
	)
	await markOccurrence(ctx, seriesId, day(-8), 'done')
	const l5 = `s:${seriesId}:${day(-8)}`
	const p2 = await pay(ctx, studentId, day(-5), 200)
	const l7 = insertLessonAt(studentId, instant(day(-2), '10:00'))
	const f1 = insertLessonAt(studentId, instant(day(2), '10:00'))
	const f2 = insertLessonAt(studentId, instant(day(4), '10:00'), 90)

	const range = await lessonsOf(ctx, studentId, `from=${day(-20)}&to=${day(10)}`)
	check('period: 200 with no-store', range.status === 200 && range.cache === 'no-store', `status ${range.status}`)
	const body = range.body
	check(
		'period: from, to, coverage, Last payment and the start of the period since the last payment',
		body.from === day(-20) &&
			body.to === day(10) &&
			!body.clipped &&
			body.coverage === 'complete' &&
			body.lastPayment?.id === p2 &&
			body.sinceLastPaymentFrom === day(-7) &&
			body.defaultLessonMinutes === 60,
		JSON.stringify({ ...body, lessons: body.lessons.length })
	)
	check(
		'period: one row per lesson in time order, the moved lesson once at its new time',
		body.lessons.map((lesson) => lesson.key).join(',') ===
			[single(l1), single(l2), single(l3), single(l4), l5, single(l7), single(f1), single(f2)].join(','),
		body.lessons.map((lesson) => `${lesson.date} ${lesson.outcome}`).join(', ')
	)
	expectRow('done lesson in debt', byKey(body, single(l1)), {
		outcome: 'done',
		counted: true,
		deductedMinutes: 60,
		balanceAfterMinutes: -60,
		held: true,
		payment: { id: p1, paidAfter: true },
		sinceLastPayment: false,
	})
	expectRow('second done lesson in debt', byKey(body, single(l2)), {
		balanceAfterMinutes: -120,
		payment: { id: p1, paidAfter: true },
	})
	expectRow('No-show that deducts', byKey(body, single(l3)), {
		outcome: 'no_show',
		deductedMinutes: 60,
		balanceAfterMinutes: 0,
		held: true,
		payment: { id: p1, paidAfter: false },
	})
	expectRow('cancelled lesson', byKey(body, single(l4)), {
		outcome: 'cancelled',
		counted: false,
		deductedMinutes: 0,
		balanceAfterMinutes: null,
		held: false,
		payment: null,
		projected: false,
	})
	expectRow('moved lesson marked done', byKey(body, l5), {
		outcome: 'done',
		date: day(-7),
		movedTo: null,
		deductedMinutes: 60,
		balanceAfterMinutes: -60,
		held: true,
		payment: { id: p2, paidAfter: true },
		sinceLastPayment: true,
	})
	check('moved lesson keeps where it moved from', byKey(body, l5)?.movedFrom === instant(day(-8), '10:00'))
	expectRow('past lesson without a mark', byKey(body, single(l7)), {
		outcome: 'planned',
		counted: true,
		deductedMinutes: 0,
		balanceAfterMinutes: 60,
		held: false,
		payment: null,
		projected: false,
		sinceLastPayment: true,
	})
	expectRow('first lesson ahead', byKey(body, single(f1)), {
		outcome: 'planned',
		balanceAfterMinutes: 0,
		projected: true,
		payment: null,
		held: false,
	})
	expectRow('second lesson ahead', byKey(body, single(f2)), {
		durationMinutes: 90,
		balanceAfterMinutes: -90,
		projected: true,
	})
	check(
		'lessons ahead carry the week actions',
		byKey(body, single(f1))?.actions?.move === true && byKey(body, single(l1))?.actions?.move === false
	)
	check(
		'period totals by outcome, Moved and held',
		JSON.stringify(body.totals) ===
			JSON.stringify({ planned: 3, done: 3, noShow: 1, cancelled: 1, moved: 1, heldCount: 4, heldMinutes: 240 }),
		JSON.stringify(body.totals)
	)
	const card = await call(ctx.api, 'GET', `/students/${studentId}`, { cookie: ctx.cookie })
	check(
		'the card balance equals the balance after the last held lesson',
		(card.json as unknown as { student: { balanceMinutes: number } }).student.balanceMinutes === 60
	)

	const since = await readLessons(ctx, studentId, 'range=since_payment')
	check(
		'since the last payment with debt: the period starts at the first lesson of the debt',
		since.from === day(-7) && since.to === ctx.today && !since.clipped && since.lastPayment?.id === p2,
		`${since.from} ${since.to}`
	)
	check(
		'since the last payment with debt: lessons are the moved lesson in debt and the later lesson',
		since.lessons.map((lesson) => lesson.key).join(',') === [l5, single(l7)].join(','),
		since.lessons.map((lesson) => lesson.date).join(',')
	)
	check(
		'since the last payment with debt: held dates are Done and deducting No-show only',
		since.lessons
			.filter((lesson) => lesson.held && lesson.sinceLastPayment)
			.map((lesson) => lesson.date)
			.join(',') === day(-7) && since.totals.heldCount === 1
	)
}

async function noDebtCard(ctx: Context, day: (shift: number) => string) {
	const studentId = await createCard(ctx, 'Alex Example 2541')
	await setOpening(ctx, studentId, 200, day(-20))
	const before = await heldLesson(ctx, studentId, day(-10), 'done')
	const payment = await pay(ctx, studentId, day(-6), 100)
	const paymentDay = await heldLesson(ctx, studentId, day(-6), 'done')
	const later = await heldLesson(ctx, studentId, day(-3), 'done')
	const since = await readLessons(ctx, studentId, 'range=since_payment')
	check(
		'since the last payment without debt: the period starts on the payment day',
		since.from === day(-6) && since.sinceLastPaymentFrom === day(-6) && since.lastPayment?.id === payment,
		`${since.from}`
	)
	check(
		'since the last payment without debt: the lesson of the payment day is inside, the earlier one is not',
		since.lessons.map((lesson) => lesson.key).join(',') === [single(paymentDay), single(later)].join(',') &&
			!since.lessons.some((lesson) => lesson.key === single(before)),
		since.lessons.map((lesson) => lesson.date).join(',')
	)
}

async function noShowOffCard(ctx: Context, day: (shift: number) => string) {
	const studentId = await createCard(ctx, 'Alex Example 2542')
	const off = await patchCard(ctx, studentId, { ...cardBody('Alex Example 2542'), noShowDeducts: false })
	if (off.status !== 200) throw new Error(`patch returned ${off.status}`)
	await setOpening(ctx, studentId, 200, day(-20))
	const missed = await heldLesson(ctx, studentId, day(-5), 'no_show')
	const body = await readLessons(ctx, studentId, `from=${day(-6)}&to=${day(-1)}`)
	expectRow('No-show that does not deduct', byKey(body, single(missed)), {
		outcome: 'no_show',
		counted: true,
		deductedMinutes: 0,
		balanceAfterMinutes: 120,
		held: false,
		payment: null,
	})
	check('No-show that does not deduct is not held', body.totals.heldCount === 0 && body.totals.noShow === 1)
}

async function lengthCard(ctx: Context, day: (shift: number) => string) {
	const studentId = await createCard(ctx, 'Alex Example 2543')
	await setOpening(ctx, studentId, 300, day(-20))
	const seriesId = insertSeriesOn(studentId, day(-3))
	await markOccurrence(ctx, seriesId, day(-3), 'done')
	sql(`update lesson_series set duration_minutes = 90 where id = ${quote(seriesId)}`)
	const body = await readLessons(ctx, studentId, `from=${day(-4)}&to=${day(-1)}`)
	expectRow('held lesson takes its length from the calendar', byKey(body, `s:${seriesId}:${day(-3)}`), {
		durationMinutes: 90,
		deductedMinutes: 90,
		balanceAfterMinutes: 90,
	})
	check('held minutes follow the calendar length', body.totals.heldMinutes === 90)
}

async function noPaymentCard(ctx: Context) {
	const studentId = await createCard(ctx, 'Alex Example 2544')
	await setOpening(ctx, studentId, 100, core.addDays(ctx.today, -10))
	const body = await readLessons(ctx, studentId, 'range=since_payment')
	const month = `${ctx.today.slice(0, 8)}01`
	check(
		'no payment: the period is the current month without a Last payment',
		body.from === month &&
			body.to === core.addDays(`${core.addDays(month, 32).slice(0, 8)}01`, -1) &&
			body.lastPayment === null &&
			body.sinceLastPaymentFrom === null &&
			!body.clipped,
		`${body.from} ${body.to}`
	)
}

async function clippedCard(ctx: Context, day: (shift: number) => string) {
	const studentId = await createCard(ctx, 'Alex Example 2545')
	await setOpening(ctx, studentId, 0, day(-400))
	const old = await heldLesson(ctx, studentId, day(-399), 'done')
	await pay(ctx, studentId, day(-2), 100)
	const body = await readLessons(ctx, studentId, 'range=since_payment')
	check(
		'a period since the last payment longer than 366 days is cut with clipped',
		body.clipped &&
			body.sinceLastPaymentFrom === day(-399) &&
			body.from === day(-365) &&
			body.to === ctx.today &&
			!body.lessons.some((lesson) => lesson.key === single(old)),
		`${body.from} ${body.sinceLastPaymentFrom} ${body.clipped}`
	)
}

async function refusals(ctx: Context, day: (shift: number) => string) {
	const studentId = await createCard(ctx, 'Alex Example 2546')
	const cases: Array<[string, string, number]> = [
		['366 days', `from=${day(-365)}&to=${ctx.today}`, 200],
		['367 days', `from=${day(-366)}&to=${ctx.today}`, 400],
		['reversed days', `from=${ctx.today}&to=${day(-1)}`, 400],
		['no period', '', 400],
		['only from', `from=${ctx.today}`, 400],
		['unknown range', 'range=month', 400],
		['range and days', `range=since_payment&from=${ctx.today}&to=${ctx.today}`, 400],
		['not a date', `from=2026-02-30&to=2026-03-01`, 400],
	]
	for (const [label, query, status] of cases) {
		const res = await lessonsOf(ctx, studentId, query)
		check(`${label} gives ${status}`, res.status === status, `got ${res.status}`)
	}
	const missing = await lessonsOf(ctx, crypto.randomUUID(), 'range=since_payment')
	check('unknown card gives 404', missing.status === 404, `got ${missing.status}`)
	const malformed = await lessonsOf(ctx, 'not-a-uuid', 'range=since_payment')
	check('malformed card id gives 404', malformed.status === 404, `got ${malformed.status}`)
}

export async function sectionLessons(ctx: Context) {
	const day = (shift: number) => core.addDays(ctx.today, shift)
	await mainCard(ctx, day)
	await noDebtCard(ctx, day)
	await noShowOffCard(ctx, day)
	await lengthCard(ctx, day)
	await noPaymentCard(ctx)
	await clippedCard(ctx, day)
	await refusals(ctx, day)
	return 'SCHEDULE_LEDGER_LESSONS_OK'
}
