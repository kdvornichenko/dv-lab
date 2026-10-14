import * as core from '../../../packages/core/src/index.ts'
import { VN, at, NOW, LATER } from './lessons.ts'
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
	) => core.studentBalance(card(over), payments, lessons, VN)
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
			vietnam: core.scheduleDate(nightLesson, VN),
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
			timeZone: VN,
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

function ledgerVectors(expect: Expect): void {
	const OPEN = '2026-10-01'
	const card = (over: Partial<core.BalanceCard> = {}): core.BalanceCard => ({
		openingMinutes: 0,
		openingOn: OPEN,
		noShowDeducts: true,
		...over,
	})
	const pay = (id: string, paidOn: string, creditedMinutes: number, time = '12:00'): core.LedgerPayment => ({
		id,
		paidOn,
		creditedMinutes,
		createdAt: at(paidOn, time),
	})
	const lesson = (
		key: string,
		date: string,
		durationMinutes: number,
		outcome: core.LessonOutcome,
		time = '18:00'
	): core.LedgerLesson => ({ key, startsAt: at(date, time), durationMinutes, outcome })
	const row = (entry: core.LedgerEntry) => [
		entry.key,
		entry.date,
		entry.counted,
		entry.deductedMinutes,
		entry.balanceAfterMinutes,
		entry.coveringPaymentId,
		entry.paidAfter,
		entry.held,
		entry.sinceLastPayment,
	]
	const ledger = (over: Partial<core.BalanceCard>, payments: core.LedgerPayment[], lessons: core.LedgerLesson[]) => {
		const result = core.studentLedger(card(over), payments, lessons, VN)
		return {
			same: result.balanceMinutes === core.studentBalance(card(over), payments, lessons, VN),
			balance: result.balanceMinutes,
			last: result.lastPayment,
			from: result.sinceLastPaymentFrom,
			before: result.balanceBeforeLastPayment,
			entries: result.entries.map(row),
		}
	}

	expect(
		'p2 ledger 1 no debt before the last payment starts the period on the payment day',
		ledger(
			{ openingMinutes: 120 },
			[pay('pay-1', '2026-10-05', 120)],
			[
				lesson('l-3', '2026-10-07', 60, 'done'),
				lesson('l-2', '2026-10-05', 60, 'done'),
				lesson('l-1', '2026-10-03', 60, 'done'),
			]
		),
		{
			same: true,
			balance: 60,
			last: { id: 'pay-1', paidOn: '2026-10-05', creditedMinutes: 120 },
			from: '2026-10-05',
			before: 60,
			entries: [
				['l-1', '2026-10-03', true, 60, 60, null, false, true, false],
				['l-2', '2026-10-05', true, 60, 120, null, false, true, true],
				['l-3', '2026-10-07', true, 60, 60, 'pay-1', false, true, true],
			],
		}
	)

	expect(
		'p2 ledger 2 debt before the last payment starts the period at the first debt lesson',
		{
			debt: ledger(
				{ openingMinutes: 60 },
				[pay('pay-1', '2026-10-08', 180)],
				[
					lesson('l-1', '2026-10-02', 60, 'done'),
					lesson('l-2', '2026-10-04', 60, 'done'),
					lesson('l-c', '2026-10-05', 60, 'cancelled'),
					lesson('l-3', '2026-10-06', 60, 'no_show'),
					lesson('l-4', '2026-10-09', 60, 'done'),
				]
			),
			openingDebt: ledger(
				{ openingMinutes: -60 },
				[pay('pay-1', '2026-10-03', 120)],
				[lesson('l-1', '2026-10-04', 60, 'done')]
			),
		},
		{
			debt: {
				same: true,
				balance: 0,
				last: { id: 'pay-1', paidOn: '2026-10-08', creditedMinutes: 180 },
				from: '2026-10-04',
				before: -120,
				entries: [
					['l-1', '2026-10-02', true, 60, 0, null, false, true, false],
					['l-2', '2026-10-04', true, 60, -60, 'pay-1', true, true, true],
					['l-c', '2026-10-05', false, 0, null, null, false, false, true],
					['l-3', '2026-10-06', true, 60, -120, 'pay-1', true, true, true],
					['l-4', '2026-10-09', true, 60, 0, 'pay-1', false, true, true],
				],
			},
			openingDebt: {
				same: true,
				balance: 0,
				last: { id: 'pay-1', paidOn: '2026-10-03', creditedMinutes: 120 },
				from: '2026-10-03',
				before: -60,
				entries: [['l-1', '2026-10-04', true, 60, 0, 'pay-1', false, true, true]],
			},
		}
	)

	expect(
		'p2 ledger 3 a lesson split between two payments is covered by the one that closes its last minute',
		ledger(
			{},
			[
				pay('pay-c', '2026-10-06', 30),
				pay('pay-a', '2026-10-02', 60, '10:00'),
				pay('pay-b', '2026-10-02', 30, '09:00'),
			],
			[lesson('l-1', '2026-10-03', 60, 'done'), lesson('l-2', '2026-10-04', 60, 'done')]
		),
		{
			same: true,
			balance: 0,
			last: { id: 'pay-c', paidOn: '2026-10-06', creditedMinutes: 30 },
			from: '2026-10-04',
			before: -30,
			entries: [
				['l-1', '2026-10-03', true, 60, 30, 'pay-a', false, true, false],
				['l-2', '2026-10-04', true, 60, -30, 'pay-c', true, true, true],
			],
		}
	)

	const noShows = [lesson('l-1', '2026-10-02', 60, 'no_show'), lesson('l-2', '2026-10-03', 60, 'done')]
	expect(
		'p2 ledger 4 a no-show without noShowDeducts is not held and deducts nothing',
		{
			off: ledger({ openingMinutes: 60, noShowDeducts: false }, [], noShows),
			on: ledger({ openingMinutes: 60 }, [], noShows),
		},
		{
			off: {
				same: true,
				balance: 0,
				last: null,
				from: null,
				before: null,
				entries: [
					['l-1', '2026-10-02', true, 0, 60, null, false, false, false],
					['l-2', '2026-10-03', true, 60, 0, null, false, true, false],
				],
			},
			on: {
				same: true,
				balance: -60,
				last: null,
				from: null,
				before: null,
				entries: [
					['l-1', '2026-10-02', true, 60, 0, null, false, true, false],
					['l-2', '2026-10-03', true, 60, -60, null, false, true, false],
				],
			},
		}
	)

	expect(
		'p2 ledger 5 cancelled and moved lessons are not counted and have no balance after',
		ledger(
			{ openingMinutes: 60 },
			[],
			[
				lesson('l-1', '2026-10-02', 60, 'cancelled'),
				lesson('l-2', '2026-10-03', 60, 'moved'),
				lesson('l-3', '2026-10-04', 60, 'done'),
				lesson('l-4', '2026-10-05', 60, 'planned'),
			]
		),
		{
			same: true,
			balance: 0,
			last: null,
			from: null,
			before: null,
			entries: [
				['l-1', '2026-10-02', false, 0, null, null, false, false, false],
				['l-2', '2026-10-03', false, 0, null, null, false, false, false],
				['l-3', '2026-10-04', true, 60, 0, null, false, true, false],
				['l-4', '2026-10-05', true, 0, 0, null, false, false, false],
			],
		}
	)

	const unopened = [lesson('l-1', '2026-10-06', 60, 'done')]
	const nothing = {
		same: true,
		balance: null,
		last: null,
		from: null,
		before: null,
		entries: [['l-1', '2026-10-06', false, 0, null, null, false, false, false]],
	}
	expect(
		'p2 ledger 6 without an opening everything is null',
		{
			none: ledger({ openingMinutes: null, openingOn: null }, [pay('pay-1', '2026-10-05', 60)], unopened),
			minutesOnly: ledger({ openingMinutes: 60, openingOn: null }, [pay('pay-1', '2026-10-05', 60)], unopened),
		},
		{ none: nothing, minutesOnly: nothing }
	)

	expect(
		'p2 ledger 7 a payment with no credited minutes is not the last payment',
		ledger(
			{},
			[pay('pay-1', '2026-10-02', 120), pay('pay-0', '2026-10-05', 0)],
			[lesson('l-1', '2026-10-03', 60, 'done')]
		),
		{
			same: true,
			balance: 60,
			last: { id: 'pay-1', paidOn: '2026-10-02', creditedMinutes: 120 },
			from: '2026-10-02',
			before: 0,
			entries: [['l-1', '2026-10-03', true, 60, 60, 'pay-1', false, true, true]],
		}
	)

	expect(
		'p2 ledger 8 payments on or before the opening day are not counted',
		ledger(
			{ openingMinutes: 60 },
			[pay('pay-open', OPEN, 120), pay('pay-early', '2026-09-20', 60)],
			[lesson('l-0', OPEN, 60, 'done'), lesson('l-1', '2026-10-02', 60, 'done')]
		),
		{
			same: true,
			balance: 0,
			last: null,
			from: null,
			before: null,
			entries: [
				['l-0', OPEN, false, 0, null, null, false, false, false],
				['l-1', '2026-10-02', true, 60, 0, null, false, true, false],
			],
		}
	)

	const factory: [string, Partial<core.BalanceCard>, core.LedgerPayment[], core.LedgerLesson[]][] = [
		['noOpening', { openingMinutes: null, openingOn: null }, [pay('p-1', '2026-10-05', 60)], []],
		['zeroOpening', {}, [], []],
		['paidOnOpening', { openingMinutes: 120 }, [pay('p-1', OPEN, 60)], []],
		['paidNextDay', { openingMinutes: 120 }, [pay('p-1', '2026-10-02', 60)], []],
		['done60', {}, [], [lesson('l-1', '2026-10-02', 60, 'done')]],
		['done90', {}, [], [lesson('l-1', '2026-10-02', 90, 'done')]],
		['noShowOn', {}, [], [lesson('l-1', '2026-10-02', 60, 'no_show')]],
		['noShowOff', { noShowDeducts: false }, [], [lesson('l-1', '2026-10-02', 60, 'no_show')]],
		['cancelled', {}, [], [lesson('l-1', '2026-10-02', 60, 'cancelled')]],
		['moved', {}, [], [lesson('l-1', '2026-10-02', 60, 'moved')]],
		['planned', {}, [], [lesson('l-1', '2026-10-02', 60, 'planned')]],
		['vnAfterMidnight', {}, [], [lesson('l-1', '2026-10-02', 60, 'done', '00:30')]],
		['vnLateOnOpening', {}, [], [lesson('l-1', OPEN, 60, 'done', '23:30')]],
		[
			'mixed',
			{ openingMinutes: 120 },
			[pay('p-1', OPEN, 600), pay('p-2', '2026-10-03', 60)],
			[lesson('l-1', OPEN, 60, 'done'), lesson('l-2', '2026-10-04', 60, 'done')],
		],
	]
	let seed = 2101
	const next = (size: number) => {
		seed = (seed * 48271) % 2147483647
		return Math.floor((seed / 2147483647) * size)
	}
	const pick = <T>(items: readonly T[]): T => items[next(items.length)] as T
	const day = (offset: number) => core.addDays('2026-09-28', offset)
	const outcomes: core.LessonOutcome[] = ['done', 'done', 'done', 'no_show', 'cancelled', 'moved', 'planned']
	for (let series = 0; series < 60; series += 1) {
		const payments: core.LedgerPayment[] = []
		const lessons: core.LedgerLesson[] = []
		for (let index = 0; index < 40; index += 1) {
			const date = day(next(90))
			if (next(4) === 0) {
				const time = `${String(8 + next(12)).padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`
				payments.push(pay(`p-${series}-${index}`, date, pick([0, 30, 45, 60, 90, 240, 600, -30]), time))
			} else {
				const time = `${String(next(24)).padStart(2, '0')}:${pick(['00', '30'])}`
				lessons.push(lesson(`l-${series}-${index}`, date, pick([30, 45, 60, 75, 90]), pick(outcomes), time))
			}
		}
		const opening = pick<Partial<core.BalanceCard>>([
			{ openingMinutes: 0 },
			{ openingMinutes: 90 },
			{ openingMinutes: -120 },
			{ openingMinutes: 600 },
			{ openingMinutes: null, openingOn: null },
		])
		factory.push([`series-${series}`, { ...opening, noShowDeducts: next(2) === 0 }, payments, lessons])
	}
	const mismatched: string[] = []
	const chain: string[] = []
	const fifo: string[] = []
	const boundary: string[] = []
	let checked = 0
	let paidAfter = 0
	for (const [name, over, payments, lessons] of factory) {
		const own = card(over)
		const result = core.studentLedger(own, payments, lessons, VN)
		if (result.balanceMinutes !== core.studentBalance(own, payments, lessons, VN)) mismatched.push(name)
		if (own.openingMinutes === null || own.openingOn === null) continue
		const openingOn = own.openingOn
		if (result.lastPayment !== null && result.balanceBeforeLastPayment !== null) {
			const first = result.entries.find((entry) => entry.sinceLastPayment)
			const debtStart = first !== undefined && first.held && first.date === result.sinceLastPaymentFrom
			const ok =
				result.balanceBeforeLastPayment >= 0
					? result.sinceLastPaymentFrom === result.lastPayment.paidOn
					: debtStart || result.sinceLastPaymentFrom === result.lastPayment.paidOn
			if (!ok) boundary.push(name)
		}
		for (const entry of result.entries) {
			if (!entry.counted) continue
			checked += 1
			if (entry.paidAfter) paidAfter += 1
			const source = lessons.find((item) => item.key === entry.key) as core.LedgerLesson
			const credited = payments
				.filter((item) => item.paidOn > openingOn && item.paidOn <= entry.date)
				.reduce((sum, item) => sum + item.creditedMinutes, 0)
			const deducted = lessons
				.filter((item) => {
					const date = core.scheduleDate(item.startsAt, VN)
					if (date !== entry.date) return date < entry.date
					const time = item.startsAt.getTime() - source.startsAt.getTime()
					return time < 0 || (time === 0 && item.key <= entry.key)
				})
				.reduce((sum, item) => sum + core.lessonDeduction(item, own, VN), 0)
			if (entry.balanceAfterMinutes !== own.openingMinutes + credited - deducted) chain.push(`${name} ${entry.key}`)
			if (entry.held && !entry.paidAfter && entry.coveringPaymentId !== null && (entry.balanceAfterMinutes ?? 0) < 0)
				fifo.push(`${name} ${entry.key}`)
		}
	}
	expect(
		'p2 ledger 9 the pass total equals studentBalance on every factory vector and on series of mixed lengths',
		{ cases: factory.length, mismatched, chain, fifo, boundary, enough: checked > 500 && paidAfter > 50 },
		{ cases: 74, mismatched: [], chain: [], fifo: [], boundary: [], enough: true }
	)
}

export { balanceVectors, deductionVectors, paysSoonVectors, ledgerVectors }
