import * as core from '../../../packages/core/src/index.ts'
import { VN, iso, NOW, STUDENT, at, rule, windowOf, weekly, cut, movedOn } from './occurrences.ts'
import type { Expect } from './run.ts'

function seriesCutVectors(expect: Expect): void {
	expect(
		's9 canChange is false at now and true one millisecond later',
		{ atNow: core.canChange(NOW, NOW), later: core.canChange(new Date(NOW.getTime() + 1), NOW) },
		{ atNow: false, later: true }
	)

	const kind = (result: core.CutSeriesResult) => result.kind
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
					timeZone: VN,
					studentId: STUDENT,
					weekday: 4,
					startTime: '17:00',
					durationMinutes: 60,
					startsOn: '2026-10-22',
					endsOn: null,
				},
				lessons: [
					{
						timeZone: VN,
						studentId: STUDENT,
						startsAt: '2026-10-30T05:00:00.000Z',
						durationMinutes: 50,
						originalOn: '2026-10-28',
					},
					{
						timeZone: VN,
						studentId: STUDENT,
						startsAt: '2026-11-04T11:00:00.000Z',
						durationMinutes: 60,
						originalOn: '2026-11-04',
						status: 'cancelled',
					},
				],
			},
			endsBefore: { kind: 'ends_before_new_day', endsOn: '2026-10-14' },
			beforeFirst: {
				kind: 'ok',
				oldEndsOn: '2026-10-27',
				newRule: {
					timeZone: VN,
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
				oldEndsOn: '2026-10-13',
				newRule: {
					timeZone: VN,
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
}

function seriesEndVectors(expect: Expect): void {
	const fresh = rule({ startsOn: '2026-10-14' })
	const beforeFirst = core.endSeriesAt(fresh, [], '2026-10-13', { now: NOW, defaultTimeZone: VN }) as Extract<
		core.EndSeriesResult,
		{ kind: 'ok' }
	>
	expect(
		's11 endSeriesAt checks and resulting ends_on',
		{
			yesterday: core.endSeriesAt(fresh, [], '2026-10-11', { now: NOW, defaultTimeZone: VN }),
			pastEnd: core.endSeriesAt(rule({ startsOn: '2026-10-14', endsOn: '2026-10-21' }), [], '2026-10-28', {
				now: NOW,
				defaultTimeZone: VN,
			}),
			alreadyEnded: core.endSeriesAt(rule({ endsOn: '2026-10-07' }), [], '2026-10-12', {
				now: NOW,
				defaultTimeZone: VN,
			}),
			beforeFirst,
			beforeFirstHas: core.hasOccurrences({ ...fresh, endsOn: beforeFirst.endsOn }),
			secondDate: core.endSeriesAt(fresh, [], '2026-10-21', { now: NOW, defaultTimeZone: VN }),
			afterSecond: core.endSeriesAt(fresh, [], '2026-10-23', { now: NOW, defaultTimeZone: VN }),
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
}

function preservedLessonVectors(expect: Expect): void {
	const endExceptions: core.SeriesException[] = [
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
	const endResult = core.endSeriesAt(weekly, endExceptions, '2026-10-14', { now: NOW, defaultTimeZone: VN }) as Extract<
		core.EndSeriesResult,
		{ kind: 'ok' }
	>
	const keptLessons = (endResult.lessons ?? []).map((lesson, index) => ({
		...lesson,
		id: `kept-${index + 1}`,
		status: 'scheduled' as const,
	}))
	const endedWeekly = { ...weekly, endsOn: endResult.endsOn }
	const thursday = (blocks: ReturnType<typeof windowOf>) =>
		blocks
			.filter((block) => iso(block.startsAt) === '2026-10-08T11:00:00.000Z')
			.map((block) => [block.key, block.status])
	expect(
		's14 End series keeps moved occurrences after the new end as lessons, past ones included',
		{
			result: endResult,
			bounded: core.endSeriesAt(rule({ endsOn: '2026-10-28' }), endExceptions, '2026-10-14', {
				now: NOW,
				defaultTimeZone: VN,
			}),
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
					{
						timeZone: VN,
						studentId: STUDENT,
						startsAt: '2026-10-08T11:00:00.000Z',
						durationMinutes: 60,
						originalOn: '2026-10-21',
					},
					{
						timeZone: VN,
						studentId: STUDENT,
						startsAt: '2026-10-06T03:00:00.000Z',
						durationMinutes: 60,
						originalOn: '2026-10-28',
						status: 'cancelled',
					},
					{
						timeZone: VN,
						studentId: STUDENT,
						startsAt: '2026-11-06T05:00:00.000Z',
						durationMinutes: 45,
						originalOn: '2026-11-04',
					},
				],
			},
			bounded: {
				kind: 'ok',
				endsOn: '2026-10-14',
				lessons: [
					{
						timeZone: VN,
						studentId: STUDENT,
						startsAt: '2026-10-08T11:00:00.000Z',
						durationMinutes: 60,
						originalOn: '2026-10-21',
					},
					{
						timeZone: VN,
						studentId: STUDENT,
						startsAt: '2026-10-06T03:00:00.000Z',
						durationMinutes: 60,
						originalOn: '2026-10-28',
						status: 'cancelled',
					},
				],
			},
			before: [['s:series-a:2026-10-21', 'scheduled']],
			after: [['l:kept-1', 'scheduled']],
			afterWeek: [
				['l:kept-2', 'cancelled'],
				['s:series-a:2026-10-07', 'scheduled'],
				['l:kept-1', 'scheduled'],
				['s:series-a:2026-10-14', 'scheduled'],
			],
		}
	)
}

function movedTailVectors(expect: Expect): void {
	const tailIntoPast = [movedOn('2026-10-21', '2026-10-09', '10:00')]
	const intoPast = {
		timeZone: VN,
		studentId: STUDENT,
		startsAt: '2026-10-09T03:00:00.000Z',
		durationMinutes: 60,
		originalOn: '2026-10-21',
	}
	const tailCut = cut(weekly, tailIntoPast, { from: '2026-10-14', weekday: 4, startTime: '17:00' })
	const tailEnd = core.endSeriesAt(weekly, tailIntoPast, '2026-10-14', { now: NOW, defaultTimeZone: VN }) as Extract<
		core.EndSeriesResult,
		{ kind: 'ok' }
	>
	expect(
		's16 End series and a series cut turn a tail occurrence moved into the past into a lesson on its past place',
		{ cut: [tailCut.kind, tailCut.lessons], end: [tailEnd.kind, tailEnd.endsOn, tailEnd.lessons] },
		{ cut: ['ok', [intoPast]], end: ['ok', '2026-10-14', [intoPast]] }
	)
}

export { seriesCutVectors, seriesEndVectors, preservedLessonVectors, movedTailVectors }
