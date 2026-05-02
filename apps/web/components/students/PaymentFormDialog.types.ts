import type { ReactNode } from 'react'

import type { StudentWithBalance } from '@/lib/crm/types'

import type { CreatePaymentInput, Currency, PaymentMethod } from '@teacher-crm/api-types'

export type PaymentFormDialogProps = {
	open: boolean
	student: StudentWithBalance | null
	onOpenChange: (open: boolean) => void
	onSubmit: (input: CreatePaymentInput) => Promise<void>
}

export type PaymentFormValues = {
	amount: string
	paidAt: string
	method: PaymentMethod
	currency: Currency
	comment: string
	packagePurchase: boolean
}

export type PaymentFieldErrors = Partial<Record<'amount' | 'paidAt', string>>

export type PaymentFieldProps = {
	id: string
	label: string
	error?: string
	errorId?: string
	children: ReactNode
}
