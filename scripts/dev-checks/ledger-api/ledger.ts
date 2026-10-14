import { readFileSync } from 'node:fs'
import { isDeepStrictEqual, parseEnv } from 'node:util'

import * as core from '../../../packages/core/src/index.ts'
import { ENV_TEST } from '../api.mjs'
import { call, quote, sql } from '../schedule-api/io.ts'
import { check, createCard, instant, patchCard, cardBody, removeCards, setOpening } from './context.ts'
import type { Context } from './types.ts'

const { createDb, resolveDatabaseUrl } = await import('../../../packages/db/src/index.ts')
const { loadMarkRows, toBalanceCard } = await import('../../../apps/api/src/schedule/rows.ts')

type Row = Record<string, unknown>

export const LEDGER_PREFIXES = ['Alex Example 253', 'Alex Example 254']

export function removeLedgerTails() {
	let removed = 0
	for (const prefix of LEDGER_PREFIXES) {
		removed += removeCards(`display_name like ${quote(`${prefix}%`)} and import_key is null`)
	}
	console.log(`ledger fixture tails removed ${removed}`)
}

const rows = (text: string) => sql(text).rows as unknown as Row[]

export function insertLessonAt(studentId: string, startsAt: string, minutes = 60, status = 'scheduled') {
	return String(
		rows(
			`insert into lessons (student_id, starts_at, duration_minutes, status) values (${quote(studentId)}, ${quote(startsAt)}, ${minutes}, ${quote(status)}) returning id`
		)[0]?.id
	)
}

export async function markLesson(ctx: Context, lessonId: string, kind: string) {
	const res = await call(ctx.api, 'POST', `/schedule/lessons/${lessonId}/mark`, {
		cookie: ctx.cookie,
		body: { kind },
	})
	if (res.status !== 200) throw new Error(`mark returned ${res.status}`)
}

export async function heldLesson(
	ctx: Context,
	studentId: string,
	date: string,
	kind: string,
	minutes = 60,
	time = '10:00'
) {
	const id = insertLessonAt(studentId, instant(date, time), minutes)
	await markLesson(ctx, id, kind)
	return id
}

export async function pay(
	ctx: Context,
	studentId: string,
	paidOn: string,
	lessonsHundredths: number,
	currency = 'RUB'
) {
	const res = await call(ctx.api, 'POST', '/payments', {
		cookie: ctx.cookie,
		body: { studentId, paidOn, amountMinor: 100000, currency, lessonsHundredths, note: null },
	})
	if (res.status !== 201) throw new Error(`payment returned ${res.status}`)
	return (res.json as unknown as { payment: { id: string } }).payment.id
}

function cardRow(studentId: string) {
	const [card] = rows(
		`select opening_balance_minutes, opening_balance_on::text as opening_on, no_show_deducts from students where id = ${quote(studentId)}`
	)
	return {
		openingMinutes: (card?.opening_balance_minutes ?? null) as number | null,
		openingOn: (card?.opening_on ?? null) as string | null,
		noShowDeducts: card?.no_show_deducts === true,
	}
}

function paymentRows(studentId: string) {
	return rows(
		`select paid_on::text as paid_on, credited_minutes from payments where student_id = ${quote(studentId)}`
	).map((row) => ({ paidOn: String(row.paid_on), creditedMinutes: Number(row.credited_minutes) }))
}

function singleLessonRows(studentId: string): core.BalanceLesson[] {
	return rows(
		`select l.starts_at, l.duration_minutes, l.status, m.kind from lessons l join lesson_marks m on m.lesson_id = l.id where l.student_id = ${quote(studentId)}`
	).map((row) => ({
		startsAt: new Date(String(row.starts_at)),
		durationMinutes: Number(row.duration_minutes),
		outcome: core.lessonOutcome(row.status === 'cancelled' ? 'cancelled' : 'scheduled', row.kind as core.MarkKind),
	}))
}

