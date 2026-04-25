import { ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDateShort, formatUsdAmount, selectPaymentLedger } from '@/lib/crm/model'

import type { Payment, Student, StudentBalance } from '@teacher-crm/api-types'

type PaymentsPanelProps = {
	payments: Payment[]
	students: Student[]
	studentBalances: StudentBalance[]
	now: Date
}

export function PaymentsPanel({ payments, students, studentBalances, now }: PaymentsPanelProps) {
	const ledger = selectPaymentLedger(payments, studentBalances, now)

	return (
		<Card id="payments" className="border-line bg-surface rounded-lg shadow-none">
			<CardHeader className="border-line-soft flex flex-row items-center justify-between gap-3 border-b">
				<div>
					<CardTitle className="text-ink text-base">Payment ledger</CardTitle>
					<p className="text-ink-muted mt-1 text-sm">Income and payment risk before recency.</p>
				</div>
				<ReceiptText className="text-sage h-5 w-5" />
			</CardHeader>
			<CardContent className="space-y-4 pt-4">
				<div className="grid grid-cols-3 gap-2">
					<LedgerMetric label="Month income" value={formatUsdAmount(ledger.monthIncome)} tone="green" />
					<LedgerMetric label="Paid this week" value={ledger.paidThisWeek} tone="neutral" />
					<LedgerMetric
						label="Overdue total"
						value={formatUsdAmount(ledger.overdueTotal)}
						tone={ledger.overdueTotal > 0 ? 'red' : 'green'}
					/>
				</div>
				<ScrollArea className="max-h-70 pr-3">
					<div className="space-y-2">
						{payments.map((payment) => {
							const student = students.find((item) => item.id === payment.studentId)
							return (
								<div
									key={payment.id}
									className="border-line bg-surface-muted flex items-start justify-between gap-3 rounded-md border p-3"
								>
									<div className="min-w-0">
										<p className="text-ink truncate text-sm font-medium">{student?.fullName ?? 'Unknown student'}</p>
										<p className="text-ink-muted font-mono text-xs tabular-nums">
											Paid {formatDateShort(payment.paidAt)}
										</p>
									</div>
									<Badge tone="green" className="font-mono tabular-nums">
										{formatUsdAmount(payment.amount)}
									</Badge>
								</div>
							)
						})}
						{payments.length === 0 && (
							<div className="border-line-strong bg-surface-muted text-ink-muted rounded-md border border-dashed p-4 text-sm">
								No payments recorded this month.
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
}: {
	label: string
	value: string | number
	tone: 'green' | 'red' | 'neutral'
}) {
	return (
		<div className="border-line bg-surface-muted rounded-md border p-2">
			<p className="text-ink-muted truncate text-xs">{label}</p>
			<Badge tone={tone} className="mt-2 font-mono tabular-nums">
				{value}
			</Badge>
		</div>
	)
}
