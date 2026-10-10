import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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

const NOW = at('2026-10-12', '15:00')
const LATER = new Date(NOW.getTime() + 1)
const iso = (value) => (value instanceof Date ? value.toISOString() : value)

function partTwo() {
	const results = {}
	const expected = {}
	const expect = (name, value, wanted) => {
		results[name] = value
		expected[name] = wanted
	}

	const marks = [null, 'none', 'done', 'no_show']
	expect(
		'p2 lessonOutcome for a grid block',
		Object.fromEntries(
			['scheduled', 'cancelled', 'moved'].map((status) => [
				status,
				marks.map((mark) => core.lessonOutcome(status, mark)),
			])
		),
		{
			scheduled: ['planned', 'planned', 'done', 'no_show'],
			cancelled: ['cancelled', 'cancelled', 'cancelled', 'cancelled'],
			moved: ['moved', 'moved', 'moved', 'moved'],
		}
	)
	const single = (status) => ({
		id: 'lesson-2101',
		studentId: 'student-2101',
		startsAt: NOW,
		durationMinutes: 60,
		status,
	})
	expect(
		'p2 occurrenceOutcome treats a moved occurrence as the lesson itself',
		{
			movedDone: core.occurrenceOutcome({ status: 'moved' }, 'done'),
			movedUnmarked: core.occurrenceOutcome({ status: 'moved' }, null),
			movedNone: core.occurrenceOutcome({ status: 'moved' }, 'none'),
			cancelledDone: core.occurrenceOutcome({ status: 'cancelled' }, 'done'),
			singleCancelledDone: core.occurrenceOutcome(single('cancelled'), 'done'),
			singleNoShow: core.occurrenceOutcome(single('scheduled'), 'no_show'),
		},
		{
			movedDone: 'done',
			movedUnmarked: 'planned',
			movedNone: 'planned',
			cancelledDone: 'cancelled',
			singleCancelledDone: 'cancelled',
			singleNoShow: 'no_show',
		}
	)
	const outcomes = ['planned', 'done', 'no_show', 'cancelled', 'moved']
	expect(
		'p2 isMarked and countsAsLesson for five outcomes',
		outcomes.map((outcome) => [outcome, core.isMarked(outcome), core.countsAsLesson(outcome)]),
		[
			['planned', false, true],
			['done', true, true],
			['no_show', true, true],
			['cancelled', false, false],
			['moved', false, false],
		]
	)
	const actions = (outcome, startsAt) => core.lessonActions(outcome, startsAt, NOW)
	const none = { move: false, cancel: false, restore: false, mark: false }
	expect(
		'p2 lessonActions matrix at the start boundary',
		{
			plannedFuture: actions('planned', LATER),
			plannedStarted: actions('planned', NOW),
			doneStarted: actions('done', NOW),
			doneFuture: actions('done', LATER),
			noShowStarted: actions('no_show', NOW),
			cancelledPast: actions('cancelled', NOW),
			cancelledFuture: actions('cancelled', LATER),
			movedPast: actions('moved', NOW),
			movedFuture: actions('moved', LATER),
		},
		{
			plannedFuture: { move: true, cancel: true, restore: false, mark: false },
			plannedStarted: { move: false, cancel: true, restore: false, mark: true },
			doneStarted: { move: false, cancel: true, restore: false, mark: true },
			doneFuture: { move: false, cancel: true, restore: false, mark: false },
			noShowStarted: { move: false, cancel: true, restore: false, mark: true },
			cancelledPast: { move: false, cancel: false, restore: true, mark: false },
			cancelledFuture: { move: false, cancel: false, restore: true, mark: false },
			movedPast: none,
			movedFuture: none,
		}
	)
	expect(
		'p2 awaitsMark only for a started planned lesson',
		{
			plannedStarted: core.awaitsMark('planned', NOW, NOW),
			plannedFuture: core.awaitsMark('planned', LATER, NOW),
			doneStarted: core.awaitsMark('done', NOW, NOW),
			cancelledStarted: core.awaitsMark('cancelled', NOW, NOW),
			movedStarted: core.awaitsMark('moved', NOW, NOW),
		},
		{ plannedStarted: true, plannedFuture: false, doneStarted: false, cancelledStarted: false, movedStarted: false }
	)
	const OPEN = '2026-10-01'
	const active = { status: 'active', openingOn: OPEN }
	const lessonOn = (date, outcome = 'planned') => ({ outcome, startsAt: at(date, '09:00') })
	expect(
		'p2 needsMark skips archived students and lessons on or before the opening day',
		{
			activeAfterOpening: core.needsMark(lessonOn('2026-10-05'), active, NOW),
			archived: core.needsMark(lessonOn('2026-10-05'), { status: 'archived', openingOn: OPEN }, NOW),
			onOpeningDay: core.needsMark(lessonOn(OPEN), active, NOW),
			noOpening: core.needsMark(lessonOn('2026-10-05'), { status: 'active', openingOn: null }, NOW),
			notStarted: core.needsMark({ outcome: 'planned', startsAt: LATER }, active, NOW),
			marked: core.needsMark(lessonOn('2026-10-05', 'done'), active, NOW),
		},
		{
			activeAfterOpening: true,
			archived: false,
			onOpeningDay: false,
			noOpening: true,
			notStarted: false,
			marked: false,
		}
	)

	const weekly = {
		id: 'series-2101',
		studentId: 'student-2101',
		weekday: 3,
		startTime: '18:00',
		durationMinutes: 60,
		startsOn: '2026-10-07',
		endsOn: null,
	}
	const moved = [
		{
			seriesId: 'series-2101',
			originalOn: '2026-10-14',
			kind: 'moved',
			startsAt: at('2026-10-16', '09:00'),
			durationMinutes: 45,
		},
	]
	const blocks = core.scheduleWindow({
		series: [weekly],
		exceptions: moved,
		lessons: [],
		from: at('2026-10-12', '00:00'),
		to: at('2026-10-19', '00:00'),
	})
	const withMark = (map) =>
		core.withOutcomes(blocks, map).map((block) => [block.key, block.status, iso(block.startsAt), block.outcome])
	expect(
		'p2 withOutcomes keeps the ghost moved and marks the lesson on its new place',
		{
			done: withMark(new Map([['s:series-2101:2026-10-14', 'done']])),
			unmarked: withMark(new Map()),
		},
		{
			done: [
				['s:series-2101:2026-10-14', 'moved', '2026-10-14T11:00:00.000Z', 'moved'],
				['s:series-2101:2026-10-14', 'scheduled', '2026-10-16T02:00:00.000Z', 'done'],
			],
			unmarked: [
				['s:series-2101:2026-10-14', 'moved', '2026-10-14T11:00:00.000Z', 'moved'],
				['s:series-2101:2026-10-14', 'scheduled', '2026-10-16T02:00:00.000Z', 'planned'],
			],
		}
	)

	const effect = (outcome, over = {}) =>
		core.markEffect({
			outcome,
			startsAt: at('2026-10-05', '09:00'),
			durationMinutes: 60,
			now: NOW,
			...over,
			card: { openingOn: OPEN, noShowDeducts: true, ...over.card },
		})
	expect(
		'p2 markEffect in the order of LessonMark captions',
		{
			cancelledWithDone: effect(core.occurrenceOutcome({ status: 'cancelled' }, 'done')),
			cancelledNotStarted: effect('cancelled', { startsAt: LATER }),
			moved: effect('moved', { startsAt: LATER }),
			notStarted: effect('planned', { startsAt: LATER }),
			notStartedMarked: effect('done', { startsAt: LATER, card: { openingOn: null } }),
			unmarked: effect('planned', { card: { openingOn: null } }),
			noOpening: effect('no_show', { card: { openingOn: null, noShowDeducts: false } }),
			beforeOpening: effect('done', { startsAt: at(OPEN, '23:30') }),
			beforeOpeningNoShowOff: effect('no_show', { startsAt: at(OPEN, '09:00'), card: { noShowDeducts: false } }),
			noShowOff: effect('no_show', { card: { noShowDeducts: false } }),
			noShowDeducts: effect('no_show'),
			done90: effect('done', { durationMinutes: 90 }),
		},
		{
			cancelledWithDone: { kind: 'cancelled' },
			cancelledNotStarted: { kind: 'cancelled' },
			moved: { kind: 'moved' },
			notStarted: { kind: 'not_started' },
			notStartedMarked: { kind: 'not_started' },
			unmarked: { kind: 'unmarked' },
			noOpening: { kind: 'no_opening' },
			beforeOpening: { kind: 'before_opening', openingOn: OPEN },
			beforeOpeningNoShowOff: { kind: 'before_opening', openingOn: OPEN },
			noShowOff: { kind: 'no_show_off' },
			noShowDeducts: { kind: 'deducts', minutes: 60 },
			done90: { kind: 'deducts', minutes: 90 },
		}
	)

	const day = (key, time, outcome, studentStatus = 'active') => ({
		key,
		startsAt: at('2026-10-12', time),
		outcome,
		studentStatus,
		openingOn: OPEN,
	})
	expect(
		'p2 todayCounts on a day of five lessons, a ghost and an archived student',
		core.todayCounts(
			{
				lessons: [
					day('l:future', '18:00', 'planned'),
					day('l:started', '10:00', 'planned'),
					day('l:done', '09:00', 'done'),
					day('l:no-show', '11:00', 'no_show'),
					day('l:cancelled', '16:00', 'cancelled'),
					day('l:ghost', '17:00', 'moved'),
					day('l:archived', '08:00', 'planned', 'archived'),
				],
				earlier: 2,
				paysSoon: 1,
			},
			NOW
		),
		{
			lessons: 5,
			toCome: 1,
			started: 4,
			done: 1,
			toMark: 3,
			toMarkToday: 1,
			toMarkEarlier: 2,
			paysSoon: 1,
			nextKey: 'l:future',
		}
	)
	expect(
		'p2 todayCounts with no lesson ahead',
		core.todayCounts({ lessons: [day('l:done', '09:00', 'done')], earlier: 0, paysSoon: 0 }, NOW).nextKey,
		null
	)

	const state = (minutes, threshold = 2) => core.balanceState(minutes, 60, threshold)
	expect(
		'p2 balanceState at the threshold boundaries',
		{
			m121: state(121),
			m120: state(120),
			m1: state(1),
			m0: state(0),
			mMinus1: state(-1),
			notSet: state(null),
			zeroThreshold1: state(1, 0),
			zeroThreshold0: state(0, 0),
			paysSoonNull: core.paysSoon(null, 60, 2),
			paysSoonOwes: core.paysSoon(-1, 60, 0),
			defaultThreshold: core.PAYS_SOON_LESSONS_DEFAULT,
		},
		{
			m121: 'plenty',
			m120: 'pays_soon',
			m1: 'pays_soon',
			m0: 'none_left',
			mMinus1: 'owes',
			notSet: 'not_set',
			zeroThreshold1: 'plenty',
			zeroThreshold0: 'none_left',
			paysSoonNull: false,
			paysSoonOwes: true,
			defaultThreshold: 2,
		}
	)
	const card = (displayName, status, balanceMinutes, defaultLessonMinutes = 60) => ({
		displayName,
		status,
		balanceMinutes,
		defaultLessonMinutes,
	})
	expect(
		'p2 paysSoonList keeps active students with a set balance, debt first, then by name',
		core
			.paysSoonList(
				[
					card('Alex Example 2103', 'active', 60),
					card('Alex Example 2102', 'active', -90),
					card('Alex Example 2101', 'active', 60),
					card('Alex Example 2104', 'archived', 0),
					card('Alex Example 2105', 'active', null),
					card('Alex Example 2106', 'active', 300),
					card('Alex Example 2107', 'active', 0, 45),
				],
				2
			)
			.map((item) => item.displayName),
		['Alex Example 2102', 'Alex Example 2107', 'Alex Example 2101', 'Alex Example 2103']
	)
	expect(
		'p2 balancePhrase without a minus sign',
		[
			core.balancePhrase(60, 60),
			core.balancePhrase(0, 60),
			core.balancePhrase(90, 60),
			core.balancePhrase(30, 60),
			core.balancePhrase(-60, 60),
			core.balancePhrase(-90, 60),
		],
		['1 lesson left', '0 lessons left', '1.5 lessons left', '0.5 lessons left', 'owes 1 lesson', 'owes 1.5 lessons']
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

const allResults = () => ({ one: scenarios().results, two: partTwo().results })

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
	console.log(JSON.stringify({ zone: Intl.DateTimeFormat().resolvedOptions().timeZone, results: allResults() }))
	process.exit(0)
}

report(scenarios())
datesMatchSql()
devBalancesMatch()
if (failures > 0) process.exit(1)
console.log('LEDGER_CORE_PART1_OK')

report(partTwo())
const own = JSON.stringify(allResults())
const newYork = processZone('America/New_York')
const vietnam = processZone('Asia/Ho_Chi_Minh')
check(
	'p2 results do not depend on the process zone',
	newYork !== null &&
		vietnam !== null &&
		newYork.zone !== vietnam.zone &&
		JSON.stringify(newYork.results) === own &&
		JSON.stringify(vietnam.results) === own,
	`zones ${newYork?.zone} ${vietnam?.zone}`
)
if (failures > 0) process.exit(1)
console.log('LEDGER_CORE_OK')
