export type LedgerLessonCharge = {
	studentId: string
	amount: number
	billable: boolean
	currency?: string
}

export type LedgerPayment = {
	studentId: string
	amount: number
	currency?: string
}

export type LedgerBalance = {
	studentId: string
	currency: string
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
	const byStudentCurrency = new Map<string, LedgerBalance>()

	function entry(studentId: string, currency = 'RUB'): LedgerBalance {
		const key = `${studentId}:${currency}`
		const existing = byStudentCurrency.get(key)
		if (existing) return existing

		const created: LedgerBalance = {
			studentId,
			currency,
			charged: 0,
			paid: 0,
			balance: 0,
			unpaidLessonCount: 0,
			overdue: false,
		}
		byStudentCurrency.set(key, created)
		return created
	}

	for (const charge of charges) {
		const current = entry(charge.studentId, charge.currency)
		if (!charge.billable) continue
		current.charged += charge.amount
		current.unpaidLessonCount += 1
	}

	for (const payment of payments) {
		entry(payment.studentId, payment.currency).paid += payment.amount
	}

	for (const current of byStudentCurrency.values()) {
		current.balance = current.paid - current.charged
		current.overdue = current.balance < 0
		if (!current.overdue) current.unpaidLessonCount = 0
	}

	return Array.from(byStudentCurrency.values()).sort(
		(a, b) => a.studentId.localeCompare(b.studentId) || a.currency.localeCompare(b.currency)
	)
}
