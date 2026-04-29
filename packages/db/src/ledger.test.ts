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
