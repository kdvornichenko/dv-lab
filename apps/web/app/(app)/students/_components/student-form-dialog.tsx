'use client'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { useRouter } from 'next/navigation'

import { LengthField } from '@/components/app/length-field'
import { ReloadNotice } from '@/components/app/reload-notice'
import { TextField } from '@/components/app/text-field'
import { TimeZonePicker } from '@/components/app/time-zone-picker'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { apiRequest } from '@/lib/api-client'
import { LENGTH_ERROR, LENGTH_HELPER } from '@/lib/lesson-length'

import {
	CURRENCIES,
	DISPLAY_NAME_MAX_LENGTH,
	GENDERS,
	LESSON_MINUTES_DEFAULT,
	STUDENT_TEXT_MAX_LENGTH,
	isDisplayNameLength,
	normalizeDisplayName,
	type Currency,
	type Gender,
	type StudentDetail,
	type StudentResponse,
} from '@dv-lab/contracts'
import { currencyDigits, currencySymbol, minorToInput, parseMoney } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'

const NO_CURRENCY = 'none'
const SAME_TIME_ZONE = 'same-as-teacher'
const SAME_AS_TEACHER = { value: SAME_TIME_ZONE, label: 'Same as teacher' }
const GENDER_NOT_SET = 'not-set'

export const GENDER_LABEL: Record<Gender, string> = { female: 'Female', male: 'Male' }

const GENDER_OPTIONS = [
	...GENDERS.map((gender) => ({ value: gender, label: GENDER_LABEL[gender] })),
	{ value: GENDER_NOT_SET, label: 'Not set' },
]

const SEGMENT_CLASS =
	'inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-body whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus-ring data-checked:bg-active data-checked:font-semibold data-checked:text-foreground data-disabled:cursor-default'

type Field = 'name' | 'rate' | 'currency' | 'lessonMinutes' | 'parent' | 'level' | 'goals'

interface Values {
	name: string
	gender: string
	rate: string
	currency: string
	lessonMinutes: number | null
	timeZone: string
	parent: string
	level: string
	goals: string
}

interface Parsed {
	errors: Partial<Record<Field, string>>
	rateMinor: number | null
	currency: Currency | null
	lessonMinutes: number
}

interface StudentFormDialogProps {
	mode: 'create' | 'edit'
	student?: StudentDetail
	onClose: () => void
	onSaved: (student: StudentDetail) => void
}

function initialValues(student: StudentDetail | undefined): Values {
	if (!student) {
		return {
			name: '',
			gender: GENDER_NOT_SET,
			rate: '',
			currency: NO_CURRENCY,
			lessonMinutes: LESSON_MINUTES_DEFAULT,
			timeZone: SAME_TIME_ZONE,
			parent: '',
			level: '',
			goals: '',
		}
	}
	return {
		name: student.displayName,
		gender: student.gender ?? GENDER_NOT_SET,
		rate: student.rateMinor === null ? '' : minorToInput(student.rateMinor, student.currency),
		currency: student.currency ?? NO_CURRENCY,
		lessonMinutes: student.defaultLessonMinutes,
		timeZone: student.timeZone ?? SAME_TIME_ZONE,
		parent: student.parent ?? '',
		level: student.level ?? '',
		goals: student.goals ?? '',
	}
}

function textLength(value: string) {
	return Array.from(value.trim()).length
}

