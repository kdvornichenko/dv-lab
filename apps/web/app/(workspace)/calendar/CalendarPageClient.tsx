'use client'

import type { FC } from 'react'

import { CalendarPanel } from '@/components/dashboard/CalendarPanel'
import { Badge } from '@/components/ui/badge'
import { TeacherCrmPageShell } from '@/components/workspace/TeacherCrmPageShell'
import { formatDateShort, lessonDisplayTitle } from '@/lib/crm/model'

import type { CalendarSyncPanelProps } from './CalendarPageClient.types'

export const CalendarPageClient: FC = () => {
	return (
		<TeacherCrmPageShell>
			{(crm) => (
				<div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
					<CalendarPanel
						connection={crm.state.calendarConnection}
						calendarOptions={crm.calendarOptions}
						syncRecords={crm.state.calendarSyncRecords}
						onConnect={crm.connectCalendar}
						onSelectCalendar={crm.selectCalendar}
					/>
					<CalendarSyncPanel
						syncRecords={crm.state.calendarSyncRecords}
						lessonTitles={
							new Map(crm.state.lessons.map((lesson) => [lesson.id, lessonDisplayTitle(lesson, crm.state.students)]))
						}
					/>
				</div>
			)}
		</TeacherCrmPageShell>
	)
}

const CalendarSyncPanel: FC<CalendarSyncPanelProps> = ({ syncRecords, lessonTitles }) => {
	const visibleRecords = syncRecords.filter((record) => record.status !== 'synced')

	return (
		<section className="border-line bg-surface rounded-lg border p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<p className="text-sage font-mono text-xs font-semibold uppercase">Event ledger</p>
			<h2 className="text-ink mt-1 text-lg font-semibold">Calendar sync records</h2>
			<div className="mt-4 grid gap-2">
				{visibleRecords.map((record) => (
					<div key={record.id} className="border-line-soft bg-surface-muted rounded-lg border p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="font-heading text-ink truncate text-sm font-semibold">
									{lessonTitles.get(record.lessonId) ?? 'Unknown lesson'}
								</p>
								<p className="text-ink-muted mt-1 font-mono text-xs tabular-nums">
									Updated {formatDateShort(record.updatedAt)}
								</p>
								{record.lastError && <p className="text-danger mt-1 truncate text-xs">{record.lastError}</p>}
							</div>
							<div className="flex shrink-0 items-center gap-2">
								<Badge
									tone={record.status === 'synced' ? 'green' : record.status === 'failed' ? 'red' : 'neutral'}
									className="font-mono tabular-nums"
								>
									{record.status}
								</Badge>
							</div>
						</div>
					</div>
				))}
				{visibleRecords.length === 0 && (
					<div className="border-line-strong bg-surface-muted rounded-lg border border-dashed p-4">
						<p className="font-heading text-ink text-sm font-semibold">No calendar sync issues</p>
						<p className="text-ink-muted mt-1 text-xs">Lessons are synced automatically after schedule changes.</p>
					</div>
				)}
			</div>
		</section>
	)
}
