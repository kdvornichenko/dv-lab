import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import * as core from '../../../packages/core/src/index.ts'
import { sql as rawSql, quote } from '../api.mjs'
import {
	VN,
	iso,
	emptySeriesVectors,
	occurrenceVectors,
	overlapVectors,
	cancelledMoveVectors,
	nextLessonVectors,
	seriesDateVectors,
	movedNextVectors,
} from './occurrences.ts'
import { seriesCutVectors, seriesEndVectors, preservedLessonVectors, movedTailVectors } from './series.ts'

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

function timestampChecks(): { days: string[]; row: SqlRow } {
	const cases: [string, string, string][] = [
		['2026-10-14', '18:00', VN],
		['2026-01-01', '00:00', VN],
		['2026-12-31', '23:45', VN],
		['2026-10-14', '18:00', 'Europe/Moscow'],
		['2026-03-29', '12:00', 'Europe/Berlin'],
		['2026-10-25', '12:00', 'Europe/Berlin'],
		['0050-03-03', '10:00', 'UTC'],
		['0099-12-31', '23:45', 'Europe/Moscow'],
	]
	const days = Array.from({ length: 14 }, (_, index) => core.addDays('2026-10-10', index))
	const columns = [
		...cases.map(
			([date, time, zone], index) =>
				`((date ${quote(date)} + time ${quote(time)}) at time zone ${quote(zone)}) as i${index}`
		),
		...days.map((date, index) => `extract(isodow from date ${quote(date)})::int as w${index}`),
	]
	const row = sql(`select ${columns.join(', ')}`).rows[0]
	cases.forEach(([date, time, zone], index) => {
		const instant = core.zonedInstant(date, time, zone)
		const expected = new Date(row[`i${index}`] as string).toISOString()
		check(
			`zonedInstant ${date} ${time} ${zone} = SQL`,
			instant.toISOString() === expected,
			`${instant.toISOString()} vs ${expected}`
		)
		const parts = core.zonedParts(instant, zone)
		check(
			`zonedParts round trip ${date} ${time} ${zone}`,
			parts.date === date && parts.time === time,
			JSON.stringify(parts)
		)
	})

	return { days, row }
}
function weekdayChecks(days: string[], row: SqlRow): void {
	const weekdaysMatch = days.every((date, index) => core.weekdayOf(date) === row[`w${index}`])
	check('weekdayOf = isodow for 14 days', weekdaysMatch)
	const early = sql(
		`select (date '0050-01-01' + 1)::text as next, (date '0099-12-31' + 1)::text as century, extract(isodow from date '0050-03-03')::int as weekday`
	).rows[0]
	const vnEarly = core.zonedParts(core.zonedInstant('0050-03-03', '10:00', VN), VN)
	check(
		'years 0001-0099 stay in their century',
		core.addDays('0050-01-01', 1) === early.next &&
			core.addDays('0099-12-31', 1) === early.century &&
			core.weekdayOf('0050-03-03') === early.weekday &&
			vnEarly.date === '0050-03-03' &&
			vnEarly.time === '10:00',
		JSON.stringify({ early, vnEarly })
	)
}
function weekWindowCheck(): void {
	const series: core.SeriesRule[] = [
		{
			timeZone: VN,
			id: 'series-wed',
			studentId: 'student-alex-0001',
			weekday: 3,
			startTime: '18:00',
			durationMinutes: 60,
			startsOn: '2026-10-07',
			endsOn: null,
		},
	]
	const blocks = core.scheduleWindow({
		series,
		exceptions: [],
		lessons: [],
		from: core.zonedInstant('2026-10-12', '00:00', VN),
		to: core.zonedInstant('2026-10-19', '00:00', VN),
	})
	check(
		'week window gives one Wednesday block',
		blocks.length === 1 &&
			blocks[0].status === 'scheduled' &&
			iso(blocks[0].startsAt) === '2026-10-14T11:00:00.000Z' &&
			blocks[0].key === 's:series-wed:2026-10-14',
		JSON.stringify(blocks)
	)
}
function partOne(): void {
	const { days, row } = timestampChecks()
	weekdayChecks(days, row)
	weekWindowCheck()
}

const partTwo = () =>
	collect((expect) => {
		emptySeriesVectors(expect)
		occurrenceVectors(expect)
		nextLessonVectors(expect)
		overlapVectors(expect)
		seriesDateVectors(expect)
		seriesCutVectors(expect)
		seriesEndVectors(expect)
		preservedLessonVectors(expect)
		cancelledMoveVectors(expect)
		movedNextVectors(expect)
		movedTailVectors(expect)
	})

function run(cliUrl: string): void {
	if (process.argv.includes('--child')) {
		console.log(JSON.stringify({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone, results: partTwo().results }))
		process.exit(0)
	}

	partOne()
	if (failureCount() > 0) process.exit(1)
	console.log('CORE_PART1_OK')

	const { results, expected } = partTwo()
	for (const name of Object.keys(results)) {
		const got = JSON.stringify(results[name])
		const wanted = JSON.stringify(expected[name])
		const actualValue: unknown = got === undefined ? undefined : JSON.parse(got)
		const expectedValue: unknown = wanted === undefined ? undefined : JSON.parse(wanted)
		check(name, isDeepStrictEqual(actualValue, expectedValue), `got ${got} wanted ${wanted}`)
	}
	const newYork = processZone(cliUrl, 'America/New_York')
	const vietnam = processZone(cliUrl, 'Asia/Ho_Chi_Minh')
	const own = JSON.stringify(results)
	check(
		's12 results do not depend on the process zone',
		newYork !== null &&
			vietnam !== null &&
			newYork.zone !== vietnam.zone &&
			JSON.stringify(newYork.results) === own &&
			JSON.stringify(vietnam.results) === own,
		`zones ${newYork?.zone} ${vietnam?.zone}`
	)
	if (failureCount() > 0) process.exit(1)
	console.log('CORE_OK')
}

export { run }
export type { Expect }
