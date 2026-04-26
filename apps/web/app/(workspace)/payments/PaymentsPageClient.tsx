'use client'

import { PaymentsPanel } from '@/components/dashboard/PaymentsPanel'
import { TeacherCrmPageShell } from '@/components/workspace/TeacherCrmPageShell'

export function PaymentsPageClient() {
	return (
		<TeacherCrmPageShell>
			{(crm, now) => (
				<PaymentsPanel
					payments={crm.state.payments}
					students={crm.state.students}
					studentBalances={crm.state.studentBalances}
					now={now}
					onDeletePayment={crm.deletePayment}
				/>
			)}
		</TeacherCrmPageShell>
	)
}
