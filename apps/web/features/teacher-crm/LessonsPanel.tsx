import { CalendarPlus, CheckCheck, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { formatTime, studentNames } from './model'
import type { TeacherCrmState } from './types'

type LessonsPanelProps = {
	state: TeacherCrmState
	onAddLesson: () => void
	onMarkGroupAttended: (lessonId: string) => void
	onSyncLesson: (lessonId: string) => void
}

export function LessonsPanel({ state, onAddLesson, onMarkGroupAttended, onSyncLesson }: LessonsPanelProps) {
	return (
		<Card id="lessons">
			<CardHeader className="flex flex-row items-center justify-between gap-3">
				<CardTitle>Lessons and Attendance</CardTitle>
				<Button size="sm" onClick={onAddLesson}>
					<CalendarPlus className="h-4 w-4" />
					Add
				</Button>
			</CardHeader>
			<CardContent className="space-y-3">
				{state.lessons.map((lesson) => {
					const sync = state.calendarSyncRecords.find((record) => record.lessonId === lesson.id)
					const attendanceCount = state.attendance.filter(
						(record) => record.lessonId === lesson.id && record.status === 'attended'
					).length
					return (
						<div key={lesson.id} className="rounded-md border border-zinc-200 p-3">
							<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<p className="font-medium text-zinc-950">{lesson.title}</p>
										<Badge tone="blue">{formatTime(lesson.startsAt)}</Badge>
										<Badge tone={sync?.status === 'synced' ? 'green' : sync?.status === 'failed' ? 'red' : 'amber'}>
											Calendar {sync?.status ?? 'not_synced'}
										</Badge>
									</div>
									<p className="mt-1 truncate text-sm text-zinc-600">{studentNames(lesson, state.students)}</p>
									<p className="mt-1 text-xs text-zinc-500">
										{attendanceCount}/{lesson.studentIds.length} marked attended
									</p>
								</div>
								<div className="flex gap-2">
									<Button size="sm" variant="secondary" onClick={() => onMarkGroupAttended(lesson.id)}>
										<CheckCheck className="h-4 w-4" />
										Mark all
									</Button>
									<Button size="sm" variant="ghost" onClick={() => onSyncLesson(lesson.id)}>
										<RefreshCw className="h-4 w-4" />
										Sync
									</Button>
								</div>
							</div>
						</div>
					)
				})}
			</CardContent>
		</Card>
	)
}
