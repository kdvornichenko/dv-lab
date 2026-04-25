import { ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { formatMoney } from './model'
import type { TeacherCrmState } from './types'

export function PaymentsPanel({ state }: { state: TeacherCrmState }) {
	return (
		<Card id="payments">
			<CardHeader className="flex flex-row items-center justify-between gap-3">
				<CardTitle>Recent Payments</CardTitle>
				<ReceiptText className="h-5 w-5 text-sky-700" />
			</CardHeader>
			<CardContent className="space-y-3">
				{state.payments.map((payment) => {
					const student = state.students.find((item) => item.id === payment.studentId)
					return (
						<div
							key={payment.id}
							className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3"
						>
							<div className="min-w-0">
								<p className="truncate text-sm font-medium text-zinc-950">{student?.fullName ?? 'Unknown student'}</p>
								<p className="text-xs text-zinc-500">{new Date(payment.paidAt).toLocaleDateString('en-US')}</p>
							</div>
							<Badge tone="green">{formatMoney(payment.amount)}</Badge>
						</div>
					)
				})}
			</CardContent>
		</Card>
	)
}
