import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { BILLING_MODE_OPTIONS, formatUsdAmount, getBillingModeLabel, STUDENT_STATUS_OPTIONS } from '@/lib/crm/model'
import type { StudentWithBalance } from '@/lib/crm/types'

import { LESSON_PRICE_RUB } from '@teacher-crm/api-types'

type StudentFormValues = {
	fullName: string
	email: string
	phone: string
	level: string
	status: StudentWithBalance['status']
	notes: string
	defaultLessonPrice: string
	packageMonths: string
	packageLessonCount: string
	packageTotalPrice: string
	billingMode: StudentWithBalance['billingMode']
}

type StudentFormCommand = Omit<
	StudentFormValues,
	'defaultLessonPrice' | 'packageMonths' | 'packageLessonCount' | 'packageTotalPrice'
> & {
	defaultLessonPrice: number
	packageMonths: number
	packageLessonCount: number
	packageTotalPrice: number
}

type StudentFormErrors = Partial<Record<keyof StudentFormValues | 'contact', string>>

type StudentFormDialogProps = {
	open: boolean
	mode: 'create' | 'edit'
	student?: StudentWithBalance | null
	onOpenChange: (open: boolean) => void
	onSubmit: (input: StudentFormCommand) => Promise<void>
}

const initialValues: StudentFormValues = {
	fullName: '',
	email: '',
	phone: '',
	level: '',
	status: 'active',
	notes: '',
	defaultLessonPrice: String(LESSON_PRICE_RUB.default),
	packageMonths: '0',
	packageLessonCount: '0',
	packageTotalPrice: '0',
	billingMode: 'per_lesson',
}

const toValues = (student?: StudentWithBalance | null): StudentFormValues =>
	student
		? {
				fullName: student.fullName,
				email: student.email ?? '',
				phone: student.phone ?? '',
				level: student.level ?? '',
				status: student.status,
				notes: student.notes ?? '',
				defaultLessonPrice: String(student.defaultLessonPrice),
				packageMonths: String(student.packageMonths),
				packageLessonCount: String(student.packageLessonCount),
				packageTotalPrice: String(student.packageTotalPrice),
				billingMode: student.billingMode,
			}
		: initialValues

const validateEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
const numberValue = (value: string) => Number(value)
const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0)

function validate(values: StudentFormValues) {
	const errors: StudentFormErrors = {}
	const price = Number(values.defaultLessonPrice)
	const packageMonths = numberValue(values.packageMonths)
	const packageLessonCount = numberValue(values.packageLessonCount)
	const packageTotalPrice = numberValue(values.packageTotalPrice)

	if (!values.fullName.trim()) errors.fullName = 'Full name is required'
	if (!Number.isFinite(price) || price < 0) errors.defaultLessonPrice = 'Price must be zero or greater'
	if (!Number.isInteger(packageMonths) || packageMonths < 0) errors.packageMonths = 'Months must be zero or greater'
	if (!Number.isInteger(packageLessonCount) || packageLessonCount < 0) {
		errors.packageLessonCount = 'Lessons must be zero or greater'
	}
	if (!Number.isFinite(packageTotalPrice) || packageTotalPrice < 0) {
		errors.packageTotalPrice = 'Package price must be zero or greater'
	}
	if (values.billingMode === 'package') {
		if (packageMonths <= 0) errors.packageMonths = 'Set package length'
		if (packageLessonCount <= 0) errors.packageLessonCount = 'Set lessons in package'
		if (packageTotalPrice <= 0) errors.packageTotalPrice = 'Set package payment amount'
	}
	if (!values.email.trim() && !values.phone.trim()) errors.contact = 'Add email or phone'
	if (!validateEmail(values.email.trim())) errors.email = 'Use a valid email address'
	if (!STUDENT_STATUS_OPTIONS.includes(values.status)) errors.status = 'Choose a status'
	if (!BILLING_MODE_OPTIONS.includes(values.billingMode)) errors.billingMode = 'Choose billing mode'
	if (values.notes.length > 1000) errors.notes = 'Notes must be 1000 characters or fewer'

	return errors
}

