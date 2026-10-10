import type { Ref, ReactNode } from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'

import { CURRENCIES, type PaymentRow, type StudentDetail } from '@dv-lab/contracts'
import { countsAfterOpening, currencySymbol, formatHundredths, formatMoney } from '@dv-lab/core'

interface MoneyTextProps {
	amountMinor: number
	currency: string | null
}

export function MoneyText({ amountMinor, currency }: MoneyTextProps) {
	if (currency === null) {
		return (
			<span className="tabular-nums">
				{formatMoney(amountMinor, null)}
				<span className="text-muted-foreground"> No currency</span>
			</span>
		)
	}
	return <span className="tabular-nums">{formatMoney(amountMinor, currency)}</span>
}

const dayFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' })

export function formatDay(value: string) {
	return dayFormat.format(new Date(`${value}T00:00:00Z`))
}

export function DateText({ value }: { value: string }) {
	return <span className="tabular-nums">{formatDay(value)}</span>
}

export function describePayment(payment: Pick<PaymentRow, 'amountMinor' | 'currency' | 'paidOn'>) {
	return `${formatMoney(payment.amountMinor, payment.currency)} on ${formatDay(payment.paidOn)}`
}

export function PaymentLessonsText({ hundredths }: { hundredths: number | null }) {
	if (hundredths === null) return <span className="text-muted-foreground">Not counted</span>
	return <span className="tabular-nums">{formatHundredths(hundredths)}</span>
}

export function PaymentNoteText({ note }: { note: string | null }) {
	if (note === null) return <span className="text-muted-foreground">—</span>
	return <span className="wrap-anywhere">{note}</span>
}

export interface Rate {
	rateMinor: number
	currency: string
}

export function rateOf(student: { rateMinor: number | null; currency: string | null }): Rate | null {
	if (student.rateMinor === null || student.currency === null) return null
	return { rateMinor: student.rateMinor, currency: student.currency }
}

export function lessonsHelper(prefilled: boolean) {
	return prefilled
		? 'Amount divided by the rate. Edit it if the payment covers a different number of lessons.'
		: 'Leave empty if you have not counted the lessons yet.'
}

function balanceCaption(openingBalance: StudentDetail['openingBalance'] | undefined, paidOn: string) {
	if (openingBalance === undefined) return null
	if (openingBalance === null) {
		return 'The opening balance is not set, so this payment does not change the balance yet.'
	}
	if (!countsAfterOpening(paidOn, openingBalance.on)) {
		return `This date is on or before ${formatDay(openingBalance.on)}, so these lessons are already counted and will not change the balance.`
	}
	return null
}

export function BalanceCaption({
	openingBalance,
	paidOn,
}: {
	openingBalance: StudentDetail['openingBalance'] | undefined
	paidOn: string
}) {
	const text = balanceCaption(openingBalance, paidOn)
	return text === null ? null : <p className="text-caption text-muted-foreground">{text}</p>
}

export function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex h-9 items-center gap-2 rounded-lg bg-hover px-2">
			<span className="w-16 shrink-0 text-body text-muted-foreground">{label}</span>
			<span className="min-w-0 flex-1 truncate text-body text-foreground">{children}</span>
		</div>
	)
}

interface CurrencyFieldProps {
	id: string
	value: string
	onChange: (value: string) => void
	onBlur?: () => void
	error?: string
	helper?: string
	disabled?: boolean
	triggerRef?: Ref<HTMLButtonElement>
}

export function CurrencyField({
	id,
	value,
	onChange,
	onBlur,
	error,
	helper,
	disabled,
	triggerRef,
}: CurrencyFieldProps) {
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<label htmlFor={id} className="text-body text-muted-foreground">
				Currency
			</label>
			<Select value={value} onValueChange={onChange} disabled={disabled}>
				<SelectTrigger
					ref={triggerRef}
					id={id}
					className="w-full min-w-0"
					placeholder="Choose a currency"
					error={error}
					aria-describedby={helper ? `${id}-helper` : undefined}
					onBlur={onBlur}
				/>
				<SelectContent>
					{CURRENCIES.map((code, index) => (
						<SelectItem key={code} index={index} value={code}>
							{`${code} ${currencySymbol(code)}`}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{helper && !error ? (
				<p id={`${id}-helper`} className="text-caption text-muted-foreground">
					{helper}
				</p>
			) : null}
		</div>
	)
}
