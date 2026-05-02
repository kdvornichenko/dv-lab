import type { FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { formatCurrencyTotals } from '@/lib/crm/model'

import type { FocusPanelProps } from './TeacherDashboard.types'

export const FocusPanel: FC<FocusPanelProps> = ({
	overdueStudents,
	atRiskStudent,
	monthIncomeByCurrency,
	todayLessonCount,
	cancelledToday,
}) => {
	return (
		<section className="border-line bg-surface rounded-lg border p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<p className="text-sage font-mono text-xs font-semibold uppercase">Focus</p>
			<h2 className="text-ink mt-1 text-lg font-semibold">Payment and schedule pressure</h2>
			<div className="mt-4 grid gap-3">
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<p className="text-ink-muted text-xs font-medium">Today load</p>
					<p className="text-ink mt-1 font-mono text-2xl font-semibold tabular-nums">{todayLessonCount}</p>
				</div>
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-ink-muted text-xs font-medium">Cancelled today</p>
						<Badge tone={cancelledToday > 0 ? 'amber' : 'green'} className="font-mono tabular-nums">
							{cancelledToday}
						</Badge>
					</div>
				</div>
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<p className="text-ink-muted text-xs font-medium">Month income</p>
					<p className="text-ink mt-1 font-mono text-2xl font-semibold tabular-nums">
						{formatCurrencyTotals(monthIncomeByCurrency)}
					</p>
				</div>
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-ink-muted text-xs font-medium">Payment risk</p>
						<Badge tone={overdueStudents > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
							{overdueStudents}
						</Badge>
					</div>
					<p className="font-heading text-ink mt-2 truncate text-sm font-semibold">
						{atRiskStudent ?? 'No overdue student'}
					</p>
				</div>
			</div>
		</section>
	)
}
