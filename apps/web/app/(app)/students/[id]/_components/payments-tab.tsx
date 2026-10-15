'use client'

import { useCallback, useEffect, useState } from 'react'

import { Pencil, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyLine } from '@/components/app/empty-line'
import { DateText, MoneyText, PaymentLessonsText, PaymentNoteText, describePayment } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonLine, SkeletonTable, type SkeletonTableColumn } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'

import type { PaymentRow, PaymentsResponse, StudentDetail } from '@dv-lab/contracts'
import { formatMoney } from '@dv-lab/core'

import { useToast } from '../../../_components/toasts'
import { OpeningBalanceRow } from './opening-balance-panel'
import { RecordPaymentDialog } from './record-payment-dialog'
import { SetCurrencyDialog } from './set-currency-dialog'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; payments: PaymentRow[] }

async function readPayments(studentId: string): Promise<ReadState> {
	const result = await apiRequest<PaymentsResponse>('GET', `/payments?student=${studentId}`)
	return result.ok ? { kind: 'ready', payments: result.data.payments } : { kind: 'error' }
}

const headClass = 'px-4 text-body font-normal text-muted-foreground'
const cellClass = 'px-4 py-2 align-top text-body'
const skeletonColumns: SkeletonTableColumn[] = [
	{ title: 'Date', cellClassName: 'align-top', cell: <SkeletonLine className="w-20" /> },
	{ title: 'Amount', cellClassName: 'align-top', cell: <SkeletonLine className="w-16" /> },
	{ title: 'Lessons', cellClassName: 'align-top', cell: <SkeletonLine className="w-10" /> },
	{ title: 'Note', cellClassName: 'min-w-64 align-top', cell: <SkeletonLine className="w-40" /> },
	{
		title: <span className="sr-only">Actions</span>,
		cellClassName: 'align-top',
		cell: (
			<div className="flex h-7 items-center justify-end gap-1">
				<Skeleton className="size-5 rounded-md" />
				<Skeleton className="size-5 rounded-md" />
			</div>
		),
	},
]

function totalsText(payments: PaymentRow[]) {
	const sums = new Map<string, number>()
	for (const payment of payments) {
		if (payment.currency !== null) sums.set(payment.currency, (sums.get(payment.currency) ?? 0) + payment.amountMinor)
	}
	return Array.from(sums, ([code, sum]) => formatMoney(sum, code)).join(' + ')
}

function Toolbar({ payments }: { payments: PaymentRow[] }) {
	const uncurrenced = payments.filter((payment) => payment.currency === null).length
	const totals = totalsText(payments)
	const count = payments.length === 1 ? '1 payment' : `${payments.length} payments`
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center justify-between gap-2">
				<p className="text-body text-foreground tabular-nums">{totals === '' ? count : `${count}, ${totals}`}</p>
			</div>
			{uncurrenced > 0 ? (
				<p className="text-caption text-muted-foreground">
					{uncurrenced === 1
						? '1 payment has no currency and is not totalled.'
						: `${uncurrenced} payments have no currency and are not totalled.`}
				</p>
			) : null}
		</div>
	)
}

const GONE_TEXT = 'This record is no longer available. Open the current records to continue.'
const CHANGED_TEXT = 'This payment changed elsewhere. Reload the page and try again.'

interface PaymentsTabProps {
	student: StudentDetail
	mainTimeZone: string
	asOf: string
	refreshKey: number
	openPaymentId: string | null
	onOpened: () => void
	onChanged: () => void
	openingRequested: boolean
	onOpeningOpened: () => void
}

