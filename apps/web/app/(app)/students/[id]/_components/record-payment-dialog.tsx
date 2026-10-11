'use client'

import { useRef, useState, type FormEvent } from 'react'

import { DateField } from '@/components/app/date-field'
import { BalanceCaption, CurrencyField, lessonsHelper, rateOf, type Rate } from '@/components/app/ledger-text'
import { TextField } from '@/components/app/text-field'
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
import { apiRequest } from '@/lib/api-client'

import { PAYMENT_NOTE_MAX_LENGTH, type Currency, type PaymentResponse, type StudentDetail } from '@dv-lab/contracts'
import {
	currencyDigits,
	formatHundredths,
	formatMoney,
	parseLessons,
	parseMoney,
	scheduleToday,
	suggestLessons,
} from '@dv-lab/core'

import { useToast } from '../../../_components/toasts'
import { PaymentStudentPicker } from './payment-student-picker'

type Field = 'amount' | 'currency' | 'lessons' | 'note'

interface RecordPaymentDialogProps {
	student?: StudentDetail
	onClose: () => void
	onRecorded: () => void
}

export function suggestLessonsText(amountMinor: number | null, currency: string, rate: Rate | null) {
	if (amountMinor === null || currency === '') return ''
	const hundredths = suggestLessons(amountMinor, currency, rate)
	return hundredths === null ? '' : formatHundredths(hundredths)
}

function amountProblem(text: string, currency: string) {
	const code = currency === '' ? null : currency
	const digits = currencyDigits(code)
	const fraction = /^\d+(?:[.,](\d+))?$/.exec(text.replace(/\s/g, ''))?.[1] ?? ''
	if (fraction.length > digits) return `Use at most ${digits} decimal places.`
	return parseMoney(text, code) === null ? 'Enter an amount greater than 0.' : undefined
}

