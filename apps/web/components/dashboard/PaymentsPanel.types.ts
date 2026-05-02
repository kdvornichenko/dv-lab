import type { PaymentRow } from '@/lib/crm/payments-model'

import type { Currency, Payment, Student, StudentBalance } from '@teacher-crm/api-types'

export type PaymentsPanelProps = {
	payments: Payment[]
	students: Student[]
	studentBalances: StudentBalance[]
	now: Date
	onDeletePayment: (paymentId: string) => Promise<void>
	previewMode?: boolean
}

export type ActivePaymentFilter = {
	key: string
	label: string
	clear: () => void
}

export type PaymentMonthGroupProps = {
	label: string
	rows: PaymentRow[]
	totals: Record<Currency, number>
	deletingPaymentId: string | null
	previewMode: boolean
	onDeletePayment: (paymentId: string) => Promise<void>
}

export type PaymentTableRowProps = {
	row: PaymentRow
	deletingPaymentId: string | null
	previewMode: boolean
	onDeletePayment: (paymentId: string) => Promise<void>
}
