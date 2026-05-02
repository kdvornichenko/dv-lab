'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { FC } from 'react'

import { Banknote, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { dateOnlyToApiIso, formatDateOnly, isDateOnly, parseDateOnly, todayDateOnly } from '@/lib/crm/date-model'
import { formatCurrencyAmount, getPackageTotalPrice, getStudentDurationPrice } from '@/lib/crm/model'
import type { StudentWithBalance } from '@/lib/crm/types'

import { calculateMonthlyTotalPrice } from '@teacher-crm/api-types'
import type { PaymentMethod } from '@teacher-crm/api-types'

import type {
	PaymentFieldErrors,
	PaymentFieldProps,
	PaymentFormDialogProps,
	PaymentFormValues,
} from './PaymentFormDialog.types'

const PAYMENT_METHODS: PaymentMethod[] = ['bank_transfer', 'cash', 'card', 'other']

function defaultAmount(student: StudentWithBalance | null) {
	if (!student) return 0
	if (student.balance.nextPayment.amount > 0) return student.balance.nextPayment.amount
	if (student.billingMode === 'package' && getPackageTotalPrice(student) > 0) return getPackageTotalPrice(student)
	if (student.billingMode === 'monthly') {
		return calculateMonthlyTotalPrice({
			defaultLessonPrice: student.defaultLessonPrice,
			defaultLessonDurationMinutes: student.defaultLessonDurationMinutes,
			lessonsPerWeek: student.packageLessonsPerWeek,
			packageLessonPriceOverride: student.packageLessonPriceOverride,
		})
	}
	return getStudentDurationPrice(student)
}

function defaultCurrency(student: StudentWithBalance | null) {
	return student?.balance.nextPayment.currency ?? student?.currency ?? 'RUB'
}

function shouldOpenPackageCycle(student: StudentWithBalance | null) {
	if (!student || student.billingMode !== 'package') return false
	const packageTotal = getPackageTotalPrice(student)
	if (packageTotal <= 0) return false
	if (!student.balance.packageProgress) return true
	return student.balance.nextPayment.status === 'due_now' && student.balance.nextPayment.amount === packageTotal
}

function initialValues(student: StudentWithBalance | null): PaymentFormValues {
	return {
		amount: String(defaultAmount(student)),
		paidAt: todayDateOnly(),
		method: 'bank_transfer',
		currency: defaultCurrency(student),
		comment: shouldOpenPackageCycle(student) ? 'Package renewal' : 'Lesson payment',
		packagePurchase: shouldOpenPackageCycle(student),
	}
}

function paymentIdempotencyKey() {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `pay_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export const PaymentFormDialog: FC<PaymentFormDialogProps> = ({ open, student, onOpenChange, onSubmit }) => {
	const formId = useId()
	const idempotencyKeyRef = useRef(paymentIdempotencyKey())
	const isSubmittingRef = useRef(false)
	const [values, setValues] = useState<PaymentFormValues>(() => initialValues(student))
	const [fieldErrors, setFieldErrors] = useState<PaymentFieldErrors>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	useEffect(() => {
		if (open) {
			idempotencyKeyRef.current = paymentIdempotencyKey()
			isSubmittingRef.current = false
			setValues(initialValues(student))
			setFieldErrors({})
			setIsSubmitting(false)
		}
	}, [open, student])

	if (!student) return null

	const amountId = `${formId}-amount`
	const dateId = `${formId}-date`
	const methodId = `${formId}-method`
	const packagePurchaseId = `${formId}-package-purchase`
	const commentId = `${formId}-comment`
	const amountErrorId = `${amountId}-error`
	const dateErrorId = `${dateId}-error`
	const amount = Number(values.amount)
	const amountValid = Number.isFinite(amount) && amount > 0
	const paidAtValid = isDateOnly(values.paidAt)

	async function submit() {
		if (!student) return
		if (isSubmittingRef.current) return

		const nextErrors: PaymentFieldErrors = {}
		if (!amountValid) nextErrors.amount = 'Amount must be greater than zero'
		if (!paidAtValid) nextErrors.paidAt = 'Payment date is required'
		setFieldErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0) {
			return
		}
		isSubmittingRef.current = true
		setIsSubmitting(true)
		try {
			await onSubmit({
				studentId: student.id,
				amount,
				currency: values.packagePurchase ? student.currency : values.currency,
				paidAt: dateOnlyToApiIso(values.paidAt),
				method: values.method,
				comment: values.comment.trim(),
				packagePurchase: values.packagePurchase,
				idempotencyKey: idempotencyKeyRef.current,
			})
			onOpenChange(false)
		} finally {
			isSubmittingRef.current = false
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-xl">
				<DialogHeader className="border-line-soft border-b px-6 py-5">
					<div className="flex items-start gap-3">
						<span className="border-sage-line bg-sage-soft text-sage flex size-10 items-center justify-center rounded-lg border">
							<Banknote className="size-4" />
						</span>
						<div>
							<DialogTitle>Record payment</DialogTitle>
							<DialogDescription>
								{student.fullName} · {formatCurrencyAmount(defaultAmount(student), defaultCurrency(student))} expected
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<form
					className="grid gap-4 px-6 py-5"
					onSubmit={(event) => {
						event.preventDefault()
						void submit()
					}}
				>
					<div className="grid gap-4 sm:grid-cols-2">
						<Field
							id={amountId}
							label={`Amount, ${values.currency}`}
							error={fieldErrors.amount}
							errorId={amountErrorId}
						>
							<Input
								id={amountId}
								type="number"
								min="1"
								step="1"
								value={values.amount}
								aria-invalid={Boolean(fieldErrors.amount)}
								aria-describedby={fieldErrors.amount ? amountErrorId : undefined}
								onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))}
								className="font-mono tabular-nums"
							/>
						</Field>
						<Field id={dateId} label="Payment date" error={fieldErrors.paidAt} errorId={dateErrorId}>
							<DatePicker
								date={parseDateOnly(values.paidAt)}
								onSelect={(date) => setValues((current) => ({ ...current, paidAt: date ? formatDateOnly(date) : '' }))}
								placeholder="Choose date"
								className="w-full font-mono tabular-nums"
							/>
						</Field>
					</div>

					<Field id={methodId} label="Payment method">
						<Select
							value={values.method}
							onValueChange={(value) => setValues((current) => ({ ...current, method: value as PaymentMethod }))}
						>
							<SelectTrigger id={methodId}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PAYMENT_METHODS.map((method) => (
									<SelectItem key={method} value={method}>
										{method.replace('_', ' ')}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{student.billingMode === 'package' && (
						<div className="border-line-soft bg-surface-muted flex items-start gap-3 rounded-lg border p-3">
							<Checkbox
								id={packagePurchaseId}
								checked={values.packagePurchase}
								onCheckedChange={(checked) =>
									setValues((current) => ({ ...current, packagePurchase: checked === true }))
								}
								className="mt-0.5"
							/>
							<Label htmlFor={packagePurchaseId} className="block font-normal">
								<span className="text-ink block text-sm font-medium">Open a new package cycle</span>
								<span className="text-ink-muted mt-1 block text-xs">
									Keep enabled only for renewals that should start a fresh lesson countdown.
								</span>
							</Label>
						</div>
					)}

					<Field id={commentId} label="Comment">
						<Textarea
							id={commentId}
							value={values.comment}
							onChange={(event) => setValues((current) => ({ ...current, comment: event.target.value }))}
							className="min-h-20"
						/>
					</Field>

					<DialogFooter className="border-line-soft bg-surface-muted -mx-6 -mb-5 border-t px-6 py-4">
						<Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							<Save className="size-4" />
							{isSubmitting ? 'Saving' : 'Save payment'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

const Field: FC<PaymentFieldProps> = ({ id, label, error, errorId, children }) => {
	return (
		<div>
			<Label htmlFor={id} className="text-ink-muted mb-1.5 block text-xs font-medium">
				{label}
			</Label>
			{children}
			{error ? (
				<p id={errorId} className="text-danger mt-1 text-xs">
					{error}
				</p>
			) : null}
		</div>
	)
}