export function RecordPaymentDialog({ student: preset, onClose, onRecorded }: RecordPaymentDialogProps) {
	const [chosen, setChosen] = useState<StudentDetail | null>(null)
	const student = preset ?? chosen
	const toast = useToast()
	const today = scheduleToday(new Date())
	const rate = student === null ? null : rateOf(student)
	const [amount, setAmount] = useState('')
	const [currency, setCurrency] = useState(preset?.currency ?? '')
	const [paidOn, setPaidOn] = useState(today)
	const [lessonsDraft, setLessonsDraft] = useState<string | null>(null)
	const [note, setNote] = useState('')
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const amountRef = useRef<HTMLInputElement>(null)
	const currencyRef = useRef<HTMLButtonElement>(null)
	const lessonsRef = useRef<HTMLInputElement>(null)
	const noteRef = useRef<HTMLInputElement>(null)
	const saving = useRef(false)

	const suggestion = suggestLessonsText(currency === '' ? null : parseMoney(amount, currency), currency, rate)
	const lessons = lessonsDraft ?? suggestion
	const prefilled = lessonsDraft === null && suggestion !== ''

	const errors = paymentErrors(amount, currency, lessons, note)

	const shown = (field: Field) => (submitted || touched[field] ? errors[field] : undefined)
	const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))
	const blocked = pending || student === null
	const saveDisabled = pending || (preset === undefined && !canSavePayment(student, errors, lessons, paidOn))

	function chooseStudent(value: StudentDetail | null) {
		setChosen(value)
		setCurrency(value?.currency ?? '')
		setAmount('')
		setLessonsDraft(null)
		setTouched({})
		setSubmitted(false)
		setFailed(false)
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (saving.current || student === null) return
		setSubmitted(true)
		setFailed(false)
		if (errors.amount) return amountRef.current?.focus()
		if (errors.currency) return currencyRef.current?.focus()
		if (errors.lessons) return lessonsRef.current?.focus()
		if (errors.note) return noteRef.current?.focus()
		const amountMinor = parseMoney(amount, currency)
		if (amountMinor === null) return amountRef.current?.focus()
		const trimmedNote = note.trim()
		setPending(true)
		saving.current = true
		const result = await apiRequest<PaymentResponse>('POST', '/payments', {
			studentId: student.id,
			paidOn,
			amountMinor,
			currency: currency as Currency,
			lessonsHundredths: lessons.trim() === '' ? null : parseLessons(lessons),
			note: trimmedNote === '' ? null : trimmedNote,
		})
		setPending(false)
		saving.current = false
		if (!result.ok) {
			setFailed(true)
			return
		}
		toast.show({
			title: 'Payment recorded',
			description: `${formatMoney(amountMinor, currency)} for ${student.displayName}.`,
		})
		onRecorded()
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
						<DialogTitle>{preset === undefined ? 'Add payment' : 'Record payment'}</DialogTitle>
						<DialogDescription>{paymentDescription(student, rate)}</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{preset === undefined ? <PaymentStudentPicker disabled={pending} onChoose={chooseStudent} /> : null}
						{failed ? (
							<Banner status="error">
								<BannerTitle>Could not record the payment. Try again.</BannerTitle>
							</Banner>
						) : null}
						<div className="grid gap-4 sm:grid-cols-2">
							<TextField
								ref={amountRef}
								id="record-payment-amount"
								name="amount"
								label="Amount"
								placeholder="0"
								inputMode="decimal"
								autoComplete="off"
								autoFocus={preset !== undefined}
								value={amount}
								onChange={(event) => setAmount(event.target.value)}
								onBlur={() => touch('amount')}
								disabled={blocked}
								error={shown('amount')}
							/>
							<CurrencyField
								id="record-payment-currency"
								value={currency}
								onChange={setCurrency}
								onBlur={() => touch('currency')}
								error={shown('currency')}
								disabled={blocked}
								triggerRef={currencyRef}
							/>
						</div>
						<div className="grid items-start gap-4 sm:grid-cols-2">
							<DateField
								id="record-payment-date"
								label="Date"
								value={paidOn}
								onChange={setPaidOn}
								max={today}
								disabled={blocked}
							/>
							<TextField
								ref={lessonsRef}
								id="record-payment-lessons"
								name="lessons"
								label="Lessons"
								inputMode="decimal"
								autoComplete="off"
								helper={lessonsHelper(prefilled)}
								value={lessons}
								onChange={(event) => setLessonsDraft(event.target.value)}
								onBlur={() => touch('lessons')}
								disabled={blocked}
								error={shown('lessons')}
							/>
						</div>
						<TextField
							ref={noteRef}
							id="record-payment-note"
							name="note"
							label="Note"
							placeholder="For example, transfer for October"
							autoComplete="off"
							value={note}
							onChange={(event) => setNote(event.target.value)}
							onBlur={() => touch('note')}
							disabled={blocked}
							error={shown('note')}
						/>
						{student !== null ? <BalanceCaption openingBalance={student.openingBalance} paidOn={paidOn} /> : null}
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant={preset === undefined ? 'ghost' : 'secondary'}
							onClick={onClose}
							disabled={pending}
						>
							{preset === undefined ? 'Cancel' : 'Discard changes'}
						</Button>
						<Button type="submit" loading={pending} disabled={saveDisabled}>
							{pending ? 'Saving…' : preset === undefined ? 'Save payment' : 'Record payment'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}

function paymentErrors(
	amount: string,
	currency: string,
	lessons: string,
	note: string
): Partial<Record<Field, string>> {
	const errors: Partial<Record<Field, string>> = {}
	const amountError = amountProblem(amount, currency)
	if (amountError) errors.amount = amountError
	if (currency === '') errors.currency = 'Choose a currency.'
	if (lessons.trim() !== '' && parseLessons(lessons) === null)
		errors.lessons = 'Enter 0 or more lessons, up to two decimals.'
	if (Array.from(note.trim()).length > PAYMENT_NOTE_MAX_LENGTH)
		errors.note = `Use ${PAYMENT_NOTE_MAX_LENGTH} characters or fewer.`
	return errors
}

function canSavePayment(
	student: StudentDetail | null,
	errors: Partial<Record<Field, string>>,
	lessons: string,
	date: string
): boolean {
	return student !== null && Object.keys(errors).length === 0 && parseLessons(lessons) !== null && date !== ''
}

function paymentDescription(student: StudentDetail | null, rate: Rate | null): string {
	if (student === null) return 'Choose a student; the amount and the number of lessons fill in on their own'
	if (rate === null) return `${student.displayName}. No rate is set.`
	return `${student.displayName}. ${formatMoney(rate.rateMinor, rate.currency)} per lesson.`
}
