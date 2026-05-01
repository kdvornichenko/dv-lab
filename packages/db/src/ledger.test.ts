import assert from 'node:assert/strict'

import { calculateStudentBalances } from './ledger'

const result = calculateStudentBalances(
	[
		{ studentId: 's1', amount: 30, billable: true },
		{ studentId: 's1', amount: 30, billable: true },
		{ studentId: 's2', amount: 40, billable: false },
	],
	[
		{ studentId: 's1', amount: 30 },
		{ studentId: 's2', amount: 20 },
	]
)

assert.deepEqual(result, [
	{
		studentId: 's1',
		currency: 'RUB',
		charged: 60,
		paid: 30,
		balance: -30,
		unpaidLessonCount: 2,
		overdue: true,
	},
	{
		studentId: 's2',
		currency: 'RUB',
		charged: 0,
		paid: 20,
		balance: 20,
		unpaidLessonCount: 0,
		overdue: false,
	},
])

const mixedCurrencyResult = calculateStudentBalances(
	[{ studentId: 's3', amount: 1000, currency: 'KZT', billable: true }],
	[{ studentId: 's3', amount: 1000, currency: 'RUB' }]
)

assert.deepEqual(mixedCurrencyResult, [
	{
		studentId: 's3',
		currency: 'KZT',
		charged: 1000,
		paid: 0,
		balance: -1000,
		unpaidLessonCount: 1,
		overdue: true,
	},
	{
		studentId: 's3',
		currency: 'RUB',
		charged: 0,
		paid: 1000,
		balance: 1000,
		unpaidLessonCount: 0,
		overdue: false,
	},
])

const overpaidResult = calculateStudentBalances(
	[
		{ studentId: 's4', amount: 50, billable: true },
		{ studentId: 's4', amount: 50, billable: false },
	],
	[{ studentId: 's4', amount: 75 }]
)

assert.deepEqual(overpaidResult, [
	{
		studentId: 's4',
		currency: 'RUB',
		charged: 50,
		paid: 75,
		balance: 25,
		unpaidLessonCount: 0,
		overdue: false,
	},
])

const reversalResult = calculateStudentBalances(
	[{ studentId: 's5', amount: 100, billable: true }],
	[
		{ studentId: 's5', amount: 100 },
		{ studentId: 's5', amount: -100 },
	]
)

assert.deepEqual(reversalResult, [
	{
		studentId: 's5',
		currency: 'RUB',
		charged: 100,
		paid: 0,
		balance: -100,
		unpaidLessonCount: 1,
		overdue: true,
	},
])

const durationUnitResult = calculateStudentBalances(
	[
		{ studentId: 's6', amount: 150, billable: true },
		{ studentId: 's6', amount: 75, billable: true },
	],
	[]
)

assert.deepEqual(durationUnitResult, [
	{
		studentId: 's6',
		currency: 'RUB',
		charged: 225,
		paid: 0,
		balance: -225,
		unpaidLessonCount: 2,
		overdue: true,
	},
])
