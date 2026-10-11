import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as core from '../../../packages/core/src/index.ts'
import { ROOT, sql as rawSql, quote } from '../api.mjs'
import { balanceVectors, deductionVectors, paysSoonVectors } from './accounting.ts'
import {
	outcomeVectors,
	actionVectors,
	occurrenceVectors,
	todayVectors,
	VN,
	DATE_CASES,
	instant,
	dateVectors,
} from './lessons.ts'

let failures = 0

function check(name: string, ok: boolean, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures += 1
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const failureCount = () => failures

type Expect = (name: string, value: ScenarioValue, wanted: ScenarioValue) => void
type ScenarioValue = object | string | number | boolean | null | undefined
type Scenarios = { results: Record<string, ScenarioValue>; expected: Record<string, ScenarioValue> }
function collect(run: (expect: Expect) => void): Scenarios {
	const results: Scenarios['results'] = {}
	const expected: Scenarios['expected'] = {}
	const expect: Expect = (name, value, wanted) => {
		results[name] = value
		expected[name] = wanted
	}
	run(expect)
	return { results, expected }
}

type SqlRow = Record<string, string | number | null>
function row(value: unknown): SqlRow {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('invalid SQL row')
	const result: SqlRow = {}
	for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
		if (field !== null && typeof field !== 'string' && typeof field !== 'number') throw new Error('invalid SQL field')
		result[key] = field
	}
	return result
}
function rows(value: unknown): SqlRow[] {
	if (!Array.isArray(value)) throw new Error('invalid SQL rows')
	return (value as unknown[]).map(row)
}
function sql(text: string): { rows: SqlRow[] } {
	const result: unknown = rawSql(text)
	if (typeof result !== 'object' || result === null || !('rows' in result)) throw new Error('invalid SQL result')
	return { rows: rows(result.rows) }
}

type ChildResults = { zone: string; results: object }
function childResults(value: unknown): ChildResults {
	if (typeof value !== 'object' || value === null || !('zone' in value) || !('results' in value)) {
		throw new Error('core child gave invalid JSON')
	}
	if (typeof value.zone !== 'string' || typeof value.results !== 'object' || value.results === null) {
		throw new Error('core child gave invalid results')
	}
	return { zone: value.zone, results: value.results }
}
function processZone(cliUrl: string, zone: string): ChildResults | null {
	const child = spawnSync(process.execPath, [fileURLToPath(cliUrl), '--child'], {
		env: { ...process.env, TZ: zone },
		encoding: 'utf8',
	})
	if (child.status !== 0) return null
	const value: unknown = JSON.parse(child.stdout.trim().split('\n').pop() ?? '')
	return childResults(value)
}

type CardRow = { id: string; opening_minutes: number | null; opening_on: string | null }
type PaymentRow = { student_id: string; paid_on: string; credited_minutes: number }
function readCard(row: SqlRow): CardRow {
	if (typeof row.id !== 'string') throw new Error('invalid card id')
	if (row.opening_minutes !== null && typeof row.opening_minutes !== 'number')
		throw new Error('invalid opening minutes')
	if (row.opening_on !== null && typeof row.opening_on !== 'string') throw new Error('invalid opening date')
	return { id: row.id, opening_minutes: row.opening_minutes, opening_on: row.opening_on }
}
function readPayment(row: SqlRow): PaymentRow {
	if (
		typeof row.student_id !== 'string' ||
		typeof row.paid_on !== 'string' ||
		typeof row.credited_minutes !== 'number'
	) {
		throw new Error('invalid payment row')
	}
	return { student_id: row.student_id, paid_on: row.paid_on, credited_minutes: row.credited_minutes }
}
function devRows<T>(text: string, decode: (row: SqlRow) => T): T[] | null {
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
		const out: unknown = JSON.parse(line)
		if (typeof out !== 'object' || out === null || !('rows' in out)) return null
		return 'error' in out && out.error ? null : rows(out.rows).map(decode)
	} catch {
		return null
	}
}

function oldBalance(card: core.BalanceCard, payments: core.BalancePayment[]) {
	if (card.openingMinutes === null || card.openingOn === null) return null
	return payments
		.filter((payment) => payment.paidOn > (card.openingOn as string) && payment.creditedMinutes > 0)
		.reduce((sum, payment) => sum + payment.creditedMinutes, card.openingMinutes)
}

function devBalancesMatch() {
	const cards = devRows(
		'select id::text as id, opening_balance_minutes as opening_minutes, opening_balance_on::text as opening_on from students',
		readCard
	)
	const payments = devRows(
		'select student_id::text as student_id, paid_on::text as paid_on, credited_minutes from payments where student_id is not null',
		readPayment
	)
	if (cards === null || payments === null) {
		check('p1 dvlab_dev rows read', false, 'sql helper gave an error')
		return
	}
	const byStudent = new Map<string, core.BalancePayment[]>()
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

function datesMatchSql() {
	const columns = DATE_CASES.map(
		([text], index) => `(timestamptz ${quote(text)} at time zone ${quote(VN)})::date::text as d${index}`
	)
	const row = sql(`select ${columns.join(', ')}`).rows[0]
	const mismatched = DATE_CASES.filter(([text], index) => core.scheduleDate(instant(text)) !== row[`d${index}`])
	check('p1 scheduleDate = SQL at time zone for every case', mismatched.length === 0, `${mismatched.length} differ`)
}

const scenarios = () =>
	collect((expect) => {
		dateVectors(expect)
		balanceVectors(expect)
	})
const partTwo = () =>
	collect((expect) => {
		outcomeVectors(expect)
		actionVectors(expect)
		occurrenceVectors(expect)
		deductionVectors(expect)
		todayVectors(expect)
		paysSoonVectors(expect)
	})
const allResults = () => ({ one: scenarios().results, two: partTwo().results })

function run(cliUrl: string): void {
	function report({ results, expected }: Scenarios) {
		for (const name of Object.keys(results)) {
			const got = JSON.stringify(results[name])
			const wanted = JSON.stringify(expected[name])
			check(name, got === wanted, `got ${got} wanted ${wanted}`)
		}
	}

	if (process.argv.includes('--child')) {
		console.log(JSON.stringify({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone, results: allResults() }))
		process.exit(0)
	}

	report(scenarios())
	datesMatchSql()
	devBalancesMatch()
	if (failureCount() > 0) process.exit(1)
	console.log('LEDGER_CORE_PART1_OK')

	report(partTwo())
	const own = JSON.stringify(allResults())
	const newYork = processZone(cliUrl, 'America/New_York')
	const vietnam = processZone(cliUrl, 'Asia/Ho_Chi_Minh')
	check(
		'p2 results do not depend on the process zone',
		newYork !== null &&
			vietnam !== null &&
			newYork.zone !== vietnam.zone &&
			JSON.stringify(newYork.results) === own &&
			JSON.stringify(vietnam.results) === own,
		`zones ${newYork?.zone} ${vietnam?.zone}`
	)
	if (failureCount() > 0) process.exit(1)
	console.log('LEDGER_CORE_OK')
}

export { run }
export type { Expect }
