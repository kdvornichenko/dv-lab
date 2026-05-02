import { useEffect, useState } from 'react'
import type { FC } from 'react'

import { Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDateOnly, parseDateOnly } from '@/lib/crm/date-model'
import { formatCurrencyAmount, STUDENT_STATUS_OPTIONS } from '@/lib/crm/model'
import type { StudentWithBalance } from '@/lib/crm/types'

import {
	type Currency,
	DEFAULT_LESSON_DURATION_MINUTES,
	DEFAULT_PACKAGE_WEEKS_PER_MONTH,
	LESSON_PRICE_RUB,
	calculateMonthlyTotalPrice,
	calculatePackageLessonCount,
	calculatePackageLessonPriceRub,
	calculatePackageTotalPriceRub,
	getLessonDurationUnits,
	isSupportedPackageMonths,
} from '@teacher-crm/api-types'

import type {
	FormSubmitEvent,
	PackagePreviewItemProps,
	StudentFieldProps,
	StudentFormCommand,
	StudentFormDialogProps,
	StudentFormErrors,
	StudentFormValues,
} from './StudentFormDialog.types'

const initialValues: StudentFormValues = {
	firstName: '',
	lastName: '',
	level: '',
	special: '',
	status: 'active',
	notes: '',
	birthday: '',
	defaultLessonPrice: String(LESSON_PRICE_RUB.default),
	defaultLessonDurationMinutes: String(DEFAULT_LESSON_DURATION_MINUTES),
	currency: 'RUB',
	packageMonths: '0',
	packageLessonsPerWeek: '1',
	packageLessonCount: '0',
	packageTotalPrice: '0',
	packageLessonPriceOverride: '',
	billingMode: 'per_lesson',
}

const textValue = (value: string | null | undefined) => value ?? ''
const nameFromFullName = (value: string | null | undefined) => {
	const parts = textValue(value).trim().split(/\s+/).filter(Boolean)
	return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') }
}
const inferLessonsPerWeek = (student: StudentWithBalance) => {
	if ((student.packageLessonsPerWeek ?? 0) > 0) return student.packageLessonsPerWeek
	if (student.packageMonths > 0 && student.packageLessonCount > 0) {
		return Math.max(
			Math.round(student.packageLessonCount / (student.packageMonths * DEFAULT_PACKAGE_WEEKS_PER_MONTH)),
			1
		)
	}
	return 1
}

const toValues = (student?: StudentWithBalance | null): StudentFormValues =>
	student
		? (() => {
				const fallbackName = nameFromFullName(student.fullName)
				return {
					firstName: textValue(student.firstName) || fallbackName.firstName,
					lastName: textValue(student.lastName) || fallbackName.lastName,
					level: student.level ?? '',
					special: student.special ?? '',
					status: student.status,
					notes: student.notes ?? '',
					birthday: student.birthday ?? '',
					defaultLessonPrice: String(student.defaultLessonPrice),
					defaultLessonDurationMinutes: String(student.defaultLessonDurationMinutes),
					currency: student.currency,
					packageMonths: String(student.packageMonths),
					packageLessonsPerWeek: String(inferLessonsPerWeek(student)),
					packageLessonCount: String(student.packageLessonCount),
					packageTotalPrice: String(student.packageTotalPrice),
					packageLessonPriceOverride:
						student.packageLessonPriceOverride === null ? '' : String(student.packageLessonPriceOverride),
					billingMode: student.billingMode,
				}
			})()
		: initialValues

const numberValue = (value: string | undefined) => Number(value)
const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0)

