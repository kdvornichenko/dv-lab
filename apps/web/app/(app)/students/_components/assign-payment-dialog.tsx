'use client'

import { useRef, useState, type FormEvent } from 'react'

import {
	BalanceCaption,
	CurrencyField,
	MoneyText,
	SummaryRow,
	formatDay,
	lessonsHelper,
	rateOf,
} from '@/components/app/ledger-text'
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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { apiRequest } from '@/lib/api-client'

import type { PaymentResponse, PaymentRow, StudentDetail, StudentResponse, StudentRow } from '@dv-lab/contracts'
import { formatMoney, parseLessons } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { suggestLessonsText } from '../[id]/_components/record-payment-dialog'

interface AssignPaymentDialogProps {
	payment: PaymentRow
	students: StudentRow[]
	onClose: () => void
	onAssigned: () => void
	onFailed: () => void
}

export function AssignPaymentDialog({ payment, students, onClose, onAssigned, onFailed }: AssignPaymentDialogProps) {
	const toast = useToast()
	const [studentId, setStudentId] = useState('')
	const [detail, setDetail] = useState<StudentDetail | null>(null)
	const [currencyChoice, setCurrencyChoice] = useState<string | null>(null)
	const [lessonsDraft, setLessonsDraft] = useState<string | null>(null)
	const [touched, setTouched] = useState({ student: false, currency: false, lessons: false })
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const chosen = useRef('')
	const studentRef = useRef<HTMLButtonElement>(null)
	const currencyRef = useRef<HTMLButtonElement>(null)
	const lessonsRef = useRef<HTMLInputElement>(null)

	const selected = students.find((student) => student.id === studentId) ?? null
	const askCurrency = payment.currency === null
	const currency = payment.currency ?? currencyChoice ?? selected?.currency ?? ''
	const rate = selected === null ? null : rateOf(selected)
	const suggestion = suggestLessonsText(payment.amountMinor, currency, rate)
	const lessons = lessonsDraft ?? suggestion
	const prefilled = lessonsDraft === null && suggestion !== ''

	const studentError = studentId === '' ? 'Choose a student.' : undefined
	const currencyError = askCurrency && currency === '' ? 'Choose a currency.' : undefined
	const lessonsError =
		lessons.trim() !== '' && parseLessons(lessons) === null ? 'Enter 0 or more lessons, up to two decimals.' : undefined
	const show = (error: string | undefined, field: keyof typeof touched) =>
		submitted || touched[field] ? error : undefined

	async function chooseStudent(value: string) {
		setStudentId(value)
		setDetail(null)
		chosen.current = value
		const result = await apiRequest<StudentResponse>('GET', `/students/${value}`)
		if (result.ok && chosen.current === value) setDetail(result.data.student)
	}

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setSubmitted(true)
		setFailed(false)
		if (studentError) return studentRef.current?.focus()
		if (currencyError) return currencyRef.current?.focus()
		if (lessonsError) return lessonsRef.current?.focus()
		setPending(true)
		const result = await apiRequest<PaymentResponse>('POST', `/payments/${payment.id}/assign`, {
			studentId,
			currency: askCurrency ? currency : null,
			lessonsHundredths: lessons.trim() === '' ? null : parseLessons(lessons),
		})
		setPending(false)
		if (!result.ok) {
			setFailed(true)
			onFailed()
			return
		}
		toast.show({
			title: 'Payment assigned',
			description: `${formatMoney(payment.amountMinor, currency === '' ? null : currency)} is now on ${selected?.displayName ?? ''}'s card.`,
		})
		onAssigned()
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
						<DialogTitle>Assign payment</DialogTitle>
						<DialogDescription>Choose the student this payment belongs to.</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{failed ? (
							<Banner status="error">
								<BannerTitle>Could not assign the payment. Try again.</BannerTitle>
							</Banner>
						) : null}
						<div className="flex flex-col gap-2">
							<SummaryRow label="Date">{formatDay(payment.paidOn)}</SummaryRow>
							<SummaryRow label="Amount">
								<MoneyText amountMinor={payment.amountMinor} currency={payment.currency} />
							</SummaryRow>
							{payment.note === null ? null : <SummaryRow label="Note">{payment.note}</SummaryRow>}
						</div>
						<div className="flex min-w-0 flex-col gap-2">
							<label htmlFor="assign-payment-student" className="text-body text-muted-foreground">
								Student
							</label>
							<Select value={studentId} onValueChange={(value) => void chooseStudent(value)} disabled={pending}>
								<SelectTrigger
									ref={studentRef}
									id="assign-payment-student"
									className="w-full min-w-0"
									placeholder="Choose a student"
									autoFocus
									error={show(studentError, 'student')}
									onBlur={() => setTouched((current) => ({ ...current, student: true }))}
								/>
								<SelectContent>
									{students.map((student, index) => (
										<SelectItem key={student.id} index={index} value={student.id}>
											{student.displayName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid items-start gap-4 sm:grid-cols-2">
							{askCurrency ? (
								<CurrencyField
									id="assign-payment-currency"
									value={currency}
									onChange={setCurrencyChoice}
									onBlur={() => setTouched((current) => ({ ...current, currency: true }))}
									error={show(currencyError, 'currency')}
									disabled={pending}
									triggerRef={currencyRef}
								/>
							) : null}
							<TextField
								ref={lessonsRef}
								id="assign-payment-lessons"
								name="lessons"
								label="Lessons"
								inputMode="decimal"
								autoComplete="off"
								helper={lessonsHelper(prefilled)}
								value={lessons}
								onChange={(event) => setLessonsDraft(event.target.value)}
								onBlur={() => setTouched((current) => ({ ...current, lessons: true }))}
								disabled={pending}
								error={show(lessonsError, 'lessons')}
							/>
						</div>
						<BalanceCaption openingBalance={detail?.openingBalance} paidOn={payment.paidOn} />
					</div>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending}>
							{pending ? 'Assigning…' : 'Assign payment'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
