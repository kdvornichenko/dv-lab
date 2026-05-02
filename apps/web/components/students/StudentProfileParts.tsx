import type { FC } from 'react'

import type { Lesson } from '@teacher-crm/api-types'

import type { ProfileMetricProps, ProfileMetricTone, ProfileRowProps } from './StudentProfilePane.types'

export function lessonStatusTone(status: Lesson['status']) {
	if (status === 'completed') return 'green'
	if (status === 'no_show') return 'amber'
	if (status === 'rescheduled') return 'amber'
	if (status === 'cancelled') return 'red'
	return 'neutral'
}

const metricToneClass: Record<ProfileMetricTone, string> = {
	sage: 'border-sage-line bg-sage-soft text-sage',
	success: 'border-success-line bg-success-soft text-success',
	warning: 'border-warning-line bg-warning-soft text-warning',
	danger: 'border-danger-line bg-danger-soft text-danger',
}

export const ProfileMetric: FC<ProfileMetricProps> = ({ icon: Icon, label, value, tone }) => {
	return (
		<div className="border-line-soft bg-surface rounded-lg border p-3">
			<div className="text-ink-muted flex items-center gap-1.5 text-xs font-medium">
				<span className={`flex size-6 items-center justify-center rounded-md border ${metricToneClass[tone]}`}>
					<Icon className="h-3.5 w-3.5" />
				</span>
				{label}
			</div>
			<div className="text-ink mt-2 truncate font-mono text-sm font-semibold tabular-nums">{value}</div>
		</div>
	)
}

export const ProfileRow: FC<ProfileRowProps> = ({ icon: Icon, label, value, multiline = false }) => {
	return (
		<div className="py-3 first:pt-0 last:pb-0">
			<div className="text-ink-muted mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase">
				<Icon className="text-sage h-3.5 w-3.5" />
				{label}
			</div>
			<p data-private className={multiline ? 'text-ink whitespace-pre-wrap leading-5' : 'text-ink truncate'}>
				{value}
			</p>
		</div>
	)
}
