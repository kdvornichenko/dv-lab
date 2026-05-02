import type { FC } from 'react'

import { CheckCircle2, CircleSlash, Edit3, Trash2, UserX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { buildLessonAttendanceRecords, formatTime, isLessonAbsentFree, lessonDisplayTitle } from '@/lib/crm/model'
import { cn } from '@/lib/utils'

import { absentFreeTone, lessonTone } from './LessonsPanel.model'
import type { LessonListItemProps } from './LessonsPanel.types'

export const LessonListItem: FC<LessonListItemProps> = ({
	lesson,
	students,
	attendanceRecords,
	calendarSyncRecords,
	previewMode,
	onEdit,
	onUpdateLesson,
	onCancelLesson,
	onDeleteLesson,
	onMarkAttendance,
}) => {
	const sync = calendarSyncRecords.find((record) => record.lessonId === lesson.id)
	const absentFree = isLessonAbsentFree(lesson, attendanceRecords)
	const groupPrefix = lesson.studentIds.length > 1 ? 'All ' : ''
	const tone = absentFree ? absentFreeTone : lessonTone(lesson)
	const endsAt = new Date(new Date(lesson.startsAt).getTime() + lesson.durationMinutes * 60_000).toISOString()

	function handleDeleteLesson() {
		if (previewMode) return
		if (!window.confirm(`Delete lesson "${lesson.title}" from the CRM database?`)) return
		void onDeleteLesson(lesson.id)
	}

	function markAbsent() {
		if (!onMarkAttendance) return
		void onMarkAttendance({
			lessonId: lesson.id,
			records: buildLessonAttendanceRecords(lesson, 'absent', false),
		})
	}

	function markAllAttended() {
		void onUpdateLesson(lesson.id, { status: 'completed' })
	}

	function markAllNoShow() {
		if (
			lesson.studentIds.length > 1 &&
			!window.confirm(`Mark all ${lesson.studentIds.length} students as no-show and bill them?`)
		) {
			return
		}
		void onUpdateLesson(lesson.id, { status: 'no_show' })
	}

	return (
		<div
			className={cn(
				'relative grid gap-3 overflow-hidden rounded-lg border p-4 md:flex md:flex-col md:items-start',
				tone.frame
			)}
		>
			<div className="flex gap-2">
				<Badge tone="green" className="tabular-nums">
					{lesson.durationMinutes} min
				</Badge>
				<Badge tone={tone.badge}>{absentFree ? 'absent free' : lesson.status.replace('_', ' ')}</Badge>
				<Badge tone={sync?.status === 'synced' ? 'green' : sync?.status === 'failed' ? 'red' : 'neutral'}>
					Calendar {sync?.status ?? 'not synced'}
				</Badge>
			</div>
			<div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
				<span className={cn('absolute inset-y-0 left-0 w-1', tone.rail)} />
				<div className="flex min-w-0 flex-1">
					<span className="text-ink mr-2 font-mono text-sm font-semibold tabular-nums">
						{formatTime(lesson.startsAt)} - {formatTime(endsAt)}
					</span>
					<p className="font-heading text-ink font-semibold leading-none">{lessonDisplayTitle(lesson, students)}</p>
				</div>
				<div className="flex flex-wrap items-center gap-2 lg:justify-end">
					<Button
						size="sm"
						variant="ghost"
						onClick={markAllAttended}
						disabled={previewMode || lesson.status === 'completed'}
					>
						<CheckCircle2 className="h-4 w-4" />
						{groupPrefix}attended
					</Button>
					<Button size="sm" variant="ghost" onClick={markAllNoShow} disabled={previewMode || lesson.status === 'no_show'}>
						<UserX className="h-4 w-4" />
						{groupPrefix}no-show
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={markAbsent}
						disabled={previewMode || !onMarkAttendance || absentFree}
					>
						<CircleSlash className="h-4 w-4" />
						{groupPrefix}absent free
					</Button>
					<Button size="sm" variant="ghost" onClick={() => onEdit(lesson)}>
						<Edit3 className="h-4 w-4" />
						Edit
					</Button>
					{lesson.status !== 'cancelled' && (
						<Button size="sm" variant="ghost" onClick={() => void onCancelLesson(lesson.id)} disabled={previewMode}>
							<CircleSlash className="h-4 w-4" />
							Cancel
						</Button>
					)}
					<Button
						size="sm"
						variant="ghost"
						className="text-danger hover:text-danger"
						onClick={handleDeleteLesson}
						disabled={previewMode}
					>
						<Trash2 className="h-4 w-4" />
						Delete
					</Button>
				</div>
			</div>
		</div>
	)
}
