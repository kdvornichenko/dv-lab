'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyLine } from '@/components/app/empty-line'
import { DateText, MoneyText, PaymentLessonsText, PaymentNoteText, describePayment } from '@/components/app/ledger-text'
import { ReadError } from '@/components/app/read-error'
import { Button } from '@/components/ui/button'
import { SkeletonTable } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'

import type { PaymentRow, PaymentsResponse, StudentRow } from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'
import { AssignPaymentDialog } from './assign-payment-dialog'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; payments: PaymentRow[] }

async function readUnassigned(): Promise<ReadState> {
	const result = await apiRequest<PaymentsResponse>('GET', '/payments/unassigned')
	return result.ok ? { kind: 'ready', payments: result.data.payments } : { kind: 'error' }
}

const headClass = 'px-4 text-body font-normal text-muted-foreground'
const cellClass = 'px-4 py-2 align-top text-body'

interface UnassignedPaymentsProps {
	students: StudentRow[]
	onChanged: () => void
}

export function UnassignedPayments({ students, onChanged }: UnassignedPaymentsProps) {
	const toast = useToast()
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [assigning, setAssigning] = useState<PaymentRow | null>(null)
	const [removing, setRemoving] = useState<PaymentRow | null>(null)

	const load = useCallback(async () => {
		setState(await readUnassigned())
	}, [])

	useEffect(() => {
		let current = true
		void readUnassigned().then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [])

	async function remove(payment: PaymentRow) {
		const result = await apiRequest<undefined>('DELETE', `/payments/${payment.id}`)
		if (!result.ok) {
			if (result.status === 404) void load()
			return false
		}
		toast.show({ title: 'Payment deleted', description: 'The payment was removed.' })
		setRemoving(null)
		await load()
		onChanged()
		return true
	}

	let body: ReactNode
	if (state.kind === 'loading') body = <SkeletonTable />
	else if (state.kind === 'error') body = <ReadError screen="payments" onRefresh={load} />
	else if (state.payments.length === 0) body = <EmptyLine />
	else {
		body = (
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
									<MoneyText amountMinor={payment.amountMinor} currency={payment.currency} />
								</TableCell>
								<TableCell className={cellClass}>
									<PaymentLessonsText hundredths={payment.lessonsHundredths} />
								</TableCell>
								<TableCell className={`${cellClass} min-w-64 whitespace-normal`}>
									<PaymentNoteText note={payment.note} />
								</TableCell>
								<TableCell className={cellClass}>
									<div className="flex items-center justify-end gap-2">
										<Button
											variant="secondary"
											size="compact"
											aria-label={`Assign payment of ${describePayment(payment)}`}
											onClick={() => setAssigning(payment)}
										>
											Assign
										</Button>
										<Tooltip content="Delete payment">
											<Button
												variant="ghost"
												size="icon-compact"
												aria-label="Delete payment"
												onClick={() => setRemoving(payment)}
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
		)
	}

	return (
		<>
			{body}
			{assigning ? (
				<AssignPaymentDialog
					payment={assigning}
					students={students}
					onClose={() => setAssigning(null)}
					onAssigned={() => {
						setAssigning(null)
						void load()
						onChanged()
					}}
					onFailed={() => {
						void load()
						onChanged()
					}}
				/>
			) : null}
			{removing ? (
				<ConfirmDialog
					title="Delete this payment?"
					body={`${describePayment(removing)} will be removed. This cannot be undone in the app.`}
					cancelLabel="Keep payment"
					confirmLabel="Delete payment"
					pendingLabel="Deleting…"
					tone="destructive"
					failureText="Could not delete the payment. Try again."
					onConfirm={() => remove(removing)}
					onClose={() => setRemoving(null)}
				/>
			) : null}
		</>
	)
}
