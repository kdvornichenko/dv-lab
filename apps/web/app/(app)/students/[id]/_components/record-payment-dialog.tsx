'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'

import { Lock } from 'lucide-react'

import { Avatar } from '@/components/app/avatar'
import { DateField } from '@/components/app/date-field'
import { BalanceCaption, CurrencyField, lessonsHelper, rateOf, type Rate } from '@/components/app/ledger-text'
import { ReloadNotice } from '@/components/app/reload-notice'
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

import {
	PAYMENT_NOTE_MAX_LENGTH,
	type Currency,
	type PaymentResponse,
	type PaymentRow,
	type PaymentsResponse,
	type StudentDetail,
} from '@dv-lab/contracts'
import {
	balancePhrase,
	currencyDigits,
	formatHundredths,
	formatMoney,
	minorToInput,
	parseLessons,
	parseMoney,
	suggestLessons,
} from '@dv-lab/core'

import { useToast } from '../../../_components/toasts'
import {
	TimeZoneStaleNotice,
	useScheduleFormContext,
	type ScheduleFormContext,
} from '../../../schedule/_components/schedule-form-context'
import { PaymentStudentPicker } from './payment-student-picker'

type Field = 'amount' | 'currency' | 'lessons' | 'note' | 'date'

type Notice = 'changed' | 'lost' | 'gone'

