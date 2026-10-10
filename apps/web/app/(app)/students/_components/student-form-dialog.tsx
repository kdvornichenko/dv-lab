'use client'

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { useRouter } from 'next/navigation'

import { TextField } from '@/components/app/text-field'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
	Combobox,
	ComboboxContent,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	type ComboboxItemData,
} from '@/components/ui/combobox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { apiRequest } from '@/lib/api-client'
import { listTimeZones, matchesTimeZone, utcOffset } from '@/lib/time-zones'

import {
	CURRENCIES,
	DISPLAY_NAME_MAX_LENGTH,
	LESSON_MINUTES_DEFAULT,
	LESSON_MINUTES_MAX,
	LESSON_MINUTES_MIN,
	STUDENT_TEXT_MAX_LENGTH,
	isDisplayNameLength,
	normalizeDisplayName,
	type Currency,
	type StudentDetail,
	type StudentResponse,
} from '@dv-lab/contracts'
import { currencyDigits, currencySymbol, minorToInput, parseMoney } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'

const NO_CURRENCY = 'none'
const SAME_TIME_ZONE = 'same-as-teacher'

type Field = 'name' | 'rate' | 'currency' | 'lessonMinutes' | 'parent' | 'level' | 'goals'

interface Values {
	name: string
	rate: string
	currency: string
	lessonMinutes: string
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
			rate: '',
			currency: NO_CURRENCY,
			lessonMinutes: String(LESSON_MINUTES_DEFAULT),
			timeZone: SAME_TIME_ZONE,
			parent: '',
			level: '',
			goals: '',
		}
	}
	return {
		name: student.displayName,
		rate: student.rateMinor === null ? '' : minorToInput(student.rateMinor, student.currency),
		currency: student.currency ?? NO_CURRENCY,
		lessonMinutes: String(student.defaultLessonMinutes),
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

	const lessonText = values.lessonMinutes.trim()
	const lessonMinutes = /^\d+$/.test(lessonText) ? Number(lessonText) : Number.NaN
	if (!(lessonMinutes >= LESSON_MINUTES_MIN && lessonMinutes <= LESSON_MINUTES_MAX)) {
		errors.lessonMinutes = `Use ${LESSON_MINUTES_MIN} to ${LESSON_MINUTES_MAX} minutes.`
	}

	for (const field of ['parent', 'level', 'goals'] as const) {
		if (textLength(values[field]) > STUDENT_TEXT_MAX_LENGTH) {
			errors[field] = `Use ${STUDENT_TEXT_MAX_LENGTH} characters or fewer.`
		}
	}
	return { errors, rateMinor, currency, lessonMinutes }
}

function buildTimeZones(saved: string | null): ComboboxItemData[] {
	const now = new Date()
	return [
		{ value: SAME_TIME_ZONE, label: 'Same as teacher' },
		...listTimeZones(saved ? [saved] : []).map((zone) => ({ value: zone, label: zone, detail: utcOffset(zone, now) })),
	]
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
	const [values, setValues] = useState<Values>(() => initialValues(student))
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

	const savedTimeZone = student?.timeZone ?? null
	const timeZones = useMemo(() => buildTimeZones(savedTimeZone), [savedTimeZone])

	const parsed = parse(values)
	const shown = (field: Field) => (submitted || touched[field] ? parsed.errors[field] : undefined)
	const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))
	const set = (field: keyof Values, value: string) => setValues((current) => ({ ...current, [field]: value }))
	const currencyError = submitted || touched.currency || touched.rate ? parsed.errors.currency : undefined
	const create = mode === 'create'

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setSubmitted(true)
		setFailed(false)
		const { errors } = parsed
		if (errors.name) return nameRef.current?.focus()
		if (errors.rate) return rateRef.current?.focus()
		if (errors.currency) return currencyRef.current?.focus()
		if (errors.lessonMinutes) return lessonRef.current?.focus()
		if (errors.parent) return parentRef.current?.focus()
		if (errors.level) return levelRef.current?.focus()
		if (errors.goals) return goalsRef.current?.focus()
		const name = normalizeDisplayName(values.name)
		setPending(true)
		const result = await apiRequest<StudentResponse>(
			create ? 'POST' : 'PATCH',
			create ? '/students' : `/students/${student?.id}`,
			{
				displayName: name,
				rateMinor: parsed.rateMinor,
				currency: parsed.currency,
				defaultLessonMinutes: parsed.lessonMinutes,
				parent: nullable(values.parent),
				level: nullable(values.level),
				goals: nullable(values.goals),
				timeZone: values.timeZone === SAME_TIME_ZONE ? null : values.timeZone,
			}
		)
		setPending(false)
		if (!result.ok) {
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
						<DialogTitle>{create ? 'New student' : `Edit ${student?.displayName ?? ''}`}</DialogTitle>
						<DialogDescription>
							{create
								? 'Add a card. You can fill in notes, vocabulary and payments after saving.'
								: 'Changes apply to this card only.'}
						</DialogDescription>
					</DialogHeader>
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
							<TextField
								ref={lessonRef}
								id="student-form-lesson"
								name="lessonMinutes"
								label="Lesson length (min)"
								inputMode="numeric"
								autoComplete="off"
								helper={`Used to turn stored time into lessons. ${LESSON_MINUTES_MIN} to ${LESSON_MINUTES_MAX} minutes.${create ? '' : ' Changing this changes how the balance is shown in lessons.'}`}
								value={values.lessonMinutes}
								onChange={(event) => set('lessonMinutes', event.target.value)}
								onBlur={() => touch('lessonMinutes')}
								disabled={pending}
								error={shown('lessonMinutes')}
							/>
							<FieldFrame id="student-form-time-zone" label="Time zone" helper="Empty means the same as yours.">
								<Combobox
									items={timeZones}
									value={values.timeZone}
									onValueChange={(value) => set('timeZone', value === '' ? SAME_TIME_ZONE : value)}
									filter={matchesTimeZone}
									disabled={pending}
								>
									<ComboboxInput
										id="student-form-time-zone"
										placeholder="Same as teacher"
										aria-describedby="student-form-time-zone-helper"
									/>
									<ComboboxContent>
										<ComboboxList
											emptyTitle="No time zones found"
											emptyHint="Try a city, a country or an offset like UTC+7."
										>
											{(item) => {
												if (typeof item === 'string') {
													return (
														<ComboboxItem key={item} value={item}>
															{item}
														</ComboboxItem>
													)
												}
												return (
													<ComboboxItem key={item.value} value={item.value} detail={item.detail}>
														{item.label}
													</ComboboxItem>
												)
											}}
										</ComboboxList>
									</ComboboxContent>
								</Combobox>
							</FieldFrame>
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
					</div>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending}>
							{create ? (pending ? 'Creating…' : 'Create student') : pending ? 'Saving…' : 'Save changes'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
