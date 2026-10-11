import * as core from '../../../packages/core/src/index.ts'
import type { Expect } from './run.ts'

const VN = core.SCHEDULE_TIME_ZONE
const at = (date: string, time: string) => core.zonedInstant(date, time, VN)
const instant = (text: string) => new Date(text)

const DATE_CASES: [string, string][] = [
	['2026-10-10T16:59:59Z', '2026-10-10'],
	['2026-10-10T17:00:00Z', '2026-10-11'],
	['2026-12-31T17:30:00Z', '2027-01-01'],
	['2026-03-29T00:30:00Z', '2026-03-29'],
]

const NOW = at('2026-10-12', '15:00')
const LATER = new Date(NOW.getTime() + 1)
const iso = (value: Date | string | null | undefined) => (value instanceof Date ? value.toISOString() : value)

function dateVectors(expect: Expect): void {
	expect(
		'p1 scheduleDate gives the Vietnam date',
		DATE_CASES.map(([text]) => core.scheduleDate(instant(text), VN)),
		DATE_CASES.map(([, date]) => date)
	)
	const before = instant('2026-10-10T16:59:59Z')
	const after = instant('2026-10-10T17:00:00Z')
	expect(
		'p1 isAfterScheduleToday on both sides of Vietnam midnight',
		{
			todayBefore: core.isAfterScheduleToday('2026-10-10', before, VN),
			tomorrowBefore: core.isAfterScheduleToday('2026-10-11', before, VN),
			tomorrowAfter: core.isAfterScheduleToday('2026-10-11', after, VN),
			todayAfter: core.scheduleToday(after, VN),
		},
		{ todayBefore: false, tomorrowBefore: true, tomorrowAfter: false, todayAfter: '2026-10-11' }
	)
}

function outcomeVectors(expect: Expect): void {
	const marks: (core.MarkKind | null)[] = [null, 'none', 'done', 'no_show']
	expect(
		'p2 lessonOutcome for a grid block',
		Object.fromEntries(
			(['scheduled', 'cancelled', 'moved'] satisfies core.BlockStatus[]).map((status) => [
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
	const single = (status: core.SingleLesson['status']): core.SingleLesson => ({
		timeZone: VN,
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
	const outcomes: core.LessonOutcome[] = ['planned', 'done', 'no_show', 'cancelled', 'moved']
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
}

function actionVectors(expect: Expect): void {
	const actions = (outcome: core.LessonOutcome, startsAt: Date) => core.lessonActions(outcome, startsAt, NOW)
	const none = { move: false, cancel: false, restore: false, mark: false, series: false }
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
			plannedFuture: { move: true, cancel: true, restore: false, mark: false, series: true },
			plannedStarted: { move: true, cancel: true, restore: false, mark: true, series: false },
			doneStarted: { move: true, cancel: true, restore: false, mark: true, series: false },
			doneFuture: { move: true, cancel: true, restore: false, mark: true, series: true },
			noShowStarted: { move: true, cancel: true, restore: false, mark: true, series: false },
			cancelledPast: { move: false, cancel: false, restore: true, mark: false, series: false },
			cancelledFuture: { move: false, cancel: false, restore: true, mark: false, series: true },
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
	const lessonOn = (date: string, outcome: core.LessonOutcome = 'planned') => ({ outcome, startsAt: at(date, '09:00') })
	expect(
		'p2 needsMark skips archived students and lessons on or before the opening day',
		{
			activeAfterOpening: core.needsMark(lessonOn('2026-10-05'), active, NOW, VN),
			archived: core.needsMark(lessonOn('2026-10-05'), { status: 'archived', openingOn: OPEN }, NOW, VN),
			onOpeningDay: core.needsMark(lessonOn(OPEN), active, NOW, VN),
			noOpening: core.needsMark(lessonOn('2026-10-05'), { status: 'active', openingOn: null }, NOW, VN),
			notStarted: core.needsMark({ outcome: 'planned', startsAt: LATER }, active, NOW, VN),
			marked: core.needsMark(lessonOn('2026-10-05', 'done'), active, NOW, VN),
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
}

function occurrenceVectors(expect: Expect): void {
	const weekly: core.SeriesRule = {
		timeZone: VN,
		id: 'series-2101',
		studentId: 'student-2101',
		weekday: 3,
		startTime: '18:00',
		durationMinutes: 60,
		startsOn: '2026-10-07',
		endsOn: null,
	}
	const moved: core.SeriesException[] = [
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
	const withMark = (map: ReadonlyMap<string, core.MarkKind>) =>
		core.withOutcomes(blocks, map).map((block) => [block.key, block.status, iso(block.startsAt), block.outcome])
	expect(
		'p2 withOutcomes keeps the ghost moved and marks the lesson on its new place',
		{
			done: withMark(new Map([['s:series-2101:2026-10-14', 'done']])),
			unmarked: withMark(new Map<string, core.MarkKind>()),
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
}

function todayVectors(expect: Expect): void {
	const OPEN = '2026-10-01'
	const day = (key: string, time: string, outcome: core.LessonOutcome, studentStatus = 'active') => ({
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
			NOW,
			VN
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
		core.todayCounts({ lessons: [day('l:done', '09:00', 'done')], earlier: 0, paysSoon: 0 }, NOW, VN).nextKey,
		null
	)
}

export {
	VN,
	at,
	instant,
	DATE_CASES,
	NOW,
	LATER,
	dateVectors,
	outcomeVectors,
	actionVectors,
	occurrenceVectors,
	todayVectors,
}
