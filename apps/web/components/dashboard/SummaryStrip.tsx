import { Banknote, CalendarCheck, ReceiptText, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatCurrencyTotals } from '@/lib/crm/model'
import type { TeacherCrmSummary } from '@/lib/crm/types'

const items = [
	{ key: 'activeStudents', label: 'Active students', icon: Users, tone: 'neutral' },
	{ key: 'todayLessons', label: 'Today lessons', icon: CalendarCheck, tone: 'accent' },
	{ key: 'overdueStudents', label: 'Overdue students', icon: ReceiptText, tone: 'danger' },
	{ key: 'monthIncome', label: 'Month income', icon: Banknote, tone: 'success' },
] as const

const toneClass = {
	neutral: 'border-line bg-surface-muted text-ink-muted',
	accent: 'border-sage-line bg-sage-soft text-sage',
	warning: 'border-warning-line bg-warning-soft text-warning',
	danger: 'border-danger-line bg-danger-soft text-danger',
	success: 'border-success-line bg-success-soft text-success',
}

const railClass = {
	neutral: 'bg-line-strong',
	accent: 'bg-sage',
	warning: 'bg-warning',
	danger: 'bg-danger',
	success: 'bg-success',
}

export function SummaryStrip({ summary }: { summary: TeacherCrmSummary }) {
	const attentionCount = summary.overdueStudents

	return (
		<section className="grid gap-3 xl:grid-cols-[1.25fr_2fr]" aria-label="Ledger summary">
			<div className="border-line bg-surface relative overflow-hidden rounded-lg border p-4 shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
				<span className={`absolute inset-y-0 left-0 w-1 ${attentionCount > 0 ? 'bg-warning' : 'bg-success'}`} />
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<p className="text-ink-muted text-[0.7rem] font-semibold uppercase">Operations pulse</p>
						<p className="text-ink mt-2 font-mono text-3xl font-semibold tabular-nums">{attentionCount}</p>
						<p className="text-ink-muted mt-1 text-sm">items need attention before the day is closed</p>
					</div>
					<Badge tone={attentionCount > 0 ? 'amber' : 'green'} className="h-7 px-2.5 font-mono tabular-nums">
						{summary.todayLessons} today
					</Badge>
				</div>
			</div>
			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{items
					.filter((item) => item.key !== 'todayLessons')
					.map((item) => {
						const Icon = item.icon
						const rawValue = summary[item.key]
						const value = item.key === 'monthIncome' ? formatCurrencyTotals(summary.monthIncomeByCurrency) : rawValue
						return (
							<div
								key={item.key}
								className="border-line bg-surface relative min-h-28 overflow-hidden rounded-lg border p-4 shadow-[0_14px_42px_-36px_var(--shadow-sage)]"
							>
								<span className={`absolute inset-x-0 top-0 h-1 ${railClass[item.tone]}`} />
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="text-ink-muted truncate text-[0.7rem] font-semibold uppercase">{item.label}</p>
										<p className="text-ink mt-3 truncate font-mono text-2xl font-semibold tabular-nums">{value}</p>
									</div>
									<span
										className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${toneClass[item.tone]}`}
									>
										<Icon className="h-4 w-4" aria-hidden="true" />
									</span>
								</div>
							</div>
						)
					})}
			</div>
		</section>
	)
}
