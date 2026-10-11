import * as core from '../../../packages/core/src/index.ts'
import type { Expect } from './run.ts'

const VN = core.SCHEDULE_TIME_ZONE
const iso = (value: Date | string | null | undefined) => (value instanceof Date ? value.toISOString() : value)

const NOW = new Date('2026-10-12T03:00:00.000Z')
const STUDENT = 'student-alex-0001'
const at = (date: string, time: string) => core.zonedInstant(date, time, VN)
const week = (monday: string) => ({ from: at(monday, '00:00'), to: at(core.addDays(monday, 7), '00:00') })
const rule = (over: Partial<core.SeriesRule> = {}): core.SeriesRule => ({
	timeZone: VN,
	id: 'series-a',
	studentId: STUDENT,
	weekday: 3,
	startTime: '18:00',
	durationMinutes: 60,
	startsOn: '2026-10-07',
	endsOn: null,
	...over,
})
const view = (blocks: core.ScheduleBlock[]) =>
	blocks.map((block) => ({
		key: block.key,
		status: block.status,
		startsAt: block.startsAt,
		durationMinutes: block.durationMinutes,
		movedTo: block.movedTo,
		movedFrom: block.movedFrom,
	}))
const entries = (map: ReadonlyMap<string, Date>) => [...map].map(([key, value]) => [key, value.toISOString()]).sort()
const windowOf = (
	series: core.SeriesRule[],
	exceptions: core.SeriesException[],
	lessons: core.SingleLesson[],
	monday: string
) => view(core.scheduleWindow({ series, exceptions, lessons, ...week(monday) }))

const empty = rule({ startsOn: '2026-10-14', endsOn: '2026-10-13' })

const weekly = rule()
const insideWeek: core.SeriesException[] = [
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

const movedKey = 's:series-a:2026-10-21'
const cut = (
	series: core.SeriesRule,
	exceptions: core.SeriesException[],
	change: core.SeriesChange,
	now = NOW
): core.CutSeriesResult & { lessons?: core.CutLesson[] } =>
	core.cutSeries(series, exceptions, change, { now, defaultTimeZone: VN })
const movedOn = (originalOn: string, date: string, time: string): core.SeriesException => ({
	seriesId: 'series-a',
	originalOn,
	kind: 'moved',
	startsAt: at(date, time),
	durationMinutes: 60,
})

function emptySeriesVectors(expect: Expect): void {
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
}

function occurrenceVectors(expect: Expect): void {
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

	const crossWeek: core.SeriesException[] = [
		{
			seriesId: 'series-a',
			originalOn: '2026-10-21',
			kind: 'moved',
			startsAt: at('2026-10-12', '16:00'),
			durationMinutes: 60,
		},
	]

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
	const history: core.SeriesException[] = [
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
}

function overlapVectors(expect: Expect): void {
	const base = at('2026-10-14', '18:00')
	const item = (key: string, outcome: core.LessonOutcome, startsAt: Date, durationMinutes = 60) => ({
		key,
		outcome,
		startsAt,
		durationMinutes,
	})
	const items = [
		item('k1', 'planned', base),
		item('k2', 'cancelled', base),
		item('k3', 'moved', base),
		item('k4', 'planned', at('2026-10-14', '19:00')),
		item('k5', 'planned', at('2026-10-14', '17:00')),
		item('k6', 'done', base),
		item('k7', 'no_show', at('2026-10-14', '18:30')),
	]
	const insideItems = insideBlocks.map((block) => ({
		key: block.key,
		startsAt: block.startsAt,
		durationMinutes: block.durationMinutes,
		outcome: core.lessonOutcome(block.status, null),
	}))
	const candidate = { startsAt: base, durationMinutes: 60 }
	expect(
		's7 overlaps follow the outcome: planned, done and no_show occupy the slot, cancelled and moved do not, touching ends do not overlap, excludeKey works',
		{
			all: core.overlaps(items, candidate).map((found) => found.key),
			excluded: core.overlaps(items, candidate, 'k1').map((found) => found.key),
			ghost: core.overlaps(insideItems, { startsAt: base, durationMinutes: 60 }).map((found) => found.outcome),
			destination: core
				.overlaps(insideItems, { startsAt: at('2026-10-16', '09:30'), durationMinutes: 30 })
				.map((found) => found.outcome),
		},
		{ all: ['k1', 'k6', 'k7'], excluded: ['k6', 'k7'], ghost: [], destination: ['planned'] }
	)
}

function cancelledMoveVectors(expect: Expect): void {
	const cancelledMoved: core.SeriesException[] = [
		{
			seriesId: 'series-a',
			originalOn: '2026-10-14',
			kind: 'cancelled',
			startsAt: at('2026-10-16', '09:00'),
			durationMinutes: 45,
		},
	]
	const cancelledAcross: core.SeriesException[] = [
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
			cutLessons: [
				{
					studentId: STUDENT,
					startsAt: '2026-10-16T02:00:00.000Z',
					timeZone: VN,
					durationMinutes: 45,
					originalOn: '2026-10-14',
					status: 'cancelled',
				},
			],
		}
	)
}

function nextLessonVectors(expect: Expect): void {
	const mondayRule = rule({ weekday: 1, startTime: '09:00', startsOn: '2026-10-05' })
	const nextSeries = [
		rule({ id: 'series-a', studentId: 'student-a' }),
		{ ...mondayRule, id: 'series-b', studentId: 'student-b' },
		{ ...mondayRule, id: 'series-c', studentId: 'student-c' },
		rule({ id: 'series-d', studentId: 'student-d', weekday: 4, startsOn: '2026-09-03', endsOn: '2026-10-08' }),
	]
	const nextExceptions: core.SeriesException[] = [
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
	const nextSingles: core.SingleLesson[] = [
		{
			timeZone: VN,
			id: 'lesson-a1',
			studentId: 'student-a',
			startsAt: at('2026-10-13', '12:00'),
			durationMinutes: 60,
			status: 'scheduled',
		},
		{
			timeZone: VN,
			id: 'lesson-a2',
			studentId: 'student-a',
			startsAt: at('2026-10-12', '11:00'),
			durationMinutes: 60,
			status: 'cancelled',
		},
		{
			timeZone: VN,
			id: 'lesson-e1',
			studentId: 'student-e',
			startsAt: at('2026-10-13', '11:00'),
			durationMinutes: 60,
			status: 'cancelled',
		},
		{
			timeZone: VN,
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
}

function seriesDateVectors(expect: Expect): void {
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
}

function movedNextVectors(expect: Expect): void {
	const nextOf = (exceptions: core.SeriesException[]) =>
		entries(core.nextLessons({ series: [weekly], exceptions, lessons: [], now: NOW }))
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
}
export {
	VN,
	iso,
	NOW,
	STUDENT,
	at,
	rule,
	windowOf,
	weekly,
	cut,
	movedOn,
	emptySeriesVectors,
	occurrenceVectors,
	overlapVectors,
	cancelledMoveVectors,
	nextLessonVectors,
	seriesDateVectors,
	movedNextVectors,
}
