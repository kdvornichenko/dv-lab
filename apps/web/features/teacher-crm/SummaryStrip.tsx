import { AlertTriangle, CalendarCheck, DollarSign, ReceiptText, Users } from 'lucide-react'

import { Card } from '@/components/ui/card'

import { formatUsdAmount } from './model'
import type { TeacherCrmSummary } from './types'

const items = [
	{ key: 'activeStudents', label: 'Active students', icon: Users, tone: 'neutral' },
	{ key: 'todayLessons', label: 'Today lessons', icon: CalendarCheck, tone: 'accent' },
	{ key: 'missingAttendance', label: 'Missing marks', icon: AlertTriangle, tone: 'warning' },
	{ key: 'overdueStudents', label: 'Overdue students', icon: ReceiptText, tone: 'danger' },
	{ key: 'monthIncome', label: 'Month income', icon: DollarSign, tone: 'success' },
] as const

const toneClass = {
	neutral: 'text-[#6F6B63] bg-[#FBFAF6]',
	accent: 'text-[#2F6F5E] bg-[#E7F0EC]',
	warning: 'text-[#9A6A1F] bg-[#F7EEDF]',
	danger: 'text-[#A64235] bg-[#F8E9E6]',
	success: 'text-[#3F7A4D] bg-[#EEF5EF]',
}

export function SummaryStrip({ summary }: { summary: TeacherCrmSummary }) {
	return (
		<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Ledger summary">
			{items.map((item) => {
				const Icon = item.icon
				const rawValue = summary[item.key]
				const value = item.key === 'monthIncome' ? formatUsdAmount(rawValue) : rawValue
				return (
					<Card key={item.key} className="rounded-lg border-[#E6E0D4] bg-white p-4 shadow-none">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate text-xs font-medium uppercase text-[#6F6B63]">{item.label}</p>
								<p className="mt-2 truncate font-mono text-2xl font-semibold tabular-nums text-[#181713]">{value}</p>
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
