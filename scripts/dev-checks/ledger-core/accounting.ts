import * as core from '../../../packages/core/src/index.ts'
import { at, NOW, LATER } from './lessons.ts'
import type { Expect } from './run.ts'

function balanceVectors(expect: Expect): void {
	const OPEN = '2026-10-01'
	const card = (over: Partial<core.BalanceCard> = {}) => ({
		openingMinutes: 0,
		openingOn: OPEN,
		noShowDeducts: true,
		...over,
	})
	const pay = (paidOn: string, creditedMinutes: number) => ({ paidOn, creditedMinutes })
	const lesson = (date: string, time: string, durationMinutes: number, outcome: core.LessonOutcome) => ({
		startsAt: at(date, time),
		durationMinutes,
		outcome,
	})
	const balance = (
		over: Partial<core.BalanceCard>,
		payments: core.BalancePayment[] = [],
		lessons: core.BalanceLesson[] = []
	) => core.studentBalance(card(over), payments, lessons)
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
			done90Lessons: core.formatLessons(late as number, 60),
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
}

function deductionVectors(expect: Expect): void {
	const OPEN = '2026-10-01'
	const effect = (
		outcome: core.LessonOutcome,
		over: Partial<Omit<Parameters<typeof core.markEffect>[0], 'outcome' | 'card'>> & {
			card?: Partial<Parameters<typeof core.markEffect>[0]['card']>
		} = {}
	) =>
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
			futureDoneDeducts: effect('done', { startsAt: LATER }),
			futureNoShowOff: effect('no_show', { startsAt: LATER, card: { noShowDeducts: false } }),
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
			notStartedMarked: { kind: 'no_opening' },
			futureDoneDeducts: { kind: 'deducts', minutes: 60 },
			futureNoShowOff: { kind: 'no_show_off' },
			unmarked: { kind: 'unmarked' },
			noOpening: { kind: 'no_opening' },
			beforeOpening: { kind: 'before_opening', openingOn: OPEN },
			beforeOpeningNoShowOff: { kind: 'before_opening', openingOn: OPEN },
			noShowOff: { kind: 'no_show_off' },
			noShowDeducts: { kind: 'deducts', minutes: 60 },
			done90: { kind: 'deducts', minutes: 90 },
		}
	)
}

function paysSoonVectors(expect: Expect): void {
	const state = (minutes: number | null, threshold = 2) => core.balanceState(minutes, 60, threshold)
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
	const card = (displayName: string, status: string, balanceMinutes: number | null, defaultLessonMinutes = 60) => ({
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
}

export { balanceVectors, deductionVectors, paysSoonVectors }
