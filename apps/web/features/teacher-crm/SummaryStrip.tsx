import { AlertTriangle, CalendarCheck, DollarSign, Users } from 'lucide-react'

import { Card } from '@/components/ui/card'

import { formatMoney } from './model'
import type { TeacherCrmSummary } from './types'

const items = [
	{ key: 'activeStudents', label: 'Active students', icon: Users },
	{ key: 'todayLessons', label: 'Today lessons', icon: CalendarCheck },
	{ key: 'missingAttendance', label: 'Missing marks', icon: AlertTriangle },
	{ key: 'monthIncome', label: 'Month income', icon: DollarSign },
] as const

export function SummaryStrip({ summary }: { summary: TeacherCrmSummary }) {
	return (
		<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
			{items.map((item) => {
				const Icon = item.icon
				const rawValue = summary[item.key]
				const value = item.key === 'monthIncome' ? formatMoney(rawValue) : rawValue
				return (
					<Card key={item.key} className="p-4">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs font-medium uppercase tracking-normal text-zinc-500">{item.label}</p>
								<p className="mt-2 text-2xl font-semibold text-zinc-950">{value}</p>
							</div>
							<Icon className="h-5 w-5 text-sky-700" aria-hidden="true" />
						</div>
					</Card>
				)
			})}
		</section>
	)
}