export function PaymentsTab({
	student,
	mainTimeZone,
	asOf,
	refreshKey,
	openPaymentId,
	onOpened,
	onChanged,
	openingRequested,
	onOpeningOpened,
}: PaymentsTabProps) {
	const toast = useToast()
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [removing, setRemoving] = useState<PaymentRow | null>(null)
	const [removeFailure, setRemoveFailure] = useState<string | null>(null)
	const [currencyFor, setCurrencyFor] = useState<PaymentRow | null>(null)
	const [editing, setEditing] = useState<PaymentRow | null>(null)
	const [missing, setMissing] = useState(false)
	const [handled, setHandled] = useState<string | null>(null)

	const load = useCallback(async () => {
		setState(await readPayments(student.id))
	}, [student.id])

	useEffect(() => {
		let current = true
		void readPayments(student.id).then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [student.id, refreshKey])

	if (openPaymentId !== null && handled !== openPaymentId && state.kind === 'ready') {
		setHandled(openPaymentId)
		const found = state.payments.find((payment) => payment.id === openPaymentId)
		if (found) setEditing(found)
		else setMissing(true)
	}

	useEffect(() => {
		if (openPaymentId !== null && handled === openPaymentId) onOpened()
	}, [openPaymentId, handled, onOpened])

	async function remove(payment: PaymentRow) {
		const result = await apiRequest<undefined>('DELETE', `/payments/${payment.id}`, {
			expectedRevision: payment.revision,
		})
		if (!result.ok && result.status !== 404) {
			setRemoveFailure(result.error?.code === 'precondition_failed' ? CHANGED_TEXT : null)
			return false
		}
		if (result.ok) toast.show({ title: 'Payment deleted', description: 'The balance was recalculated.' })
		setRemoving(null)
		await load()
		onChanged()
		return true
	}

	function closeEdit(payment: PaymentRow) {
		setEditing(null)
		requestAnimationFrame(() => document.getElementById(`edit-payment-${payment.id}`)?.focus())
	}

	function closeCurrency(payment: PaymentRow) {
		setCurrencyFor(null)
		requestAnimationFrame(() => document.getElementById(`set-currency-${payment.id}`)?.focus())
	}

	const openingRow = (
		<OpeningBalanceRow
			key="opening-balance"
			student={student}
			mainTimeZone={mainTimeZone}
			asOf={asOf}
			openRequested={openingRequested}
			onOpened={onOpeningOpened}
			onChanged={onChanged}
		/>
	)
	if (state.kind === 'loading')
		return (
			<div className="flex flex-col gap-4">
				{openingRow}
				<SkeletonLine box="h-5" className="w-36" />
				<SkeletonTable columns={skeletonColumns} />
			</div>
		)
	if (state.kind === 'error')
		return (
			<div className="flex flex-col gap-4">
				{openingRow}
				<ReadError screen="payments" onRefresh={load} />
			</div>
		)
	const goneRow = missing ? (
		<Banner status="info" role="alert" dismissible onDismiss={() => setMissing(false)}>
			<BannerTitle>{GONE_TEXT}</BannerTitle>
		</Banner>
	) : null
	if (state.payments.length === 0)
		return (
			<div className="flex flex-col gap-4">
				{goneRow}
				{openingRow}
				<EmptyLine />
			</div>
		)

	return (
		<div className="flex flex-col gap-4">
			{goneRow}
			{openingRow}
			<Toolbar payments={state.payments} />
			<Elevated offset={1} shadowLevel={2} className="w-0 min-w-full overflow-hidden rounded-2xl">
				<Table className="text-body">
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className={headClass}>Date</TableHead>
							<TableHead className={headClass}>Amount</TableHead>
							<TableHead className={headClass}>Lessons</TableHead>
							<TableHead className={headClass}>Note</TableHead>
							<TableHead className={headClass}>
								<span className="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{state.payments.map((payment) => (
							<TableRow key={payment.id}>
								<TableCell className={cellClass}>
									<DateText value={payment.paidOn} />
								</TableCell>
								<TableCell className={cellClass}>
									<div className="flex flex-wrap items-center gap-2">
										<MoneyText amountMinor={payment.amountMinor} currency={payment.currency} />
										{payment.currency === null ? (
											<Button
												id={`set-currency-${payment.id}`}
												variant="secondary"
												size="compact"
												aria-label={`Set currency for the payment of ${describePayment(payment)}`}
												onClick={() => setCurrencyFor(payment)}
											>
												Set currency
											</Button>
										) : null}
									</div>
								</TableCell>
								<TableCell className={cellClass}>
									<PaymentLessonsText hundredths={payment.lessonsHundredths} />
								</TableCell>
								<TableCell className={`${cellClass} min-w-64 whitespace-normal`}>
									<PaymentNoteText note={payment.note} />
								</TableCell>
								<TableCell className={cellClass}>
									<div className="flex justify-end gap-1 pointer-coarse:gap-4">
										<Tooltip content="Edit payment">
											<Button
												id={`edit-payment-${payment.id}`}
												variant="ghost"
												size="icon-compact"
												aria-label={`Edit payment of ${describePayment(payment)}`}
												onClick={() => setEditing(payment)}
											>
												<Pencil />
											</Button>
										</Tooltip>
										<Tooltip content="Delete payment">
											<Button
												variant="ghost"
												size="icon-compact"
												aria-label={`Delete payment of ${describePayment(payment)}`}
												onClick={() => {
													setRemoveFailure(null)
													setRemoving(payment)
												}}
											>
												<Trash2 />
											</Button>
										</Tooltip>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Elevated>
			{removing ? (
				<ConfirmDialog
					title="Delete this payment?"
					body={`${describePayment(removing)} will be removed and the balance recalculated. This cannot be undone in the app.`}
					cancelLabel="Keep payment"
					confirmLabel="Delete payment"
					pendingLabel="Deleting…"
					tone="destructive"
					failureText={removeFailure ?? 'Could not delete the payment. Try again.'}
					onConfirm={() => remove(removing)}
					onClose={() => setRemoving(null)}
				/>
			) : null}
			{editing ? (
				<RecordPaymentDialog
					student={student}
					payment={editing}
					mainTimeZone={mainTimeZone}
					currentMainTimeZone={mainTimeZone}
					asOf={asOf}
					onClose={() => closeEdit(editing)}
					onViewPayments={() => {
						closeEdit(editing)
						void load()
					}}
					onRefresh={() => {
						setEditing(null)
						onChanged()
					}}
					onRecorded={() => {
						closeEdit(editing)
						void load()
						onChanged()
					}}
				/>
			) : null}
			{currencyFor ? (
				<SetCurrencyDialog
					student={student}
					payment={currencyFor}
					onClose={() => closeCurrency(currencyFor)}
					onSaved={() => {
						setCurrencyFor(null)
						void load()
						onChanged()
					}}
				/>
			) : null}
		</div>
	)
}
