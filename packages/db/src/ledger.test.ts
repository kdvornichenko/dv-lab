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
		charged: 60,
		paid: 30,
		balance: -30,
		unpaidLessonCount: 2,
		overdue: true,
	},
	{
		studentId: 's2',
		charged: 0,
		paid: 20,
		balance: 20,
		unpaidLessonCount: 0,
		overdue: false,
	},
])