export function expectedBalance(studentId: string, timeZone: string) {
	return core.studentBalance(cardRow(studentId), paymentRows(studentId), singleLessonRows(studentId), timeZone)
}

export function expectedLastPayment(studentId: string) {
	const [row] = rows(
		`select p.id, p.paid_on::text as paid_on, p.amount_minor, p.currency, p.credited_minutes from payments p join students s on s.id = p.student_id where p.student_id = ${quote(studentId)} and s.opening_balance_on is not null and s.opening_balance_minutes is not null and p.paid_on > s.opening_balance_on and p.credited_minutes > 0 order by p.paid_on desc, p.created_at desc, p.id desc limit 1`
	)
	if (!row) return null
	return {
		id: String(row.id),
		paidOn: String(row.paid_on),
		amountMinor: Number(row.amount_minor),
		currency: row.currency === null ? null : String(row.currency),
		creditedMinutes: Number(row.credited_minutes),
	}
}

type Read = { balanceMinutes?: number | null; lastPayment?: unknown }

async function readCard(ctx: Context, studentId: string) {
	const list = await call(ctx.api, 'GET', '/students', { cookie: ctx.cookie })
	const profile = await call(ctx.api, 'GET', `/students/${studentId}`, { cookie: ctx.cookie })
	const listJson = list.json as unknown as { students: Array<Read & { id: string }>; defaultTimeZone: string }
	const row = listJson.students.find((student) => student.id === studentId)
	const detail = (profile.json as unknown as { student: Read }).student
	return { row, detail, zone: listJson.defaultTimeZone }
}

async function expectCard(
	ctx: Context,
	studentId: string,
	label: string,
	balance: number | null,
	last: 'none' | string
) {
	const { row, detail, zone } = await readCard(ctx, studentId)
	const computed = expectedBalance(studentId, zone)
	check(
		`${label}: balance equals studentBalance over the stored rows in the list and the profile`,
		row?.balanceMinutes === computed && detail?.balanceMinutes === computed,
		`list ${row?.balanceMinutes} profile ${detail?.balanceMinutes} rows ${computed}`
	)
	check(`${label}: balance is ${balance}`, computed === balance, `got ${computed}`)
	const expected = expectedLastPayment(studentId)
	check(
		`${label}: Last payment follows A5 in the list and the profile`,
		isDeepStrictEqual(row?.lastPayment, expected) && isDeepStrictEqual(detail?.lastPayment, expected),
		`list ${JSON.stringify(row?.lastPayment)} profile ${JSON.stringify(detail?.lastPayment)} rows ${JSON.stringify(expected)}`
	)
	check(
		`${label}: Last payment is ${last === 'none' ? 'none' : 'the expected payment'}`,
		last === 'none' ? expected === null : expected?.id === last
	)
}

async function sweep(ctx: Context) {
	const env = { ...parseEnv(readFileSync(ENV_TEST, 'utf8')), NODE_ENV: 'test' }
	const { db, pool } = createDb(resolveDatabaseUrl('app', env))
	try {
		const list = await call(ctx.api, 'GET', '/students', { cookie: ctx.cookie })
		const listJson = list.json as unknown as {
			students: Array<{ id: string; balanceMinutes: number | null; lastPayment?: unknown }>
			defaultTimeZone: string
		}
		const cards = rows(
			`select id, opening_balance_minutes, opening_balance_on::text as opening_balance_on, no_show_deducts from students`
		).map((row) => ({
			id: String(row.id),
			openingBalanceMinutes: (row.opening_balance_minutes ?? null) as number | null,
			openingBalanceOn: (row.opening_balance_on ?? null) as string | null,
			noShowDeducts: row.no_show_deducts === true,
		}))
		const held = await loadMarkRows(
			db,
			cards.map((card) => card.id)
		)
		let compared = 0
		let balanceMismatch = 0
		let paymentMismatch = 0
		for (const card of cards) {
			const shown = listJson.students.find((student) => student.id === card.id)
			if (!shown) continue
			compared += 1
			const before = core.studentBalance(
				toBalanceCard(card),
				paymentRows(card.id),
				held.filter((lesson) => lesson.studentId === card.id),
				listJson.defaultTimeZone
			)
			if (before !== shown.balanceMinutes) balanceMismatch += 1
			if (!isDeepStrictEqual(shown.lastPayment, expectedLastPayment(card.id))) paymentMismatch += 1
		}
		check(
			`every card of the database: balance by the old path equals the new loader (${compared} cards)`,
			compared > 0 && balanceMismatch === 0,
			`mismatches ${balanceMismatch}`
		)
		check(
			`every card of the database: Last payment follows A5 (${compared} cards)`,
			paymentMismatch === 0,
			`mismatches ${paymentMismatch}`
		)
	} finally {
		await pool.end()
	}
}