interface RecordPaymentDialogProps extends ScheduleFormContext {
	student?: StudentDetail
	payment?: PaymentRow
	onViewPayments?: () => void
	currentMainTimeZone: string
	onClose: () => void
	onRecorded: () => void
	onRefresh: () => void
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

function lessonsText(payment: PaymentRow | undefined) {
	if (payment === undefined) return null
	return payment.lessonsHundredths === null ? '' : formatHundredths(payment.lessonsHundredths)
}

export function RecordPaymentDialog({
	student: initialStudent,
	payment: initialPayment,
	onViewPayments,
	mainTimeZone,
	asOf,
	currentMainTimeZone,
	onClose,
	onRecorded,
	onRefresh,
}: RecordPaymentDialogProps) {
	const [preset] = useState(initialStudent)
	const [base, setBase] = useState(initialPayment)
	const edit = initialPayment !== undefined
	const [notice, setNotice] = useState<Notice | null>(null)
	const [reloading, setReloading] = useState(false)
	const [reloadFailed, setReloadFailed] = useState(false)
	const [chosen, setChosen] = useState<StudentDetail | null>(null)
	const student = preset ?? chosen
	const toast = useToast()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const { today } = context
	const rate = student === null ? null : rateOf(student)
	const [amount, setAmount] = useState(() =>
		initialPayment ? minorToInput(initialPayment.amountMinor, initialPayment.currency) : ''
	)
	const [currency, setCurrency] = useState(initialPayment ? (initialPayment.currency ?? '') : (preset?.currency ?? ''))
	const [paidOn, setPaidOn] = useState(initialPayment?.paidOn ?? today)
	const [lessonsDraft, setLessonsDraft] = useState<string | null>(() => lessonsText(initialPayment))
	const [note, setNote] = useState(initialPayment?.note ?? '')
	const lessonsEdited = useRef(false)
	const [focusAmount, setFocusAmount] = useState(0)
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

	const errors = paymentErrors(amount, currency, lessons, note, paidOn, today)

	const shown = (field: Field) => (submitted || touched[field] ? errors[field] : undefined)
	const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }))
	const blocked = pending || reloading || student === null
	const saveDisabled =
		pending ||
		reloading ||
		context.stale ||
		notice !== null ||
		(preset === undefined && !canSavePayment(student, errors, lessons, paidOn))

	function chooseStudent(value: StudentDetail | null) {
		setChosen(value)
		setCurrency(value?.currency ?? '')
		setAmount('')
		setLessonsDraft(null)
		setTouched({})
		setSubmitted(false)
		setFailed(false)
	}

	useEffect(() => {
		if (focusAmount > 0) amountRef.current?.focus()
	}, [focusAmount])

	function changeAmount(value: string) {
		setAmount(value)
		if (edit && !lessonsEdited.current) setLessonsDraft(null)
	}

	function changeLessons(value: string) {
		lessonsEdited.current = true
		setLessonsDraft(value)
	}

	async function reload() {
		if (!base || student === null || reloading) return
		setReloading(true)
		setReloadFailed(false)
		const result = await apiRequest<PaymentsResponse>('GET', `/payments?student=${student.id}`)
		setReloading(false)
		if (!result.ok) {
			setReloadFailed(true)
			return
		}
		const fresh = result.data.payments.find((row) => row.id === base.id)
		if (!fresh) {
			setNotice('gone')
			return
		}
		setBase(fresh)
		setAmount(minorToInput(fresh.amountMinor, fresh.currency))
		setCurrency(fresh.currency ?? '')
		setPaidOn(fresh.paidOn)
		setLessonsDraft(lessonsText(fresh))
		lessonsEdited.current = false
		setNote(fresh.note ?? '')
		setTouched({})
		setSubmitted(false)
		setFailed(false)
		setNotice(null)
		setFocusAmount((version) => version + 1)
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (saving.current || student === null || context.stale || notice !== null) return
		setSubmitted(true)
		setFailed(false)
		if (errors.amount) return amountRef.current?.focus()
		if (errors.currency) return currencyRef.current?.focus()
		if (errors.lessons) return lessonsRef.current?.focus()
		if (errors.note) return noteRef.current?.focus()
		if (errors.date) return document.getElementById('record-payment-date')?.focus()
		const amountMinor = parseMoney(amount, currency)
		if (amountMinor === null) return amountRef.current?.focus()
		const trimmedNote = note.trim()
		setPending(true)
		saving.current = true
		const fields = {
			paidOn,
			expectedDefaultTimeZone: context.mainTimeZone,
			amountMinor,
			currency: currency as Currency,
			lessonsHundredths: lessons.trim() === '' ? null : parseLessons(lessons),
			note: trimmedNote === '' ? null : trimmedNote,
		}
		const result = base
			? await apiRequest<PaymentResponse>('PATCH', `/payments/${base.id}`, {
					...fields,
					expectedRevision: base.revision,
				})
			: await apiRequest<PaymentResponse>('POST', '/payments', { studentId: student.id, ...fields })
		setPending(false)
		saving.current = false
		if (!result.ok) {
			if (result.error?.code === 'default_time_zone_changed') return context.markStale()
			if (base && result.error?.code === 'precondition_failed') return setNotice('changed')
			if (base && result.status === 404) return setNotice('gone')
			if (base && (result.status === 0 || result.status >= 500)) return setNotice('lost')
			setFailed(true)
			return
		}
		toast.show({
			title: base ? 'Payment saved' : 'Payment recorded',
			description: `${formatMoney(amountMinor, currency)} for ${student.displayName}.`,
		})
		onRecorded()
	}

	if (notice === 'gone') {
		return (
			<Dialog
				open
				onOpenChange={(open) => {
					if (!open) onClose()
				}}
			>
				<DialogContent size="lg">
					<DialogHeader>
						<DialogTitle>Edit payment</DialogTitle>
						<DialogDescription>The balance is recalculated when you save.</DialogDescription>
					</DialogHeader>
					<Banner status="info" role="alert">
						<BannerTitle>This record is no longer available. Open the current records to continue.</BannerTitle>
					</Banner>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose}>
							Close
						</Button>
						<Button type="button" onClick={onViewPayments ?? onClose}>
							View payments
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		)
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
						<DialogTitle>{edit ? 'Edit payment' : preset === undefined ? 'Add payment' : 'Record payment'}</DialogTitle>
						<DialogDescription>
							{edit ? 'The balance is recalculated when you save.' : paymentDescription(student, rate)}
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
						{edit && student !== null ? (
							<div className="flex min-w-0 flex-col gap-2">
								<span className="text-body text-muted-foreground">Student</span>
								<div className="flex min-w-0 items-center gap-2">
									<Avatar name={student.displayName} />
									<span className="min-w-0 flex-1 text-body wrap-anywhere text-foreground">{student.displayName}</span>
									<Lock aria-hidden className="size-4 shrink-0 text-muted-foreground" />
								</div>
								<p className="text-caption text-muted-foreground">A payment stays with its student.</p>
							</div>
						) : null}
						{preset === undefined ? <PaymentStudentPicker disabled={pending} onChoose={chooseStudent} /> : null}
						{failed ? (
							<Banner status="error">
								<BannerTitle>
									{edit ? 'Could not save the payment. Try again.' : 'Could not record the payment. Try again.'}
								</BannerTitle>
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
								onChange={(event) => changeAmount(event.target.value)}
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
								error={shown('date')}
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
								onChange={(event) => changeLessons(event.target.value)}
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
						{notice === 'changed' ? (
							<ReloadNotice
								status="warning"
								text="This payment changed elsewhere. Your draft has been kept. Reload the current details before saving."
								reloadLabel="Reload payment details"
								pending={reloading}
								onReload={() => void reload()}
							/>
						) : null}
						{notice === 'lost' ? (
							<ReloadNotice
								status="error"
								text="Could not confirm that the payment was saved. Reload the current details before saving again."
								reloadLabel="Reload payment details"
								pending={reloading}
								onReload={() => void reload()}
							/>
						) : null}
						{reloadFailed ? (
							<Banner status="error">
								<BannerTitle>Could not reload the payment. Try again.</BannerTitle>
							</Banner>
						) : null}
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
							{pending ? 'Saving…' : preset === undefined || edit ? 'Save payment' : 'Record payment'}
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
	note: string,
	date: string,
	today: string
): Partial<Record<Field, string>> {
	const errors: Partial<Record<Field, string>> = {}
	if (date === '') errors.date = 'Choose a date.'
	else if (date > today) errors.date = 'Choose today or an earlier date.'
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
	const balance =
		student.balanceMinutes === null ? 'Not set' : balancePhrase(student.balanceMinutes, student.defaultLessonMinutes)
	const price = rate === null ? 'No rate is set.' : `${formatMoney(rate.rateMinor, rate.currency)} per lesson.`
	return `${balance}, ${price}`
}