function toCommand(values: StudentFormValues): StudentFormCommand {
	return {
		fullName: values.fullName.trim(),
		email: values.email.trim(),
		phone: values.phone.trim(),
		level: values.level.trim(),
		status: values.status,
		notes: values.notes.trim(),
		defaultLessonPrice: Number(values.defaultLessonPrice),
		packageMonths: Number(values.packageMonths),
		packageLessonCount: Number(values.packageLessonCount),
		packageTotalPrice: Number(values.packageTotalPrice),
		billingMode: values.billingMode,
	}
}

export function StudentFormDialog({ open, mode, student, onOpenChange, onSubmit }: StudentFormDialogProps) {
	const [values, setValues] = useState<StudentFormValues>(() => toValues(student))
	const [errors, setErrors] = useState<StudentFormErrors>({})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const defaultLessonPrice = numberValue(values.defaultLessonPrice)
	const packageLessonCount = numberValue(values.packageLessonCount)
	const packageTotalPrice = numberValue(values.packageTotalPrice)
	const packageLessonPrice =
		Number.isFinite(packageTotalPrice) && packageLessonCount > 0 ? packageTotalPrice / packageLessonCount : 0
	const packageSavings =
		Number.isFinite(defaultLessonPrice) && Number.isFinite(packageTotalPrice) && packageLessonCount > 0
			? Math.max(defaultLessonPrice * packageLessonCount - packageTotalPrice, 0)
			: 0

	useEffect(() => {
		if (!open) return
		setValues(toValues(student))
		setErrors({})
	}, [open, student])

	const updateValue = <Key extends keyof StudentFormValues>(key: Key, value: StudentFormValues[Key]) => {
		setValues((current) => ({ ...current, [key]: value }))
		setErrors((current) => ({
			...current,
			[key]: undefined,
			contact: key === 'email' || key === 'phone' ? undefined : current.contact,
		}))
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const nextErrors = validate(values)
		setErrors(nextErrors)
		if (Object.keys(nextErrors).length > 0) return

		setIsSubmitting(true)
		try {
			await onSubmit(toCommand(values))
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<form onSubmit={handleSubmit} className="grid min-h-0">
					<DialogHeader className="border-b border-line-soft bg-surface-muted px-6 py-5 pr-14">
						<div>
							<p className="mb-1 font-mono text-xs font-semibold text-sage uppercase">Student record</p>
							<DialogTitle>{mode === 'create' ? 'Add student' : 'Edit student'}</DialogTitle>
							<p className="mt-1 text-sm text-ink-muted">
								Keep contact, billing mode, and default lesson price in one ledger entry.
							</p>
						</div>
						<DialogDescription className="sr-only">Student registry form</DialogDescription>
					</DialogHeader>

					<ScrollArea className="max-h-[calc(100dvh-13rem)]">
						<div className="grid gap-4 px-6 py-5 md:grid-cols-2">
							<Field label="Full name" error={errors.fullName}>
								<Input
									value={values.fullName}
									onChange={(event) => updateValue('fullName', event.target.value)}
									aria-invalid={Boolean(errors.fullName)}
								/>
							</Field>
							<Field label="Level">
								<Input value={values.level} onChange={(event) => updateValue('level', event.target.value)} />
							</Field>
							<Field label="Email" error={errors.email ?? errors.contact}>
								<Input
									type="email"
									value={values.email}
									onChange={(event) => updateValue('email', event.target.value)}
									aria-invalid={Boolean(errors.email ?? errors.contact)}
								/>
							</Field>
							<Field label="Phone" error={errors.contact}>
								<Input
									value={values.phone}
									onChange={(event) => updateValue('phone', event.target.value)}
									aria-invalid={Boolean(errors.contact)}
								/>
							</Field>
							<Field label="Status" error={errors.status}>
								<Select
									value={values.status}
									onValueChange={(value) => updateValue('status', value as StudentFormValues['status'])}
								>
									<SelectTrigger aria-invalid={Boolean(errors.status)}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{STUDENT_STATUS_OPTIONS.map((item) => (
											<SelectItem key={item} value={item}>
												{item}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field label="Billing mode" error={errors.billingMode}>
								<Select
									value={values.billingMode}
									onValueChange={(value) => updateValue('billingMode', value as StudentFormValues['billingMode'])}
								>
									<SelectTrigger aria-invalid={Boolean(errors.billingMode)}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{BILLING_MODE_OPTIONS.map((item) => (
											<SelectItem key={item} value={item}>
												{getBillingModeLabel(item)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</Field>
							<Field label="Default lesson price, RUB" error={errors.defaultLessonPrice}>
								<Input
									type="number"
									inputMode="numeric"
									min="0"
									step="1"
									value={values.defaultLessonPrice}
									onChange={(event) => updateValue('defaultLessonPrice', event.target.value)}
									aria-invalid={Boolean(errors.defaultLessonPrice)}
								/>
							</Field>
							<div className="grid gap-4 rounded-lg border border-line-soft bg-surface-muted p-4 md:col-span-2 md:grid-cols-3">
								<div className="md:col-span-3">
									<p className="text-sm font-semibold text-ink">Package terms</p>
									<p className="mt-1 text-xs text-ink-muted">
										Enter the package payment manually. Lesson price inside the package is calculated from lesson count.
									</p>
								</div>
								<Field label="Package months" error={errors.packageMonths}>
									<Input
										type="number"
										inputMode="numeric"
										min="0"
										step="1"
										value={values.packageMonths}
										onChange={(event) => updateValue('packageMonths', event.target.value)}
										aria-invalid={Boolean(errors.packageMonths)}
									/>
								</Field>
								<Field label="Lessons in package" error={errors.packageLessonCount}>
									<Input
										type="number"
										inputMode="numeric"
										min="0"
										step="1"
										value={values.packageLessonCount}
										onChange={(event) => updateValue('packageLessonCount', event.target.value)}
										aria-invalid={Boolean(errors.packageLessonCount)}
									/>
								</Field>
								<Field label="Package payment, RUB" error={errors.packageTotalPrice}>
									<Input
										type="number"
										inputMode="numeric"
										min="0"
										step="1"
										value={values.packageTotalPrice}
										onChange={(event) => updateValue('packageTotalPrice', event.target.value)}
										aria-invalid={Boolean(errors.packageTotalPrice)}
									/>
								</Field>
								<div className="grid gap-3 rounded-lg border border-line-soft bg-surface p-3 sm:grid-cols-3 md:col-span-3">
									<PackagePreviewItem label="Package lesson price" value={formatUsdAmount(packageLessonPrice)} />
									<PackagePreviewItem
										label="Package payment"
										value={formatUsdAmount(finiteOrZero(packageTotalPrice))}
									/>
									<PackagePreviewItem label="Savings" value={formatUsdAmount(packageSavings)} />
								</div>
							</div>
							<Field label="Notes" error={errors.notes} className="md:col-span-2">
								<Textarea
									value={values.notes}
									onChange={(event) => updateValue('notes', event.target.value)}
									aria-invalid={Boolean(errors.notes)}
									className="min-h-24"
								/>
							</Field>
						</div>
					</ScrollArea>

					<DialogFooter className="border-t border-line-soft bg-surface-muted px-6 py-4">
						<Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							<Save className="h-4 w-4" />
							{isSubmitting ? 'Saving' : 'Save'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

function PackagePreviewItem({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs font-medium text-ink-muted">{label}</p>
			<p className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">{value}</p>
		</div>
	)
}

function Field({
	label,
	error,
	className,
	children,
}: {
	label: string
	error?: string
	className?: string
	children: ReactNode
}) {
	return (
		<div className={className}>
			<Label className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</Label>
			{children}
			{error && <p className="mt-1 text-xs text-danger">{error}</p>}
		</div>
	)
}
