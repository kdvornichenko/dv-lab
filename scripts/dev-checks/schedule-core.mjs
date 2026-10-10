import * as core from '../../packages/core/src/index.ts'
import { quote, sql } from './api.mjs'

const VN = core.SCHEDULE_TIME_ZONE
let failures = 0

function check(name, ok, detail = '') {
	if (ok) console.log(`PASS ${name}`)
	else {
		failures += 1
		console.log(`FAIL ${name}${detail ? ` ${detail}` : ''}`)
	}
}

const iso = (value) => (value instanceof Date ? value.toISOString() : value)

function partOne() {
	const cases = [
		['2026-10-14', '18:00', VN],
		['2026-01-01', '00:00', VN],
		['2026-12-31', '23:45', VN],
		['2026-10-14', '18:00', 'Europe/Moscow'],
		['2026-03-29', '12:00', 'Europe/Berlin'],
		['2026-10-25', '12:00', 'Europe/Berlin'],
	]
	const days = Array.from({ length: 14 }, (_, index) => core.addDays('2026-10-10', index))
	const columns = [
		...cases.map(([date, time, zone], index) => `((date ${quote(date)} + time ${quote(time)}) at time zone ${quote(zone)}) as i${index}`),
		...days.map((date, index) => `extract(isodow from date ${quote(date)})::int as w${index}`),
	]
	const row = sql(`select ${columns.join(', ')}`).rows[0]
	cases.forEach(([date, time, zone], index) => {
		const instant = core.zonedInstant(date, time, zone)
		const expected = new Date(row[`i${index}`]).toISOString()
		check(`zonedInstant ${date} ${time} ${zone} = SQL`, instant.toISOString() === expected, `${instant.toISOString()} vs ${expected}`)
		const parts = core.zonedParts(instant, zone)
		check(`zonedParts round trip ${date} ${time} ${zone}`, parts.date === date && parts.time === time, JSON.stringify(parts))
	})
	const weekdaysMatch = days.every((date, index) => core.weekdayOf(date) === row[`w${index}`])
	check('weekdayOf = isodow for 14 days', weekdaysMatch)

	const series = [
		{
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

partOne()
if (failures > 0) process.exit(1)
console.log('CORE_PART1_OK')