function parse(values: Values): Parsed {
	const errors: Partial<Record<Field, string>> = {}
	const name = normalizeDisplayName(values.name)
	if (name === '') errors.name = "Enter the student's name."
	else if (!isDisplayNameLength(name)) errors.name = `Use ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`

	const currency = values.currency === NO_CURRENCY ? null : (values.currency as Currency)
	const rateText = values.rate.trim()
	let rateMinor: number | null = null
	if (rateText !== '') {
		const digits = currencyDigits(currency)
		const fraction = /^\d+(?:[.,](\d+))?$/.exec(rateText.replace(/\s/g, ''))?.[1] ?? ''
		if (fraction.length > digits) errors.rate = `Use at most ${digits} decimal places.`
		else {
			rateMinor = parseMoney(rateText, currency)
			if (rateMinor === null) errors.rate = 'Enter a rate greater than 0.'
		}
		if (currency === null) errors.currency = 'Choose a currency.'
	} else if (currency !== null) {
		errors.currency = 'Enter the rate or set the currency to None.'
	}

	const lessonMinutes = values.lessonMinutes ?? Number.NaN
	if (values.lessonMinutes === null) errors.lessonMinutes = LENGTH_ERROR

	for (const field of ['parent', 'level', 'goals'] as const) {
		if (textLength(values[field]) > STUDENT_TEXT_MAX_LENGTH) {
			errors[field] = `Use ${STUDENT_TEXT_MAX_LENGTH} characters or fewer.`
		}
	}
	return { errors, rateMinor, currency, lessonMinutes }
}

function nullable(value: string) {
	const trimmed = value.trim()
	return trimmed === '' ? null : trimmed
}

function FieldFrame({
	id,
	label,
	helper,
	children,
}: {
	id: string
	label: string
	helper?: string
	children: ReactNode
}) {
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor={id} className="text-body text-muted-foreground">
				{label}
			</label>
			{children}
			{helper ? (
				<p id={`${id}-helper`} className="text-caption text-muted-foreground">
					{helper}
				</p>
			) : null}
		</div>
	)
}

