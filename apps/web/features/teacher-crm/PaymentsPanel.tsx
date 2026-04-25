import { ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

import type { Payment, Student, StudentBalance } from '@teacher-crm/api-types'

import { formatDateShort, formatUsdAmount, selectPaymentLedger } from './model'

type PaymentsPanelProps = {
	payments: Payment[]
	students: Student[]
	studentBalances: StudentBalance[]
	now: Date
}

export function PaymentsPanel({ payments, students, studentBalances, now }: PaymentsPanelProps) {
	const ledger = selectPaymentLedger(payments, studentBalances, now)

	return (
		<Card id="payments" className="rounded-lg border-[#E6E0D4] bg-white shadow-none">
			<CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[#EFE8DC]">
				<div>
					<CardTitle className="text-base text-[#181713]">Payment ledger</CardTitle>
					<p className="mt-1 text-sm text-[#6F6B63]">Income and payment risk before recency.</p>
				</div>
				<ReceiptText className="h-5 w-5 text-[#2F6F5E]" />
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
				<ScrollArea className="max-h-[280px] pr-3">
					<div className="space-y-2">
						{payments.map((payment) => {
							const student = students.find((item) => item.id === payment.studentId)
							return (
								<div
									key={payment.id}
									className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-[#E6E0D4] bg-[#FBFAF6] p-3"
								>
									<div className="min-w-0">
										<p className="truncate text-sm font-medium text-[#181713]">
											{student?.fullName ?? 'Unknown student'}
										</p>
										<p className="font-mono text-xs tabular-nums text-[#6F6B63]">
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
							<div className="rounded-md border border-dashed border-[#D8D0C2] bg-[#FBFAF6] p-4 text-sm text-[#6F6B63]">
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
		<div className="rounded-md border border-[#E6E0D4] bg-[#FBFAF6] p-2">
			<p className="truncate text-xs text-[#6F6B63]">{label}</p>
			<Badge tone={tone} className="mt-2 font-mono tabular-nums">
				{value}
			</Badge>
		</div>
	)
}