function validate(values: StudentFormValues) {
	const errors: StudentFormErrors = {}
	const price = Number(values.defaultLessonPrice)
	const defaultLessonDurationMinutes = numberValue(values.defaultLessonDurationMinutes)
	const packageMonths = numberValue(values.packageMonths)
	const packageLessonsPerWeek = numberValue(values.packageLessonsPerWeek)
	const packageLessonPriceOverride =
		values.packageLessonPriceOverride.trim() === '' ? null : Number(values.packageLessonPriceOverride)
	const customPackage = packageLessonPriceOverride !== null

	if (!textValue(values.firstName).trim()) errors.firstName = 'First name is required'
	if (!textValue(values.lastName).trim()) errors.lastName = 'Last name is required'
	if (!Number.isFinite(price) || price < 0) errors.defaultLessonPrice = 'Price must be zero or greater'
	if (!Number.isInteger(defaultLessonDurationMinutes) || defaultLessonDurationMinutes <= 0) {
		errors.defaultLessonDurationMinutes = 'Duration must be greater than zero'
	}
	if (!Number.isInteger(packageMonths) || (!isSupportedPackageMonths(packageMonths) && !customPackage)) {
		errors.packageMonths = 'Choose a standard plan or custom package'
	}
	if (!Number.isInteger(packageLessonsPerWeek) || packageLessonsPerWeek < 0) {
		errors.packageLessonsPerWeek = 'Lessons per week must be zero or greater'
	}
	if (
		packageLessonPriceOverride !== null &&
		(!Number.isFinite(packageLessonPriceOverride) || packageLessonPriceOverride < 0)
	) {
		errors.packageLessonPriceOverride = 'Custom price must be zero or greater'
	}
	if (values.billingMode === 'monthly' && packageLessonsPerWeek <= 0) {
		errors.packageLessonsPerWeek = 'Set lessons per week'
	}
	if (values.billingMode === 'package') {
		if (packageMonths <= 0) errors.packageMonths = 'Set package length'
		if (packageLessonsPerWeek <= 0) errors.packageLessonsPerWeek = 'Set lessons per week'
	}
	if (!STUDENT_STATUS_OPTIONS.includes(values.status)) errors.status = 'Choose a status'
	if (textValue(values.notes).length > 1000) errors.notes = 'Notes must be 1000 characters or fewer'
	if (textValue(values.special).length > 240) errors.special = 'Special must be 240 characters or fewer'

	return errors
}

function toCommand(values: StudentFormValues): StudentFormCommand {
	const firstName = textValue(values.firstName).trim()
	const lastName = textValue(values.lastName).trim()
	const packageMonths = Number(values.packageMonths)
	const packageLessonsPerWeek = Number(values.packageLessonsPerWeek)
	const packageLessonCount = calculatePackageLessonCount({ packageMonths, packageLessonsPerWeek })
	const packageLessonPriceOverride =
		values.packageLessonPriceOverride.trim() === '' ? null : Number(values.packageLessonPriceOverride)
	return {
		firstName,
		lastName,
		fullName: [firstName, lastName].filter(Boolean).join(' '),
		email: '',
		phone: '',
		level: textValue(values.level).trim(),
		special: textValue(values.special).trim(),
		status: values.status,
		notes: textValue(values.notes).trim(),
		birthday: values.birthday.trim() || null,
		defaultLessonPrice: Number(values.defaultLessonPrice),
		defaultLessonDurationMinutes: Number(values.defaultLessonDurationMinutes),
		currency: values.currency,
		packageMonths,
		packageLessonsPerWeek,
		packageLessonCount,
		packageTotalPrice: calculatePackageTotalPriceRub({
			defaultLessonPrice: Number(values.defaultLessonPrice),
			defaultLessonDurationMinutes: Number(values.defaultLessonDurationMinutes),
			packageMonths,
			packageLessonCount,
			packageLessonPriceOverride,
		}),
		packageLessonPriceOverride,
		billingMode: values.billingMode,
	}
}

