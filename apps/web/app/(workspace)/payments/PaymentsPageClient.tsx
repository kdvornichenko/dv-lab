'use client'

import type { FC } from 'react'

import { PaymentsPanel } from '@/components/dashboard/PaymentsPanel'
import { TeacherCrmPageShell } from '@/components/workspace/TeacherCrmPageShell'

export const PaymentsPageClient: FC = () => {
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
