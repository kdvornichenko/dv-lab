import { AlertTriangle, CalendarCheck, DollarSign, ReceiptText, Users } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatUsdAmount } from '@/lib/crm/model'
import type { TeacherCrmSummary } from '@/lib/crm/types'

const items = [
	{ key: 'activeStudents', label: 'Active students', icon: Users, tone: 'neutral' },
	{ key: 'todayLessons', label: 'Today lessons', icon: CalendarCheck, tone: 'accent' },
	{ key: 'missingAttendance', label: 'Missing marks', icon: AlertTriangle, tone: 'warning' },
	{ key: 'overdueStudents', label: 'Overdue students', icon: ReceiptText, tone: 'danger' },
	{ key: 'monthIncome', label: 'Month income', icon: DollarSign, tone: 'success' },
] as const

const toneClass = {
	neutral: 'text-ink-muted bg-surface-muted',
	accent: 'text-sage bg-sage-soft',
	warning: 'text-warning bg-warning-soft',
	danger: 'text-danger bg-danger-soft',
	success: 'text-success bg-success-soft',
}

export function SummaryStrip({ summary }: { summary: TeacherCrmSummary }) {
	return (
		<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Ledger summary">
			{items.map((item) => {
				const Icon = item.icon
				const rawValue = summary[item.key]
				const value = item.key === 'monthIncome' ? formatUsdAmount(rawValue) : rawValue
				return (
					<Card key={item.key} className="border-line bg-surface rounded-lg p-4 shadow-none">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="text-ink-muted truncate text-xs font-medium uppercase">{item.label}</p>
								<p className="text-ink mt-2 truncate font-mono text-2xl font-semibold tabular-nums">{value}</p>
							</div>
							<span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${toneClass[item.tone]}`}>
								<Icon className="h-4 w-4" aria-hidden="true" />
							</span>
						</div>
					</Card>
				)
			})}
		</section>
	)
}
