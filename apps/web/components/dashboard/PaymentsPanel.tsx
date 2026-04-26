import { useState } from 'react'

import { ReceiptText, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDateShort, formatUsdAmount, selectPaymentLedger } from '@/lib/crm/model'

import type { Payment, Student, StudentBalance } from '@teacher-crm/api-types'

type PaymentsPanelProps = {
	payments: Payment[]
	students: Student[]
	studentBalances: StudentBalance[]
	now: Date
	onDeletePayment: (paymentId: string) => Promise<void>
	previewMode?: boolean
}

export function PaymentsPanel({
	payments,
	students,
	studentBalances,
	now,
	onDeletePayment,
	previewMode = false,
}: PaymentsPanelProps) {
	const ledger = selectPaymentLedger(payments, studentBalances, now)
	const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)

	async function handleDeletePayment(paymentId: string) {
		setDeletingPaymentId(paymentId)
		try {
			await onDeletePayment(paymentId)
		} finally {
			setDeletingPaymentId((current) => (current === paymentId ? null : current))
		}
	}

	return (
		<Card id="payments" className="flex flex-col overflow-hidden shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
			<CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-line-soft bg-surface-muted">
				<div>
					<p className="font-mono text-xs font-semibold text-sage uppercase">Cash control</p>
					<CardTitle className="mt-1 text-lg">Payment ledger</CardTitle>
					<p className="mt-1 text-sm text-ink-muted">Income and payment risk before recency.</p>
				</div>
				<ReceiptText className="h-5 w-5 text-sage" />
			</CardHeader>
			<CardContent className="flex h-full flex-col space-y-4 pt-5">
				<div className="grid gap-2 sm:grid-cols-[1.35fr_1fr]">
					<LedgerMetric label="Month income" value={formatUsdAmount(ledger.monthIncome)} tone="green" strong />
					<div className="grid gap-2">
						<LedgerMetric label="Paid this week" value={ledger.paidThisWeek} tone="neutral" />
						<LedgerMetric
							label="Overdue total"
							value={formatUsdAmount(ledger.overdueTotal)}
							tone={ledger.overdueTotal > 0 ? 'red' : 'green'}
						/>
					</div>
				</div>
				<ScrollArea className="h-full grow pr-3">
					<div className="space-y-2">
						{payments.map((payment) => {
							const student = students.find((item) => item.id === payment.studentId)
							return (
								<div
									key={payment.id}
									className="flex items-start justify-between gap-3 rounded-lg border border-line-soft bg-surface-muted p-3"
								>
									<div className="min-w-0">
										<p className="font-heading truncate text-sm font-medium text-ink">
											{student?.fullName ?? 'Unknown student'}
										</p>
										<p className="font-mono text-xs text-ink-muted tabular-nums">
											Paid {formatDateShort(payment.paidAt)}
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<Badge tone="green" className="font-mono tabular-nums">
											{formatUsdAmount(payment.amount)}
										</Badge>
										<Tooltip>
											<TooltipTrigger asChild>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="text-ink-muted hover:bg-danger-soft hover:text-danger"
													aria-label={`Delete payment for ${student?.fullName ?? 'unknown student'}`}
													disabled={previewMode || deletingPaymentId === payment.id}
													onClick={() => void handleDeletePayment(payment.id).catch(() => undefined)}
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</TooltipTrigger>
											<TooltipContent sideOffset={6}>Delete payment</TooltipContent>
										</Tooltip>
									</div>
								</div>
							)
						})}
						{payments.length === 0 && (
							<div className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-4">
								<p className="font-heading text-sm font-semibold text-ink">No payments recorded this month</p>
								<p className="mt-1 text-xs text-ink-muted">Record a payment when a student tops up a package.</p>
							</div>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	)
}

function LedgerMetric({
	label,
	value,
	tone,
	strong = false,
}: {
	label: string
	value: string | number
	tone: 'green' | 'red' | 'neutral'
	strong?: boolean
}) {
	return (
		<div className="rounded-lg border border-line-soft bg-surface-muted p-3">
			<p className="truncate text-xs font-medium text-ink-muted">{label}</p>
			<Badge
				tone={tone}
				className={strong ? 'mt-3 h-8 px-3 font-mono text-sm tabular-nums' : 'mt-2 font-mono tabular-nums'}
			>
				{value}
			</Badge>
		</div>
	)
}
