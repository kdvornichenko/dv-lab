import { formatCurrencyAmount } from '@/lib/crm/model'

import type {
	Currency,
	Payment,
	PaymentMethod,
	Student,
	StudentBalance,
	StudentCurrencyBalance,
} from '@teacher-crm/api-types'

export type PaymentStatus = 'recorded'
export type SortMode = 'date_desc' | 'date_asc' | 'student_asc' | 'student_desc' | 'amount_desc'
export type CurrencyFilter = 'all' | Currency
export type PaymentDateRange = {
	from?: Date
	to?: Date
}

export type PaymentRow = {
	payment: Payment
	student?: Student
	balance?: StudentCurrencyBalance
	currency: Currency
	studentName: string
	issued: Date
	monthKey: string
	monthLabel: string
	status: PaymentStatus
}

export type PaymentMonthGroup = {
	key: string
	label: string
	rows: PaymentRow[]
	totals: Record<Currency, number>
}

export const ALL_CURRENCIES = 'all'

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; className: string; dot: string }> = {
	recorded: {
		label: 'Recorded',
		className: 'border-success-line bg-success-soft text-success',
		dot: 'bg-success',
	},
}

export function paymentNumber(payment: Payment) {
	return `PAY-${payment.id.slice(-6).toUpperCase()}`
}

export function formatPaymentDate(value: string | Date) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: '2-digit',
	}).format(new Date(value))
}

export function formatPaymentMonth(value: string | Date) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		year: 'numeric',
	}).format(new Date(value))
}

export function formatPaymentDateRange(range: PaymentDateRange) {
	if (!range.from) return 'Date range'
	if (!range.to) return formatPaymentDate(range.from)
	return `${formatPaymentDate(range.from)} - ${formatPaymentDate(range.to)}`
}

export function paymentMethodLabel(value: PaymentMethod) {
	return value.replace('_', ' ')
}

export function paymentRows(payments: Payment[], students: Student[], balances: StudentBalance[]) {
	const studentsById = new Map(students.map((student) => [student.id, student]))
	const balanceKey = (studentId: string, currency: Currency) => `${studentId}:${currency}`
	const balancesByStudentCurrency = new Map(
		balances.flatMap((balance) => [
			[balanceKey(balance.studentId, balance.currency), balance] as const,
			...(balance.otherCurrencyBalances ?? []).map(
				(item) => [balanceKey(item.studentId, item.currency), item] as const
			),
		])
	)

	return payments.map((payment): PaymentRow => {
		const student = studentsById.get(payment.studentId)
		const balance = balancesByStudentCurrency.get(balanceKey(payment.studentId, payment.currency))
		const issued = new Date(payment.paidAt)
		return {
			payment,
			student,
			balance,
			currency: payment.currency,
			studentName: student?.fullName ?? 'Unknown student',
			issued,
			monthKey: monthKey(issued),
			monthLabel: formatPaymentMonth(issued),
			status: 'recorded',
		}
	})
}

export function currencyTotals(rows: PaymentRow[]) {
	return rows.reduce(
		(acc, row) => {
			acc[row.currency] = (acc[row.currency] ?? 0) + row.payment.amount
			return acc
		},
		{ RUB: 0, KZT: 0 } satisfies Record<Currency, number>
	)
}

export function formatPaymentTotals(totals: Record<Currency, number>) {
	const entries = (Object.entries(totals) as [Currency, number][]).filter(([, amount]) => amount > 0)
	if (entries.length === 0) return formatCurrencyAmount(0, 'RUB')
	return entries.map(([currency, amount]) => formatCurrencyAmount(amount, currency)).join(' · ')
}

export function filterPaymentRows(
	rows: PaymentRow[],
	filters: {
		studentFilter: string[]
		currencyFilter: CurrencyFilter
		dateRange?: PaymentDateRange
		query: string
		sortMode: SortMode
	}
) {
	const normalizedQuery = filters.query.trim().toLocaleLowerCase()
	const filteredRows = rows.filter((row) => {
		if (filters.studentFilter.length > 0 && !filters.studentFilter.includes(row.payment.studentId)) return false
		if (filters.currencyFilter !== ALL_CURRENCIES && row.currency !== filters.currencyFilter) return false
		if (!isWithinPaymentDateRange(row.issued, filters.dateRange)) return false
		if (!normalizedQuery) return true
		return [paymentNumber(row.payment), row.studentName, row.student?.email, row.payment.comment, row.payment.method]
			.filter(Boolean)
			.some((value) => value!.toLocaleLowerCase().includes(normalizedQuery))
	})

	return sortPaymentRows(filteredRows, filters.sortMode)
}

export function groupPaymentRows(rows: PaymentRow[]): PaymentMonthGroup[] {
	const groups = new Map<string, { label: string; rows: PaymentRow[]; totals: Record<Currency, number> }>()
	for (const row of rows) {
		const group = groups.get(row.monthKey) ?? { label: row.monthLabel, rows: [], totals: { RUB: 0, KZT: 0 } }
		group.rows.push(row)
		group.totals[row.currency] += row.payment.amount
		groups.set(row.monthKey, group)
	}
	return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }))
}

export function sortPaymentRows(rows: PaymentRow[], sortMode: SortMode) {
	return [...rows].sort((a, b) => {
		if (sortMode === 'date_asc') return a.issued.getTime() - b.issued.getTime()
		if (sortMode === 'student_asc') return a.studentName.localeCompare(b.studentName)
		if (sortMode === 'student_desc') return b.studentName.localeCompare(a.studentName)
		if (sortMode === 'amount_desc') {
			if (a.currency !== b.currency) return a.currency.localeCompare(b.currency)
			return b.payment.amount - a.payment.amount
		}
		return b.issued.getTime() - a.issued.getTime()
	})
}

export function isWithinPaymentDateRange(date: Date, range?: PaymentDateRange) {
	if (!range?.from) return true

	const from = new Date(range.from)
	const to = new Date(range.to ?? range.from)
	from.setHours(0, 0, 0, 0)
	to.setHours(23, 59, 59, 999)

	const time = date.getTime()
	return time >= from.getTime() && time <= to.getTime()
}

export function paymentInitials(name: string) {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join('')
}

export function currentMonthPaymentCount(rows: PaymentRow[], now: Date) {
	return rows.filter(
		(row) => row.issued.getMonth() === now.getMonth() && row.issued.getFullYear() === now.getFullYear()
	).length
}

export function paymentStudentCounts(rows: PaymentRow[]) {
	return rows.reduce(
		(acc, row) => {
			acc[row.payment.studentId] = (acc[row.payment.studentId] ?? 0) + 1
			return acc
		},
		{} as Record<string, number>
	)
}

export function paymentCurrencyCounts(rows: PaymentRow[]) {
	return rows.reduce(
		(acc, row) => {
			acc[row.currency] = (acc[row.currency] ?? 0) + 1
			return acc
		},
		{ RUB: 0, KZT: 0 } satisfies Record<Currency, number>
	)
}

function monthKey(value: Date) {
	return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`
}