export async function sectionLedger(ctx: Context) {
	const day = (shift: number) => core.addDays(ctx.today, shift)

	const debt = await createCard(ctx, 'Alex Example 2530')
	await setOpening(ctx, debt, 0, day(-10))
	await heldLesson(ctx, debt, day(-9), 'done')
	await heldLesson(ctx, debt, day(-8), 'done')
	const debtPayment = await pay(ctx, debt, day(-5), 300)
	await heldLesson(ctx, debt, day(-3), 'done')
	await expectCard(ctx, debt, 'debt before the payment', 0, debtPayment)

	const two = await createCard(ctx, 'Alex Example 2531')
	await setOpening(ctx, two, 100, day(-10))
	await pay(ctx, two, day(-8), 200)
	await heldLesson(ctx, two, day(-6), 'done', 90)
	const twoLast = await pay(ctx, two, day(-4), 100, 'USD')
	await expectCard(ctx, two, 'two payments', 60 + 120 - 90 + 60, twoLast)

	const zero = await createCard(ctx, 'Alex Example 2532')
	await setOpening(ctx, zero, 0, day(-10))
	const zeroCredited = await pay(ctx, zero, day(-8), 100)
	await pay(ctx, zero, day(-3), 0)
	await expectCard(ctx, zero, 'a later payment with 0 credit', 60, zeroCredited)

	const deducts = await createCard(ctx, 'Alex Example 2533')
	await setOpening(ctx, deducts, 200, day(-10))
	await heldLesson(ctx, deducts, day(-5), 'no_show')
	await expectCard(ctx, deducts, 'No-show deducts with no payment', 60, 'none')
	const deductsPayment = await pay(ctx, deducts, day(-2), 100)
	await expectCard(ctx, deducts, 'No-show deducts after a payment', 120, deductsPayment)

	const keeps = await createCard(ctx, 'Alex Example 2534')
	const off = await patchCard(ctx, keeps, { ...cardBody('Alex Example 2534'), noShowDeducts: false })
	if (off.status !== 200) throw new Error(`patch returned ${off.status}`)
	await setOpening(ctx, keeps, 200, day(-10))
	await heldLesson(ctx, keeps, day(-5), 'no_show')
	await expectCard(ctx, keeps, 'No-show does not deduct', 120, 'none')

	const unset = await createCard(ctx, 'Alex Example 2535')
	await pay(ctx, unset, day(-3), 100)
	await heldLesson(ctx, unset, day(-2), 'done')
	await expectCard(ctx, unset, 'no opening balance', null, 'none')

	const sameDay = await createCard(ctx, 'Alex Example 2536')
	await setOpening(ctx, sameDay, 100, day(-6))
	await pay(ctx, sameDay, day(-6), 100)
	await expectCard(ctx, sameDay, 'a payment on the opening day', 60, 'none')

	const twice = await createCard(ctx, 'Alex Example 2537')
	await setOpening(ctx, twice, 0, day(-10))
	await pay(ctx, twice, day(-4), 100)
	const twiceLast = await pay(ctx, twice, day(-4), 200)
	await expectCard(ctx, twice, 'two payments on one day', 180, twiceLast)

	await sweep(ctx)
	return 'SCHEDULE_LEDGER_LEDGER_OK'
}
