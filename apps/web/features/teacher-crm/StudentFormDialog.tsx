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

import { BILLING_MODE_OPTIONS, getBillingModeLabel, STUDENT_STATUS_OPTIONS } from './model'
import type { StudentWithBalance } from './types'

type StudentFormValues = {
	fullName: string
	email: string
	phone: string
	level: string
	status: StudentWithBalance['status']
	notes: string
	defaultLessonPrice: string
	billingMode: StudentWithBalance['billingMode']
}

type StudentFormCommand = Omit<StudentFormValues, 'defaultLessonPrice'> & {
	defaultLessonPrice: number
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
	defaultLessonPrice: '35',
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
				billingMode: student.billingMode,
			}
		: initialValues

const validateEmail = (email: string) => !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

function validate(values: StudentFormValues) {
	const errors: StudentFormErrors = {}
	const price = Number(values.defaultLessonPrice)

	if (!values.fullName.trim()) errors.fullName = 'Full name is required'
	if (!Number.isFinite(price) || price < 0) errors.defaultLessonPrice = 'Price must be zero or greater'
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
		billingMode: values.billingMode,
	}
}

export function StudentFormDialog({ open, mode, student, onOpenChange, onSubmit }: StudentFormDialogProps) {
	const [values, setValues] = useState<StudentFormValues>(() => toValues(student))
	const [errors, setErrors] = useState<StudentFormErrors>({})
	const [isSubmitting, setIsSubmitting] = useState(false)

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
			<DialogContent className="border-[#E6E0D4] bg-white p-0">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<div className="px-6 pt-6">
							<DialogTitle>{mode === 'create' ? 'Add student' : 'Edit student'}</DialogTitle>
						</div>
						<DialogDescription className="sr-only">Student registry form</DialogDescription>
					</DialogHeader>

					<ScrollArea className="max-h-[70dvh]">
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
							<Field label="Default lesson price" error={errors.defaultLessonPrice}>
								<Input
									type="number"
									min="0"
									step="1"
									value={values.defaultLessonPrice}
									onChange={(event) => updateValue('defaultLessonPrice', event.target.value)}
									aria-invalid={Boolean(errors.defaultLessonPrice)}
								/>
							</Field>
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

					<DialogFooter className="border-t border-[#E6E0D4] px-6 py-4">
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
			<Label className="mb-1.5 block text-xs font-medium text-[#6F6B63]">{label}</Label>
			{children}
			{error && <p className="mt-1 text-xs text-[#A64235]">{error}</p>}
		</div>
	)
}
