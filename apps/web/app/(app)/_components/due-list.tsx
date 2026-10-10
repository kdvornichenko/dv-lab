import Link from 'next/link'

import { StatusDot } from '@/components/app/status-dot'
import { balanceTone } from '@/components/app/student-balance'

import type { StudentRow } from '@dv-lab/contracts'
import { balancePhrase, balanceState } from '@dv-lab/core'

import { MoreRow, ROW_LIMIT } from './today-lessons'

interface DueListProps {
	students: readonly StudentRow[]
	threshold: number
	moreHref: string
}

export function DueList({ students, threshold, moreHref }: DueListProps) {
	const listed = students.flatMap((student) =>
		student.balanceMinutes === null ? [] : [{ student, minutes: student.balanceMinutes }]
	)
	return (
		<ul data-slot="due-list" className="flex flex-col px-1 pb-2">
			{listed.slice(0, ROW_LIMIT).map(({ student, minutes }) => {
				const tone = balanceTone(balanceState(minutes, student.defaultLessonMinutes, threshold))
				return (
					<li
						key={student.id}
						data-slot="due-row"
						data-student-id={student.id}
						className="relative flex h-8 items-center gap-3 rounded-lg px-3 hover:bg-hover"
					>
						<Link
							href={`/students/${student.id}`}
							data-slot="due-name"
							className="w-28 shrink-0 truncate rounded-sm text-body text-foreground outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-focus-ring"
						>
							{student.displayName}
						</Link>
						<span
							data-slot="due-balance"
							className="min-w-0 flex-1 truncate text-caption text-muted-foreground tabular-nums"
						>
							{balancePhrase(minutes, student.defaultLessonMinutes)}
						</span>
						<span className="relative z-10 flex size-6 shrink-0 items-center justify-center">
							{tone === null ? null : <StatusDot tone={tone.tone} label={tone.label} />}
						</span>
					</li>
				)
			})}
			{listed.length > ROW_LIMIT ? <MoreRow count={listed.length - ROW_LIMIT} href={moreHref} /> : null}
		</ul>
	)
}
