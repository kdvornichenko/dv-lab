import { spawnSync } from 'node:child_process'

import * as core from '../../packages/core/src/index.ts'
import { ROOT, quote, sql } from './api.mjs'

const VN = core.SCHEDULE_TIME_ZONE
let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures += 1
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const at = (date, time) => core.zonedInstant(date, time, VN)
const instant = (text) => new Date(text)

const DATE_CASES = [
	['2026-10-10T16:59:59Z', '2026-10-10'],
	['2026-10-10T17:00:00Z', '2026-10-11'],
	['2026-12-31T17:30:00Z', '2027-01-01'],
	['2026-03-29T00:30:00Z', '2026-03-29'],
]

function scenarios() {
	const results = {}
	const expected = {}
	const expect = (name, value, wanted) => {
		results[name] = value
		expected[name] = wanted
	}

	expect(
		'p1 scheduleDate gives the Vietnam date',
		DATE_CASES.map(([text]) => core.scheduleDate(instant(text))),
		DATE_CASES.map(([, date]) => date)
	)
	const before = instant('2026-10-10T16:59:59Z')
	const after = instant('2026-10-10T17:00:00Z')
	expect(
		'p1 isAfterScheduleToday on both sides of Vietnam midnight',
		{
			todayBefore: core.isAfterScheduleToday('2026-10-10', before),
			tomorrowBefore: core.isAfterScheduleToday('2026-10-11', before),
			tomorrowAfter: core.isAfterScheduleToday('2026-10-11', after),
			todayAfter: core.scheduleToday(after),
		},
		{ todayBefore: false, tomorrowBefore: true, tomorrowAfter: false, todayAfter: '2026-10-11' }
	)

	const OPEN = '2026-10-01'
	const card = (over = {}) => ({ openingMinutes: 0, openingOn: OPEN, noShowDeducts: true, ...over })
	const pay = (paidOn, creditedMinutes) => ({ paidOn, creditedMinutes })
	const lesson = (date, time, durationMinutes, outcome) => ({ startsAt: at(date, time), durationMinutes, outcome })
	const balance = (over, payments = [], lessons = []) => core.studentBalance(card(over), payments, lessons)
	const late = balance({}, [], [lesson('2026-10-02', '18:00', 90, 'done')])
	expect(
		'p1 studentBalance cases',
		{
			noOpening: balance({ openingMinutes: null, openingOn: null }, [pay('2026-10-05', 60)]),
			zeroOpening: balance({}),
			paidOnOpening: balance({ openingMinutes: 120 }, [pay(OPEN, 60)]),
			paidNextDay: balance({ openingMinutes: 120 }, [pay('2026-10-02', 60)]),
			done60: balance({ openingMinutes: 0 }, [], [lesson('2026-10-02', '18:00', 60, 'done')]),
			done90: late,
			done90Lessons: core.formatLessons(late, 60),
			noShowOn: balance({}, [], [lesson('2026-10-02', '18:00', 60, 'no_show')]),
			noShowOff: balance({ noShowDeducts: false }, [], [lesson('2026-10-02', '18:00', 60, 'no_show')]),
			cancelled: balance({}, [], [lesson('2026-10-02', '18:00', 60, 'cancelled')]),
			moved: balance({}, [], [lesson('2026-10-02', '18:00', 60, 'moved')]),
			planned: balance({}, [], [lesson('2026-10-02', '18:00', 60, 'planned')]),
			vnAfterMidnight: balance({}, [], [lesson('2026-10-02', '00:30', 60, 'done')]),
			vnLateOnOpening: balance({}, [], [lesson(OPEN, '23:30', 60, 'done')]),
			mixed: balance(
				{ openingMinutes: 120 },
				[pay(OPEN, 600), pay('2026-10-03', 60)],
				[lesson(OPEN, '18:00', 60, 'done'), lesson('2026-10-04', '18:00', 60, 'done')]
			),
		},
		{
			noOpening: null,
			zeroOpening: 0,
			paidOnOpening: 120,
			paidNextDay: 180,
			done60: -60,
			done90: -90,
			done90Lessons: '-1.5',
			noShowOn: -60,
			noShowOff: 0,
			cancelled: 0,
			moved: 0,
			planned: 0,
			vnAfterMidnight: -60,
			vnLateOnOpening: 0,
			mixed: 120,
		}
	)
	const nightLesson = at('2026-10-02', '00:30')
	expect(
		'p1 a 00:30 Vietnam lesson is still the opening day in Moscow and UTC',
		{
			utc: nightLesson.toISOString().slice(0, 10),
			moscow: core.zonedParts(nightLesson, 'Europe/Moscow').date,
			vietnam: core.scheduleDate(nightLesson),
		},
		{ utc: OPEN, moscow: OPEN, vietnam: '2026-10-02' }
	)

	return { results, expected }
}

