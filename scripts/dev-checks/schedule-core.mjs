import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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
		const expected = new Date(row[`i${index}`]).toISOString()
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

const NOW = new Date('2026-10-12T03:00:00.000Z')
const STUDENT = 'student-alex-0001'
const at = (date, time) => core.zonedInstant(date, time, VN)
const week = (monday) => ({ from: at(monday, '00:00'), to: at(core.addDays(monday, 7), '00:00') })
const rule = (over = {}) => ({
	id: 'series-a',
	studentId: STUDENT,
	weekday: 3,
	startTime: '18:00',
	durationMinutes: 60,
	startsOn: '2026-10-07',
	endsOn: null,
	...over,
})
const view = (blocks) =>
	blocks.map((block) => ({
		key: block.key,
		status: block.status,
		startsAt: block.startsAt,
		durationMinutes: block.durationMinutes,
		movedTo: block.movedTo,
		movedFrom: block.movedFrom,
	}))
const entries = (map) => [...map].map(([key, value]) => [key, value.toISOString()]).sort()
const windowOf = (series, exceptions, lessons, monday) =>
	view(core.scheduleWindow({ series, exceptions, lessons, ...week(monday) }))

function partTwo() {
	const results = {}
	const expected = {}
	const expect = (name, value, wanted) => {
		results[name] = value
		expected[name] = wanted
	}

	const empty = rule({ startsOn: '2026-10-14', endsOn: '2026-10-13' })
	expect(
		's1 empty series has no dates, blocks or next lesson',
		{
			date: core.isSeriesDate(empty, '2026-10-14'),
			blocks: windowOf([empty], [], [], '2026-10-12'),
			next: entries(core.nextLessons({ series: [empty], exceptions: [], lessons: [], now: NOW })),
			nextDate: core.nextSeriesDate(empty, NOW),
			lastDate: core.lastSeriesDateOnOrBefore(empty, '2026-12-31'),
			has: core.hasOccurrences(empty),
		},
		{ date: false, blocks: [], next: [], nextDate: null, lastDate: null, has: false }
	)

	const weekly = rule()
	expect(
		's2 cancelled exception gives a cancelled block, restored gives scheduled',
		{
			cancelled: windowOf(
				[weekly],
				[{ seriesId: 'series-a', originalOn: '2026-10-14', kind: 'cancelled' }],
				[],
				'2026-10-12'
			),
			restored: windowOf(
				[weekly],
				[{ seriesId: 'series-a', originalOn: '2026-10-14', kind: 'restored' }],
				[],
				'2026-10-12'
			),
		},
		{
			cancelled: [
				{
					key: 's:series-a:2026-10-14',
					status: 'cancelled',
					startsAt: '2026-10-14T11:00:00.000Z',
					durationMinutes: 60,
					movedTo: null,
					movedFrom: null,
				},
			],
			restored: [
				{
					key: 's:series-a:2026-10-14',
					status: 'scheduled',
					startsAt: '2026-10-14T11:00:00.000Z',
					durationMinutes: 60,
					movedTo: null,
					movedFrom: null,
				},
			],
		}
	)

	const insideWeek = [
		{
			seriesId: 'series-a',
			originalOn: '2026-10-14',
			kind: 'moved',
			startsAt: at('2026-10-16', '09:00'),
			durationMinutes: 45,
		},
	]
	const insideBlocks = core.scheduleWindow({
		series: [weekly],
		exceptions: insideWeek,
		lessons: [],
		...week('2026-10-12'),
	})
	expect('s3 move inside the week gives a ghost and a destination with one key', view(insideBlocks), [
		{
			key: 's:series-a:2026-10-14',
			status: 'moved',
			startsAt: '2026-10-14T11:00:00.000Z',
			durationMinutes: 60,
			movedTo: '2026-10-16T02:00:00.000Z',
			movedFrom: null,
		},
		{
			key: 's:series-a:2026-10-14',
			status: 'scheduled',
			startsAt: '2026-10-16T02:00:00.000Z',
			durationMinutes: 45,
			movedTo: null,
			movedFrom: '2026-10-14T11:00:00.000Z',
		},
	])

	const crossWeek = [
		{
			seriesId: 'series-a',
			originalOn: '2026-10-21',
			kind: 'moved',
			startsAt: at('2026-10-12', '16:00'),
			durationMinutes: 60,
		},
	]
	const movedKey = 's:series-a:2026-10-21'
	expect(
		's4 move from next Wednesday to this Monday shows in both weeks',
		{
			thisWeek: windowOf([weekly], crossWeek, [], '2026-10-12').filter((block) => block.key === movedKey),
			nextWeek: windowOf([weekly], crossWeek, [], '2026-10-19').filter((block) => block.key === movedKey),
		},
		{
			thisWeek: [
				{
					key: movedKey,
					status: 'scheduled',
					startsAt: '2026-10-12T09:00:00.000Z',
					durationMinutes: 60,
					movedTo: null,
					movedFrom: '2026-10-21T11:00:00.000Z',
				},
			],
			nextWeek: [
				{
					key: movedKey,
					status: 'moved',
					startsAt: '2026-10-21T11:00:00.000Z',
					durationMinutes: 60,
					movedTo: '2026-10-12T09:00:00.000Z',
					movedFrom: null,
				},
			],
		}
	)

	const ended = rule({ endsOn: '2026-10-14' })
	const history = [
		{
			seriesId: 'series-a',
			originalOn: '2026-10-21',
			kind: 'moved',
			startsAt: at('2026-10-15', '18:00'),
			durationMinutes: 60,
		},
		{ seriesId: 'series-a', originalOn: '2026-10-28', kind: 'cancelled' },
	]
	expect(
		's5 history after ends_on stays hidden',
		{
			thisWeek: windowOf([ended], history, [], '2026-10-12').map((block) => block.key),
			nextWeek: windowOf([ended], history, [], '2026-10-19'),
			weekAfter: windowOf([ended], history, [], '2026-10-26'),
			next: entries(core.nextLessons({ series: [ended], exceptions: history, lessons: [], now: NOW })),
		},
		{ thisWeek: ['s:series-a:2026-10-14'], nextWeek: [], weekAfter: [], next: [[STUDENT, '2026-10-14T11:00:00.000Z']] }
	)

	const nextSeries = [
		rule({ id: 'series-a', studentId: 'student-a' }),
		rule({ id: 'series-b', studentId: 'student-b', weekday: 1, startTime: '09:00', startsOn: '2026-10-05' }),
		rule({ id: 'series-c', studentId: 'student-c', weekday: 1, startTime: '09:00', startsOn: '2026-10-05' }),
		rule({ id: 'series-d', studentId: 'student-d', weekday: 4, startsOn: '2026-09-03', endsOn: '2026-10-08' }),
	]
	const nextExceptions = [
		{
			seriesId: 'series-b',
			originalOn: '2026-10-19',
			kind: 'moved',
			startsAt: at('2026-10-13', '10:00'),
			durationMinutes: 60,
		},
		{
			seriesId: 'series-d',
			originalOn: '2026-10-08',
			kind: 'moved',
			startsAt: at('2026-10-20', '18:00'),
			durationMinutes: 60,
		},
		{
			seriesId: 'series-d',
			originalOn: '2026-10-15',
			kind: 'moved',
			startsAt: at('2026-10-13', '08:00'),
			durationMinutes: 60,
		},
	]
	const nextSingles = [
		{
			id: 'lesson-a1',
			studentId: 'student-a',
			startsAt: at('2026-10-13', '12:00'),
			durationMinutes: 60,
			status: 'scheduled',
		},
		{
			id: 'lesson-a2',
			studentId: 'student-a',
			startsAt: at('2026-10-12', '11:00'),
			durationMinutes: 60,
			status: 'cancelled',
		},
		{
			id: 'lesson-e1',
			studentId: 'student-e',
			startsAt: at('2026-10-13', '11:00'),
			durationMinutes: 60,
			status: 'cancelled',
		},
		{
			id: 'lesson-e2',
			studentId: 'student-e',
			startsAt: at('2026-10-12', '09:00'),
			durationMinutes: 60,
			status: 'scheduled',
		},
	]
	expect(
		's6 next lesson is the minimum of series, moved and single lessons',
		entries(core.nextLessons({ series: nextSeries, exceptions: nextExceptions, lessons: nextSingles, now: NOW })),
		[
			['student-a', '2026-10-13T05:00:00.000Z'],
			['student-b', '2026-10-13T03:00:00.000Z'],
			['student-c', '2026-10-19T02:00:00.000Z'],
			['student-d', '2026-10-20T11:00:00.000Z'],
		]
	)

	const base = at('2026-10-14', '18:00')
	const item = (key, status, startsAt, durationMinutes = 60) => ({ key, status, startsAt, durationMinutes })
	const items = [
		item('k1', 'scheduled', base),
		item('k2', 'cancelled', base),
		item('k3', 'moved', base),
		item('k4', 'scheduled', at('2026-10-14', '19:00')),
		item('k5', 'scheduled', at('2026-10-14', '17:00')),
	]
	const candidate = { startsAt: base, durationMinutes: 60 }
	expect(
		's7 overlaps skip cancelled and moved, touching ends do not overlap, excludeKey works',
		{
			all: core.overlaps(items, candidate).map((found) => found.key),
			excluded: core.overlaps(items, candidate, 'k1').map((found) => found.key),
			ghost: core.overlaps(insideBlocks, { startsAt: base, durationMinutes: 60 }).map((found) => found.status),
			destination: core
				.overlaps(insideBlocks, { startsAt: at('2026-10-16', '09:30'), durationMinutes: 30 })
				.map((found) => found.status),
		},
		{ all: ['k1'], excluded: [], ghost: [], destination: ['scheduled'] }
	)

	const bounded = rule({ startsOn: '2026-10-14', endsOn: '2026-10-28' })
	const farStart = core.addDays('2026-10-12', 300)
	const far = rule({ id: 'series-far', weekday: core.weekdayOf(farStart), startsOn: farStart })
	expect(
		's8 series dates at startsOn, endsOn, empty series and a start 300 days ahead',
		{
			lastBeforeStart: core.lastSeriesDateOnOrBefore(bounded, '2026-10-13'),
			lastAtStart: core.lastSeriesDateOnOrBefore(bounded, '2026-10-14'),
			lastMidweek: core.lastSeriesDateOnOrBefore(bounded, '2026-10-20'),
			lastAtEnd: core.lastSeriesDateOnOrBefore(bounded, '2026-10-28'),
			lastAfterEnd: core.lastSeriesDateOnOrBefore(bounded, '2026-11-30'),
			nextFromNow: core.nextSeriesDate(bounded, NOW),
			nextBeforeLast: core.nextSeriesDate(bounded, at('2026-10-28', '17:59')),
			nextAtLast: core.nextSeriesDate(bounded, at('2026-10-28', '18:00')),
			nextEmpty: core.nextSeriesDate(empty, NOW),
			lastEmpty: core.lastSeriesDateOnOrBefore(empty, '2026-10-14'),
			nextFar: core.nextSeriesDate(far, NOW),
			nextLessonFar: entries(core.nextLessons({ series: [far], exceptions: [], lessons: [], now: NOW })),
		},
		{
			lastBeforeStart: null,
			lastAtStart: '2026-10-14',
			lastMidweek: '2026-10-14',
			lastAtEnd: '2026-10-28',
			lastAfterEnd: '2026-10-28',
			nextFromNow: '2026-10-14',
			nextBeforeLast: '2026-10-28',
			nextAtLast: null,
			nextEmpty: null,
			lastEmpty: null,
			nextFar: farStart,
			nextLessonFar: [[STUDENT, at(farStart, '18:00').toISOString()]],
		}
	)

	expect(
		's9 canChange is false at now and true one millisecond later',
		{ atNow: core.canChange(NOW, NOW), later: core.canChange(new Date(NOW.getTime() + 1), NOW) },
		{ atNow: false, later: true }
	)

	const cut = (series, exceptions, change, now = NOW) => core.cutSeries(series, exceptions, change, now)
	const kind = (result) => result.kind
	const opened = cut(
		weekly,
		[
			{
				seriesId: 'series-a',
				originalOn: '2026-10-14',
				kind: 'moved',
				startsAt: at('2026-10-15', '12:00'),
				durationMinutes: 60,
			},
			{
				seriesId: 'series-a',
				originalOn: '2026-10-28',
				kind: 'moved',
				startsAt: at('2026-10-30', '12:00'),
				durationMinutes: 50,
			},
			{ seriesId: 'series-a', originalOn: '2026-11-04', kind: 'cancelled' },
		],
		{ from: '2026-10-21', weekday: 4, startTime: '17:00' }
	)
	expect(
		's10 cutSeries checks, old end, new rule and moved lessons',
		{
			yesterday: kind(cut(weekly, [], { from: '2026-10-11', weekday: 4, startTime: '17:00' })),
			repeated: kind(cut(rule({ endsOn: '2026-10-14' }), [], { from: '2026-10-21', weekday: 4, startTime: '17:00' })),
			sameSlot: kind(cut(weekly, [], { from: '2026-10-21', weekday: 3, startTime: '18:00' })),
			startedToday: kind(
				cut(
					rule({ weekday: 1, startTime: '00:00', startsOn: '2026-10-05' }),
					[{ seriesId: 'series-a', originalOn: '2026-10-12', kind: 'cancelled' }],
					{ from: '2026-10-12', weekday: 2, startTime: '10:00' }
				)
			),
			opened,
			endsBefore: cut(rule({ endsOn: '2026-10-14' }), [], { from: '2026-10-14', weekday: 4, startTime: '18:00' }),
			beforeFirst: cut(rule({ startsOn: '2026-10-28' }), [], { from: '2026-10-12', weekday: 5, startTime: '18:00' }),
			earlierToday: cut(weekly, [], { from: '2026-10-12', weekday: 1, startTime: '09:00' }),
		},
		{
			yesterday: 'invalid',
			repeated: 'changed',
			sameSlot: 'invalid',
			startedToday: 'today_passed',
			opened: {
				kind: 'ok',
				oldEndsOn: '2026-10-20',
				newRule: {
					studentId: STUDENT,
					weekday: 4,
					startTime: '17:00',
					durationMinutes: 60,
					startsOn: '2026-10-22',
					endsOn: null,
				},
				lessons: [
					{ studentId: STUDENT, startsAt: '2026-10-30T05:00:00.000Z', durationMinutes: 50, originalOn: '2026-10-28' },
				],
			},
			endsBefore: { kind: 'ends_before_new_day', endsOn: '2026-10-14' },
			beforeFirst: {
				kind: 'ok',
				oldEndsOn: '2026-10-27',
				newRule: {
					studentId: STUDENT,
					weekday: 5,
					startTime: '18:00',
					durationMinutes: 60,
					startsOn: '2026-10-16',
					endsOn: null,
				},
				lessons: [],
			},
			earlierToday: {
				kind: 'ok',
				oldEndsOn: '2026-10-11',
				newRule: {
					studentId: STUDENT,
					weekday: 1,
					startTime: '09:00',
					durationMinutes: 60,
					startsOn: '2026-10-19',
					endsOn: null,
				},
				lessons: [],
			},
		}
	)

	const fresh = rule({ startsOn: '2026-10-14' })
	const beforeFirst = core.endSeriesAt(fresh, [], '2026-10-13', NOW)
	expect(
		's11 endSeriesAt checks and resulting ends_on',
		{
			yesterday: core.endSeriesAt(fresh, [], '2026-10-11', NOW),
			pastEnd: core.endSeriesAt(rule({ startsOn: '2026-10-14', endsOn: '2026-10-21' }), [], '2026-10-28', NOW),
			alreadyEnded: core.endSeriesAt(rule({ endsOn: '2026-10-07' }), [], '2026-10-12', NOW),
			beforeFirst,
			beforeFirstHas: core.hasOccurrences({ ...fresh, endsOn: beforeFirst.endsOn }),
			secondDate: core.endSeriesAt(fresh, [], '2026-10-21', NOW),
			afterSecond: core.endSeriesAt(fresh, [], '2026-10-23', NOW),
		},
		{
			yesterday: { kind: 'invalid' },
			pastEnd: { kind: 'invalid' },
			alreadyEnded: { kind: 'changed' },
			beforeFirst: { kind: 'ok', endsOn: '2026-10-13', lessons: [] },
			beforeFirstHas: false,
			secondDate: { kind: 'ok', endsOn: '2026-10-21', lessons: [] },
			afterSecond: { kind: 'ok', endsOn: '2026-10-21', lessons: [] },
		}
	)

	const endExceptions = [
		{
			seriesId: 'series-a',
			originalOn: '2026-10-21',
			kind: 'moved',
			startsAt: at('2026-10-08', '18:00'),
			durationMinutes: 60,
		},
		{
			seriesId: 'series-a',
			originalOn: '2026-10-14',
			kind: 'moved',
			startsAt: at('2026-10-09', '18:00'),
			durationMinutes: 60,
		},
		{
			seriesId: 'series-a',
			originalOn: '2026-10-28',
			kind: 'cancelled',
			startsAt: at('2026-10-06', '10:00'),
			durationMinutes: 60,
		},
		{
			seriesId: 'series-a',
			originalOn: '2026-11-04',
			kind: 'moved',
			startsAt: at('2026-11-06', '12:00'),
			durationMinutes: 45,
		},
	]
	const endResult = core.endSeriesAt(weekly, endExceptions, '2026-10-14', NOW)
	const keptLessons = (endResult.lessons ?? []).map((lesson, index) => ({
		...lesson,
		id: `kept-${index + 1}`,
		status: 'scheduled',
	}))
	const endedWeekly = { ...weekly, endsOn: endResult.endsOn }
	const thursday = (blocks) =>
		blocks
			.filter((block) => iso(block.startsAt) === '2026-10-08T11:00:00.000Z')
			.map((block) => [block.key, block.status])
	expect(
		's14 End series keeps moved occurrences after the new end as lessons, past ones included',
		{
			result: endResult,
			bounded: core.endSeriesAt(rule({ endsOn: '2026-10-28' }), endExceptions, '2026-10-14', NOW),
			before: thursday(windowOf([weekly], endExceptions, [], '2026-10-05')),
			after: thursday(windowOf([endedWeekly], endExceptions, keptLessons, '2026-10-05')),
			afterWeek: windowOf([endedWeekly], endExceptions, keptLessons, '2026-10-05').map((block) => [
				block.key,
				block.status,
			]),
		},
		{
			result: {
				kind: 'ok',
				endsOn: '2026-10-14',
				lessons: [
					{ studentId: STUDENT, startsAt: '2026-10-08T11:00:00.000Z', durationMinutes: 60, originalOn: '2026-10-21' },
					{ studentId: STUDENT, startsAt: '2026-11-06T05:00:00.000Z', durationMinutes: 45, originalOn: '2026-11-04' },
				],
			},
			bounded: {
				kind: 'ok',
				endsOn: '2026-10-14',
				lessons: [
					{ studentId: STUDENT, startsAt: '2026-10-08T11:00:00.000Z', durationMinutes: 60, originalOn: '2026-10-21' },
				],
			},
			before: [['s:series-a:2026-10-21', 'scheduled']],
			after: [['l:kept-1', 'scheduled']],
			afterWeek: [
				['s:series-a:2026-10-07', 'scheduled'],
				['l:kept-1', 'scheduled'],
				['s:series-a:2026-10-14', 'scheduled'],
			],
		}
	)

	const cancelledMoved = [
		{
			seriesId: 'series-a',
			originalOn: '2026-10-14',
			kind: 'cancelled',
			startsAt: at('2026-10-16', '09:00'),
			durationMinutes: 45,
		},
	]
	const cancelledAcross = [
		{
			seriesId: 'series-a',
			originalOn: '2026-10-21',
			kind: 'cancelled',
			startsAt: at('2026-10-12', '16:00'),
			durationMinutes: 60,
		},
	]
	const occurrence = core.occurrenceAt(weekly, '2026-10-14', cancelledMoved[0])
	expect(
		's13 a cancelled moved occurrence stands cancelled on the moved place',
		{
			occurrence: {
				status: occurrence?.status,
				startsAt: occurrence?.startsAt,
				naturalStart: occurrence?.naturalStart,
				durationMinutes: occurrence?.durationMinutes,
			},
			insideWeek: windowOf([weekly], cancelledMoved, [], '2026-10-12'),
			thisWeek: windowOf([weekly], cancelledAcross, [], '2026-10-12').filter((block) => block.key === movedKey),
			nextWeek: windowOf([weekly], cancelledAcross, [], '2026-10-19').filter((block) => block.key === movedKey),
			next: entries(core.nextLessons({ series: [weekly], exceptions: cancelledMoved, lessons: [], now: NOW })),
			cutLessons: cut(weekly, cancelledMoved, { from: '2026-10-14', weekday: 4, startTime: '17:00' }).lessons,
		},
		{
			occurrence: {
				status: 'cancelled',
				startsAt: '2026-10-16T02:00:00.000Z',
				naturalStart: '2026-10-14T11:00:00.000Z',
				durationMinutes: 45,
			},
			insideWeek: [
				{
					key: 's:series-a:2026-10-14',
					status: 'moved',
					startsAt: '2026-10-14T11:00:00.000Z',
					durationMinutes: 60,
					movedTo: '2026-10-16T02:00:00.000Z',
					movedFrom: null,
				},
				{
					key: 's:series-a:2026-10-14',
					status: 'cancelled',
					startsAt: '2026-10-16T02:00:00.000Z',
					durationMinutes: 45,
					movedTo: null,
					movedFrom: '2026-10-14T11:00:00.000Z',
				},
			],
			thisWeek: [
				{
					key: movedKey,
					status: 'cancelled',
					startsAt: '2026-10-12T09:00:00.000Z',
					durationMinutes: 60,
					movedTo: null,
					movedFrom: '2026-10-21T11:00:00.000Z',
				},
			],
			nextWeek: [
				{
					key: movedKey,
					status: 'moved',
					startsAt: '2026-10-21T11:00:00.000Z',
					durationMinutes: 60,
					movedTo: '2026-10-12T09:00:00.000Z',
					movedFrom: null,
				},
			],
			next: [[STUDENT, '2026-10-21T11:00:00.000Z']],
			cutLessons: [],
		}
	)

	const movedOn = (originalOn, date, time) => ({
		seriesId: 'series-a',
		originalOn,
		kind: 'moved',
		startsAt: at(date, time),
		durationMinutes: 60,
	})
	const nextOf = (exceptions) => entries(core.nextLessons({ series: [weekly], exceptions, lessons: [], now: NOW }))
	expect(
		's15 nextLessons follows an occurrence moved to the future or into the past',
		{
			pastToTomorrow: nextOf([movedOn('2026-10-07', '2026-10-13', '10:00')]),
			nearestToYesterday: nextOf([movedOn('2026-10-14', '2026-10-11', '10:00')]),
		},
		{
			pastToTomorrow: [[STUDENT, '2026-10-13T03:00:00.000Z']],
			nearestToYesterday: [[STUDENT, '2026-10-21T11:00:00.000Z']],
		}
	)

	const tailIntoPast = [movedOn('2026-10-21', '2026-10-09', '10:00')]
	const intoPast = {
		studentId: STUDENT,
		startsAt: '2026-10-09T03:00:00.000Z',
		durationMinutes: 60,
		originalOn: '2026-10-21',
	}
	const tailCut = cut(weekly, tailIntoPast, { from: '2026-10-14', weekday: 4, startTime: '17:00' })
	const tailEnd = core.endSeriesAt(weekly, tailIntoPast, '2026-10-14', NOW)
	expect(
		's16 End series and a series cut turn a tail occurrence moved into the past into a lesson on its past place',
		{ cut: [tailCut.kind, tailCut.lessons], end: [tailEnd.kind, tailEnd.endsOn, tailEnd.lessons] },
		{ cut: ['ok', [intoPast]], end: ['ok', '2026-10-14', [intoPast]] }
	)

	return { results, expected }
}

function processZone(zone) {
	const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--child'], {
		env: { ...process.env, TZ: zone },
		encoding: 'utf8',
	})
	if (child.status !== 0) return null
	return JSON.parse(child.stdout.trim().split('\n').pop())
}

if (process.argv.includes('--child')) {
	console.log(JSON.stringify({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone, results: partTwo().results }))
	process.exit(0)
}

partOne()
if (failures > 0) process.exit(1)
console.log('CORE_PART1_OK')

const { results, expected } = partTwo()
for (const name of Object.keys(results)) {
	const got = JSON.stringify(results[name])
	const wanted = JSON.stringify(expected[name])
	check(name, got === wanted, `got ${got} wanted ${wanted}`)
}
const newYork = processZone('America/New_York')
const vietnam = processZone('Asia/Ho_Chi_Minh')
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
if (failures > 0) process.exit(1)
console.log('CORE_OK')
