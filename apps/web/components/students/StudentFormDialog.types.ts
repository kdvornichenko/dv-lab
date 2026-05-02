import type { ReactNode } from 'react'

import type { StudentWithBalance } from '@/lib/crm/types'

import type { Currency } from '@teacher-crm/api-types'

export type StudentFormValues = {
	firstName: string
	lastName: string
	level: string
	special: string
	status: StudentWithBalance['status']
	notes: string
	birthday: string
	defaultLessonPrice: string
	defaultLessonDurationMinutes: string
	currency: Currency
	packageMonths: string
	packageLessonsPerWeek: string
	packageLessonCount: string
	packageTotalPrice: string
	packageLessonPriceOverride: string
	billingMode: StudentWithBalance['billingMode']
}

export type StudentFormCommand = Omit<
	StudentFormValues,
	| 'defaultLessonPrice'
	| 'defaultLessonDurationMinutes'
	| 'packageMonths'
	| 'packageLessonsPerWeek'
	| 'packageLessonCount'
	| 'packageTotalPrice'
	| 'packageLessonPriceOverride'
	| 'birthday'
> & {
	fullName: string
	email: string
	phone: string
	birthday: string | null
	defaultLessonPrice: number
	defaultLessonDurationMinutes: number
	currency: Currency
	packageMonths: number
	packageLessonsPerWeek: number
	packageLessonCount: number
	packageTotalPrice: number
	packageLessonPriceOverride: number | null
}

export type StudentFormErrors = Partial<Record<keyof StudentFormValues, string>>

export type FormSubmitEvent = {
	preventDefault: () => void
}

export type StudentFormDialogProps = {
	open: boolean
	mode: 'create' | 'edit'
	student?: StudentWithBalance | null
	onOpenChange: (open: boolean) => void
	onSubmit: (input: StudentFormCommand) => Promise<void>
}

export type PackagePreviewItemProps = {
	label: string
	value: string
}

export type StudentFieldProps = {
	label: string
	error?: string
	className?: string
	children: ReactNode
}