function report({ results, expected }) {
	for (const name of Object.keys(results)) {
		const got = JSON.stringify(results[name])
		const wanted = JSON.stringify(expected[name])
		check(name, got === wanted, `got ${got} wanted ${wanted}`)
	}
}

function datesMatchSql() {
	const columns = DATE_CASES.map(
		([text], index) => `(timestamptz ${quote(text)} at time zone ${quote(VN)})::date::text as d${index}`
	)
	const row = sql(`select ${columns.join(', ')}`).rows[0]
	const mismatched = DATE_CASES.filter(([text], index) => core.scheduleDate(instant(text)) !== row[`d${index}`])
	check('p1 scheduleDate = SQL at time zone for every case', mismatched.length === 0, `${mismatched.length} differ`)
}

function devRows(text) {
	const env = { ...process.env }
	delete env.DATABASE_URL
	delete env.MIGRATOR_DATABASE_URL
	const child = spawnSync(process.execPath, [`${ROOT}/scripts/dev-checks/sql.mjs`, `${ROOT}/.env`, 'app', text], {
		cwd: ROOT,
		env,
		encoding: 'utf8',
	})
	const line = (child.stdout ?? '').trim().split('\n').pop() ?? ''
	try {
		const out = JSON.parse(line)
		return out.error ? null : out.rows
	} catch {
		return null
	}
}

function oldBalance(card, payments) {
	if (card.openingMinutes === null || card.openingOn === null) return null
	return payments
		.filter((payment) => payment.paidOn > card.openingOn && payment.creditedMinutes > 0)
		.reduce((sum, payment) => sum + payment.creditedMinutes, card.openingMinutes)
}

function devBalancesMatch() {
	const cards = devRows(
		'select id::text as id, opening_balance_minutes as opening_minutes, opening_balance_on::text as opening_on from students'
	)
	const payments = devRows(
		'select student_id::text as student_id, paid_on::text as paid_on, credited_minutes from payments where student_id is not null'
	)
	if (cards === null || payments === null) {
		check('p1 dvlab_dev rows read', false, 'sql helper gave an error')
		return
	}
	const byStudent = new Map()
	for (const row of payments) {
		const list = byStudent.get(row.student_id) ?? []
		list.push({ paidOn: row.paid_on, creditedMinutes: row.credited_minutes })
		byStudent.set(row.student_id, list)
	}
	let equal = 0
	for (const row of cards) {
		const card = { openingMinutes: row.opening_minutes, openingOn: row.opening_on, noShowDeducts: true }
		const own = byStudent.get(row.id) ?? []
		if (core.studentBalance(card, own, []) === oldBalance(card, own)) equal += 1
	}
	console.log(`cards ${cards.length} equal ${equal}`)
	check('p1 dvlab_dev balances equal the current SQL rule', equal === cards.length, `${cards.length - equal} differ`)
}

if (process.argv.includes('--child')) {
	console.log(JSON.stringify({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone, results: scenarios().results }))
	process.exit(0)
}

report(scenarios())
datesMatchSql()
devBalancesMatch()
if (failures > 0) process.exit(1)
console.log('LEDGER_CORE_PART1_OK')