export function StudentFormDialog({ mode, student, onClose, onSaved }: StudentFormDialogProps) {
	const router = useRouter()
	const toast = useToast()
	const [baseline, setBaseline] = useState(student)
	const [values, setValues] = useState<Values>(() => initialValues(student))
	const [noShowDeducts, setNoShowDeducts] = useState(student?.noShowDeducts ?? true)
	const [notice, setNotice] = useState<'changed' | 'lost' | null>(null)
	const [reloading, setReloading] = useState(false)
	const [reloadFailed, setReloadFailed] = useState(false)
	const [formVersion, setFormVersion] = useState(0)
	const [focusName, setFocusName] = useState(0)
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const nameRef = useRef<HTMLInputElement>(null)
	const rateRef = useRef<HTMLInputElement>(null)
	const currencyRef = useRef<HTMLButtonElement>(null)
	const lessonRef = useRef<HTMLInputElement>(null)
	const parentRef = useRef<HTMLInputElement>(null)
	const levelRef = useRef<HTMLInputElement>(null)
	const goalsRef = useRef<HTMLInputElement>(null)

	const parsed = parse(values)
	const shown = (field: Field) => (submitted || touched[field] ? parsed.errors[field] : undefined)
	const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))
	const set = (field: keyof Values, value: string) => setValues((current) => ({ ...current, [field]: value }))
	const currencyError = submitted || touched.currency || touched.rate ? parsed.errors.currency : undefined
	const create = mode === 'create'

	useEffect(() => {
		if (focusName > 0) nameRef.current?.focus()
	}, [focusName])

	async function reload() {
		if (!baseline || reloading) return
		setReloading(true)
		setReloadFailed(false)
		const result = await apiRequest<StudentResponse>('GET', `/students/${baseline.id}`)
		setReloading(false)
		if (!result.ok) {
			setReloadFailed(true)
			return
		}
		const fresh = result.data.student
		setBaseline(fresh)
		setValues(initialValues(fresh))
		setNoShowDeducts(fresh.noShowDeducts)
		setTouched({})
		setSubmitted(false)
		setFailed(false)
		setNotice(null)
		setFormVersion((version) => version + 1)
		setFocusName((version) => version + 1)
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending || notice !== null) return
		setSubmitted(true)
		setFailed(false)
		setReloadFailed(false)
		const { errors } = parsed
		const fields = [
			{ field: 'name', ref: nameRef },
			{ field: 'rate', ref: rateRef },
			{ field: 'currency', ref: currencyRef },
			{ field: 'lessonMinutes', ref: lessonRef },
			{ field: 'parent', ref: parentRef },
			{ field: 'level', ref: levelRef },
			{ field: 'goals', ref: goalsRef },
		] as const
		const invalid = fields.find(({ field }) => errors[field])
		if (invalid) return invalid.ref.current?.focus()
		const name = normalizeDisplayName(values.name)
		setPending(true)
		const result = await apiRequest<StudentResponse>(
			create ? 'POST' : 'PATCH',
			create ? '/students' : `/students/${student?.id}`,
			{
				displayName: name,
				gender: GENDERS.find((gender) => gender === values.gender) ?? null,
				rateMinor: parsed.rateMinor,
				currency: parsed.currency,
				defaultLessonMinutes: parsed.lessonMinutes,
				parent: nullable(values.parent),
				level: nullable(values.level),
				goals: nullable(values.goals),
				timeZone: values.timeZone === SAME_TIME_ZONE ? null : values.timeZone,
				noShowDeducts,
				...(create ? {} : { expectedRevision: baseline?.revision }),
			}
		)
		setPending(false)
		if (!result.ok) {
			if (!create && result.error?.code === 'precondition_failed') return setNotice('changed')
			if (!create && (result.status === 0 || result.status >= 500)) return setNotice('lost')
			setFailed(true)
			return
		}
		const saved = result.data.student
		toast.show(
			create
				? { title: 'Student created', description: `${saved.displayName} was added.` }
				: { title: 'Changes saved', description: `${saved.displayName} was updated.` }
		)
		onSaved(saved)
		if (create) router.push(`/students/${saved.id}`)
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="lg">
				<form noValidate onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>{create ? 'New student' : `Edit ${baseline?.displayName ?? ''}`}</DialogTitle>
						<DialogDescription>
							{create
								? 'Add a card. You can fill in notes, vocabulary and payments after saving.'
								: 'Changes apply to this card only.'}
						</DialogDescription>
					</DialogHeader>
					<ScrollArea
						className="-m-1 max-h-[calc(100dvh-16rem)] pointer-coarse:-m-2"
						viewportClassName="scroll-fade max-h-[inherit] p-1 pointer-coarse:p-2"
					>
						<div className="flex flex-col gap-4">
							{failed ? (
								<Banner status="error">
									<BannerTitle>Could not save the student. Try again.</BannerTitle>
								</Banner>
							) : null}
							<TextField
								ref={nameRef}
								id="student-form-name"
								name="displayName"
								label="Name"
								placeholder="Student name"
								autoComplete="off"
								autoFocus
								value={values.name}
								onChange={(event) => set('name', event.target.value)}
								onBlur={() => touch('name')}
								disabled={pending}
								error={shown('name')}
							/>
							<div className="flex min-w-0 flex-col gap-2">
								<span id="student-form-gender-label" className="text-body text-muted-foreground">
									Gender
								</span>
								<RadioGroup
									aria-labelledby="student-form-gender-label"
									aria-describedby="student-form-gender-helper"
									value={values.gender}
									onValueChange={(value) => set('gender', value)}
									disabled={pending}
									className="flex h-9 min-w-0 gap-0.5 rounded-xl bg-muted p-0.5 pointer-coarse:h-12"
								>
									{GENDER_OPTIONS.map((option) => (
										<Radio.Root key={option.value} value={option.value} className={SEGMENT_CLASS}>
											{option.label}
										</Radio.Root>
									))}
								</RadioGroup>
								<p id="student-form-gender-helper" className="text-caption text-muted-foreground">
									Used by the assistant to choose the right words. Not shown to the student.
								</p>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<TextField
									ref={rateRef}
									id="student-form-rate"
									name="rate"
									label="Rate per lesson"
									placeholder="0"
									inputMode="decimal"
									autoComplete="off"
									helper="Leave empty if the student has no fixed rate."
									value={values.rate}
									onChange={(event) => set('rate', event.target.value)}
									onBlur={() => touch('rate')}
									disabled={pending}
									error={shown('rate')}
								/>
								<FieldFrame id="student-form-currency" label="Currency">
									<Select value={values.currency} onValueChange={(value) => set('currency', value)} disabled={pending}>
										<SelectTrigger
											ref={currencyRef}
											id="student-form-currency"
											className="w-full min-w-0"
											error={currencyError}
											onBlur={() => touch('currency')}
										/>
										<SelectContent>
											<SelectItem index={0} value={NO_CURRENCY}>
												None
											</SelectItem>
											{CURRENCIES.map((code, index) => (
												<SelectItem key={code} index={index + 1} value={code}>
													{`${code} ${currencySymbol(code)}`}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</FieldFrame>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<LengthField
									hoursRef={lessonRef}
									id="student-form-lesson"
									label="Lesson length"
									key={formVersion}
									initialMinutes={baseline?.defaultLessonMinutes ?? LESSON_MINUTES_DEFAULT}
									helper={LENGTH_HELPER}
									onCommit={(minutes) => {
										setValues((current) => ({ ...current, lessonMinutes: minutes }))
										touch('lessonMinutes')
									}}
									disabled={pending}
									error={shown('lessonMinutes')}
								/>
								<FieldFrame id="student-form-time-zone" label="Time zone" helper="Empty means the same as yours.">
									<TimeZonePicker
										trigger="field"
										id="student-form-time-zone"
										aria-describedby="student-form-time-zone-helper"
										value={values.timeZone}
										onChange={(zone) => set('timeZone', zone ?? SAME_TIME_ZONE)}
										firstOption={SAME_AS_TEACHER}
										disabled={pending}
									/>
								</FieldFrame>
							</div>
							<div className="flex min-w-0 flex-col gap-1">
								<Switch
									label="No-show deducts a lesson"
									checked={noShowDeducts}
									onToggle={() => setNoShowDeducts((current) => !current)}
									disabled={pending}
									className="w-full flex-row-reverse justify-between px-0 py-0"
								/>
								<p id="student-form-no-show-helper" className="pr-13 text-caption text-muted-foreground">
									A no-show takes the lesson&apos;s length from the balance. Turn this off to deduct nothing for any
									no-show of this student, past ones too; the balance is recalculated.
								</p>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<TextField
									ref={parentRef}
									id="student-form-parent"
									name="parent"
									label="Parent"
									placeholder="Parent or payer"
									autoComplete="off"
									value={values.parent}
									onChange={(event) => set('parent', event.target.value)}
									onBlur={() => touch('parent')}
									disabled={pending}
									error={shown('parent')}
								/>
								<TextField
									ref={levelRef}
									id="student-form-level"
									name="level"
									label="Level"
									autoComplete="off"
									value={values.level}
									onChange={(event) => set('level', event.target.value)}
									onBlur={() => touch('level')}
									disabled={pending}
									error={shown('level')}
								/>
							</div>
							<TextField
								ref={goalsRef}
								id="student-form-goals"
								name="goals"
								label="Goals"
								autoComplete="off"
								helper="A short line. Longer notes go to the Notes tab."
								value={values.goals}
								onChange={(event) => set('goals', event.target.value)}
								onBlur={() => touch('goals')}
								disabled={pending}
								error={shown('goals')}
							/>
							{notice === 'changed' ? (
								<ReloadNotice
									status="warning"
									text="This student changed elsewhere. Your draft has been kept. Reload the current details before saving."
									reloadLabel="Reload student details"
									pending={reloading}
									onReload={() => void reload()}
								/>
							) : null}
							{notice === 'lost' ? (
								<ReloadNotice
									status="error"
									text="Could not confirm that the student was saved. Reload the current details before saving again."
									reloadLabel="Reload student details"
									pending={reloading}
									onReload={() => void reload()}
								/>
							) : null}
							{reloadFailed ? (
								<Banner status="error">
									<BannerTitle>Could not reload the student. Try again.</BannerTitle>
								</Banner>
							) : null}
						</div>
					</ScrollArea>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending} disabled={notice !== null}>
							{create ? (pending ? 'Creating…' : 'Create student') : pending ? 'Saving…' : 'Save changes'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