export const StudentFormDialog: FC<StudentFormDialogProps> = ({ open, mode, student, onOpenChange, onSubmit }) => {
	const [values, setValues] = useState<StudentFormValues>(() => toValues(student))
	const [errors, setErrors] = useState<StudentFormErrors>({})
	const [isSubmitting, setIsSubmitting] = useState(false)
	const defaultLessonPrice = numberValue(values.defaultLessonPrice)
	const defaultLessonDurationMinutes = numberValue(values.defaultLessonDurationMinutes)
	const durationUnits = getLessonDurationUnits(defaultLessonDurationMinutes)
	const durationLessonPrice = Number.isFinite(defaultLessonPrice) ? defaultLessonPrice * durationUnits : 0
	const packageMonths = numberValue(values.packageMonths)
	const packageLessonsPerWeek = numberValue(values.packageLessonsPerWeek)
	const packageLessonCount = calculatePackageLessonCount({ packageMonths, packageLessonsPerWeek })
	const packageLessonPriceOverride =
		values.packageLessonPriceOverride.trim() === '' ? null : numberValue(values.packageLessonPriceOverride)
	const packageLessonPrice = calculatePackageLessonPriceRub({
		defaultLessonPrice: finiteOrZero(defaultLessonPrice),
		defaultLessonDurationMinutes: finiteOrZero(defaultLessonDurationMinutes) || DEFAULT_LESSON_DURATION_MINUTES,
		packageMonths,
		packageLessonPriceOverride,
	})
	const packageTotalPrice = calculatePackageTotalPriceRub({
		defaultLessonPrice: finiteOrZero(defaultLessonPrice),
		defaultLessonDurationMinutes: finiteOrZero(defaultLessonDurationMinutes) || DEFAULT_LESSON_DURATION_MINUTES,
		packageMonths,
		packageLessonCount,
		packageLessonPriceOverride,
	})
	const monthlyTotalPrice = calculateMonthlyTotalPrice({
		defaultLessonPrice: finiteOrZero(defaultLessonPrice),
		defaultLessonDurationMinutes: finiteOrZero(defaultLessonDurationMinutes) || DEFAULT_LESSON_DURATION_MINUTES,
		lessonsPerWeek: packageLessonsPerWeek,
		packageLessonPriceOverride,
	})
	const packageSavings = Math.max((durationLessonPrice - packageLessonPrice) * finiteOrZero(packageLessonCount), 0)
	const planValue =
		values.billingMode === 'per_lesson'
			? 'per_lesson'
			: values.billingMode === 'monthly'
				? 'monthly'
				: packageLessonPriceOverride !== null && !isSupportedPackageMonths(packageMonths)
					? 'custom'
					: String(packageMonths)

	useEffect(() => {
		if (!open) return
		setValues(toValues(student))
		setErrors({})
	}, [open, student])

	const updateValue = <Key extends keyof StudentFormValues>(key: Key, value: StudentFormValues[Key]) => {
		setValues((current) => {
			if (key === 'billingMode' && value === 'package' && current.packageMonths === '0') {
				return { ...current, [key]: value, packageMonths: '3' }
			}
			return { ...current, [key]: value }
		})
		setErrors((current) => ({
			...current,
			[key]: undefined,
		}))
	}

	const updatePlan = (value: string) => {
		setValues((current) => {
			if (value === 'per_lesson') {
				return { ...current, billingMode: 'per_lesson', packageMonths: '0', packageLessonCount: '0' }
			}
			if (value === 'monthly') {
				return { ...current, billingMode: 'monthly', packageMonths: '0' }
			}
			if (value === 'custom') {
				return {
					...current,
					billingMode: 'package',
					packageMonths: isSupportedPackageMonths(Number(current.packageMonths)) ? '4' : current.packageMonths,
					packageLessonPriceOverride: current.packageLessonPriceOverride || current.defaultLessonPrice,
				}
			}
			return {
				...current,
				billingMode: 'package',
				packageMonths: value,
				packageLessonPriceOverride: '',
			}
		})
		setErrors((current) => ({ ...current, billingMode: undefined, packageMonths: undefined }))
	}

	const handleSubmit = async (event: FormSubmitEvent) => {
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
					<DialogHeader className="border-line-soft bg-surface-muted border-b px-6 py-5 pr-14">
						<div>
							<p className="text-sage mb-1 font-mono text-xs font-semibold uppercase">Student record</p>
							<DialogTitle>{mode === 'create' ? 'Add student' : 'Edit student'}</DialogTitle>
							<p className="text-ink-muted mt-1 text-sm">
								Keep schedule labels, billing mode, and default lesson price in one ledger entry.
							</p>
						</div>
						<DialogDescription className="sr-only">Student registry form</DialogDescription>
					</DialogHeader>

					<ScrollArea className="max-h-[calc(100dvh-13rem)]">
						<div className="grid gap-4 px-6 py-5 md:grid-cols-2">
							<Field label="First name" error={errors.firstName}>
								<Input
									value={values.firstName}
									onChange={(event) => updateValue('firstName', event.target.value)}
									aria-invalid={Boolean(errors.firstName)}
								/>
							</Field>
							<Field label="Last name" error={errors.lastName}>
								<Input
									value={values.lastName}
									onChange={(event) => updateValue('lastName', event.target.value)}
									aria-invalid={Boolean(errors.lastName)}
								/>
							</Field>
							<Field label="Level">
								<Input value={values.level} onChange={(event) => updateValue('level', event.target.value)} />
							</Field>
							<Field label="Birthday">
								<DatePicker
									date={parseDateOnly(values.birthday)}
									onSelect={(date) => updateValue('birthday', date ? formatDateOnly(date) : '')}
									placeholder="Choose birthday"
									className="w-full"
								/>
							</Field>
							<Field label="Special" error={errors.special}>
								<Input
									value={values.special}
									onChange={(event) => updateValue('special', event.target.value)}
									aria-invalid={Boolean(errors.special)}
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

							<Field label="Currency">
								<Select value={values.currency} onValueChange={(value) => updateValue('currency', value as Currency)}>
									<SelectTrigger>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="RUB">RUB</SelectItem>
										<SelectItem value="KZT">KZT</SelectItem>
									</SelectContent>
								</Select>
							</Field>
							<Field label={`Default lesson price, ${values.currency}`} error={errors.defaultLessonPrice}>
								<Input
									type="number"
									inputMode="numeric"
									min="0"
									step="1"
									className="font-mono tabular-nums"
									value={values.defaultLessonPrice}
									onChange={(event) => updateValue('defaultLessonPrice', event.target.value)}
									aria-invalid={Boolean(errors.defaultLessonPrice)}
								/>
							</Field>
							<Field label="Default lesson duration, minutes" error={errors.defaultLessonDurationMinutes}>
								<Input
									type="number"
									inputMode="numeric"
									min="1"
									step="1"
									className="font-mono tabular-nums"
									value={values.defaultLessonDurationMinutes}
									onChange={(event) => updateValue('defaultLessonDurationMinutes', event.target.value)}
									aria-invalid={Boolean(errors.defaultLessonDurationMinutes)}
								/>
							</Field>
							<div className="border-line-soft bg-surface-muted grid gap-4 rounded-lg border p-4 md:col-span-2 md:grid-cols-3">
								<div className="md:col-span-3">
									<p className="font-heading text-ink text-sm font-semibold">Package terms</p>
									<p className="text-ink-muted mt-1 text-xs">
										Choose the package length and lesson count. Lesson price and total payment are calculated from the
										base price and lesson duration.
									</p>
								</div>
								<Field label="Plan" error={errors.billingMode ?? errors.packageMonths}>
									<Select value={planValue} onValueChange={updatePlan}>
										<SelectTrigger aria-invalid={Boolean(errors.packageMonths)}>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="per_lesson">Per lesson</SelectItem>
											<SelectItem value="monthly">Monthly</SelectItem>
											<SelectItem value="3">3 months</SelectItem>
											<SelectItem value="5">5 months</SelectItem>
											<SelectItem value="custom">+ custom</SelectItem>
										</SelectContent>
									</Select>
								</Field>
								{planValue === 'custom' && (
									<Field label="Custom months" error={errors.packageMonths}>
										<Input
											type="number"
											inputMode="numeric"
											min="1"
											step="1"
											className="font-mono tabular-nums"
											value={values.packageMonths}
											onChange={(event) => updateValue('packageMonths', event.target.value)}
											aria-invalid={Boolean(errors.packageMonths)}
										/>
									</Field>
								)}
								<Field label="Lessons per week" error={errors.packageLessonsPerWeek}>
									<Input
										type="number"
										inputMode="numeric"
										min="0"
										step="1"
										className="font-mono tabular-nums"
										value={values.packageLessonsPerWeek}
										onChange={(event) => updateValue('packageLessonsPerWeek', event.target.value)}
										aria-invalid={Boolean(errors.packageLessonsPerWeek)}
									/>
								</Field>
								{planValue === 'custom' && (
									<Field label="Custom lesson price" error={errors.packageLessonPriceOverride}>
										<Input
											type="number"
											inputMode="numeric"
											min="0"
											step="1"
											className="font-mono tabular-nums"
											value={values.packageLessonPriceOverride}
											onChange={(event) => updateValue('packageLessonPriceOverride', event.target.value)}
											placeholder="Use package discount"
											aria-invalid={Boolean(errors.packageLessonPriceOverride)}
										/>
									</Field>
								)}
								<PackagePreviewItem label="Lessons in package" value={`${packageLessonCount} lessons`} />
								<div className="border-line-soft bg-surface grid gap-3 rounded-lg border p-3 sm:grid-cols-4 md:col-span-3">
									<PackagePreviewItem
										label="Base duration price"
										value={formatCurrencyAmount(durationLessonPrice, values.currency)}
									/>
									<PackagePreviewItem
										label="Package lesson price"
										value={formatCurrencyAmount(packageLessonPrice, values.currency)}
									/>
									<PackagePreviewItem
										label="Package payment"
										value={formatCurrencyAmount(finiteOrZero(packageTotalPrice), values.currency)}
									/>
									<PackagePreviewItem
										label="Monthly payment"
										value={formatCurrencyAmount(finiteOrZero(monthlyTotalPrice), values.currency)}
									/>
									<PackagePreviewItem label="Savings" value={formatCurrencyAmount(packageSavings, values.currency)} />
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

					<DialogFooter className="border-line-soft bg-surface-muted border-t px-6 py-4">
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

const PackagePreviewItem: FC<PackagePreviewItemProps> = ({ label, value }) => {
	return (
		<div>
			<p className="text-ink-muted text-xs font-medium">{label}</p>
			<p className="text-ink mt-1 font-mono text-sm font-semibold tabular-nums">{value}</p>
		</div>
	)
}

const Field: FC<StudentFieldProps> = ({ label, error, className, children }) => {
	return (
		<div className={className}>
			<Label className="text-ink-muted mb-1.5 block text-xs font-medium">{label}</Label>
			{children}
			{error && <p className="text-danger mt-1 text-xs">{error}</p>}
		</div>
	)
}
