export type LedgerLessonCharge = {
	studentId: string
	amount: number
	billable: boolean
}

export type LedgerPayment = {
	studentId: string
	amount: number
}

export type LedgerBalance = {
	studentId: string
	charged: number
	paid: number
	balance: number
	unpaidLessonCount: number
	overdue: boolean
}

export function calculateStudentBalances(
	charges: ReadonlyArray<LedgerLessonCharge>,
	payments: ReadonlyArray<LedgerPayment>
): LedgerBalance[] {
	const byStudent = new Map<string, LedgerBalance>()

	function entry(studentId: string): LedgerBalance {
		const existing = byStudent.get(studentId)
		if (existing) return existing

		const created: LedgerBalance = {
			studentId,
			charged: 0,
			paid: 0,
			balance: 0,
			unpaidLessonCount: 0,
			overdue: false,
		}
		byStudent.set(studentId, created)
		return created
	}

	for (const charge of charges) {
		const current = entry(charge.studentId)
		if (!charge.billable) continue
		current.charged += charge.amount
		current.unpaidLessonCount += 1
	}

	for (const payment of payments) {
		entry(payment.studentId).paid += payment.amount
	}

	for (const current of byStudent.values()) {
		current.balance = current.paid - current.charged
		current.overdue = current.balance < 0
		if (!current.overdue) current.unpaidLessonCount = 0
	}

	return Array.from(byStudent.values()).sort((a, b) => a.studentId.localeCompare(b.studentId))
}
