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
import { apiRequest } from '@/lib/api-client'

import type { PaymentResponse, PaymentRow, StudentDetail } from '@dv-lab/contracts'
import { formatMoney, parseLessons } from '@dv-lab/core'

import { useToast } from '../../../_components/toasts'
import { suggestLessonsText } from './record-payment-dialog'

interface SetCurrencyDialogProps {
	student: StudentDetail
	payment: PaymentRow
	onClose: () => void
	onSaved: () => void
}

export function SetCurrencyDialog({ student, payment, onClose, onSaved }: SetCurrencyDialogProps) {
	const toast = useToast()
	const rate = rateOf(student)
	const [currency, setCurrency] = useState('')
	const [lessonsDraft, setLessonsDraft] = useState<string | null>(null)
	const [touched, setTouched] = useState({ currency: false, lessons: false })
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const currencyRef = useRef<HTMLButtonElement>(null)
	const lessonsRef = useRef<HTMLInputElement>(null)

	const suggestion = suggestLessonsText(payment.amountMinor, currency, rate)
	const lessons = lessonsDraft ?? suggestion
	const prefilled = lessonsDraft === null && suggestion !== ''

	const currencyError = currency === '' ? 'Choose a currency.' : undefined
	const lessonsError =
		lessons.trim() !== '' && parseLessons(lessons) === null ? 'Enter 0 or more lessons, up to two decimals.' : undefined
	const shownCurrency = submitted || touched.currency ? currencyError : undefined
	const shownLessons = submitted || touched.lessons ? lessonsError : undefined

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (pending) return
		setSubmitted(true)
		setFailed(false)
		if (currencyError) return currencyRef.current?.focus()
		if (lessonsError) return lessonsRef.current?.focus()
		setPending(true)
		const result = await apiRequest<PaymentResponse>('POST', `/payments/${payment.id}/assign`, {
			studentId: student.id,
			currency,
			lessonsHundredths: lessons.trim() === '' ? null : parseLessons(lessons),
		})
		setPending(false)
		if (!result.ok) {
			setFailed(true)
			return
		}
		toast.show({
			title: 'Currency set',
			description: `${formatMoney(payment.amountMinor, currency)} on ${student.displayName}'s card.`,
		})
		onSaved()
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="sm">
				<form noValidate onSubmit={onSubmit}>
					<DialogHeader>
						<DialogTitle>Set currency</DialogTitle>
						<DialogDescription>
							This payment came from the vault without a currency. Choose the one it was paid in.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						{failed ? (
							<Banner status="error">
								<BannerTitle>Could not save the currency. Try again.</BannerTitle>
							</Banner>
						) : null}
						<div className="flex flex-col gap-2">
							<SummaryRow label="Date">{formatDay(payment.paidOn)}</SummaryRow>
							<SummaryRow label="Amount">
								<MoneyText amountMinor={payment.amountMinor} currency={null} />
							</SummaryRow>
						</div>
						<CurrencyField
							id="set-currency-currency"
							value={currency}
							onChange={setCurrency}
							onBlur={() => setTouched((current) => ({ ...current, currency: true }))}
							error={shownCurrency}
							helper={
								rate === null
									? undefined
									: `This student's rate is in ${rate.currency}. The currency is not guessed from the amount.`
							}
							disabled={pending}
							triggerRef={currencyRef}
						/>
						<TextField
							ref={lessonsRef}
							id="set-currency-lessons"
							name="lessons"
							label="Lessons"
							inputMode="decimal"
							autoComplete="off"
							helper={lessonsHelper(prefilled)}
							value={lessons}
							onChange={(event) => setLessonsDraft(event.target.value)}
							onBlur={() => setTouched((current) => ({ ...current, lessons: true }))}
							disabled={pending}
							error={shownLessons}
						/>
						<BalanceCaption openingBalance={student.openingBalance} paidOn={payment.paidOn} />
					</div>
					<DialogFooter>
						<Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
							Discard changes
						</Button>
						<Button type="submit" loading={pending}>
							{pending ? 'Saving…' : 'Save currency'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
