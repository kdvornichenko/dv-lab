import { CalendarPlus, CheckCheck, Clock3, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatTime, getLessonAttendanceCount, isLessonAttendanceMarked, studentNames } from '@/lib/crm/model'

import type { AttendanceRecord, CalendarSyncRecord, Lesson, Student } from '@teacher-crm/api-types'

type LessonsPanelProps = {
	lessons: Lesson[]
	students: Student[]
	attendance: AttendanceRecord[]
	calendarSyncRecords: CalendarSyncRecord[]
	onAddLesson: () => void
	onMarkGroupAttended: (lessonId: string) => void
	onSyncLesson: (lessonId: string) => void
}

export function LessonsPanel({
	lessons,
	students,
	attendance,
	calendarSyncRecords,
	onAddLesson,
	onMarkGroupAttended,
	onSyncLesson,
}: LessonsPanelProps) {
	return (
		<Card id="lessons" className="border-line bg-surface rounded-lg shadow-none">
			<CardHeader className="border-line-soft flex flex-row items-center justify-between gap-3 border-b">
				<div>
					<CardTitle className="text-ink text-base">Today control</CardTitle>
					<p className="text-ink-muted mt-1 text-sm">Lessons, attendance status, and calendar sync.</p>
				</div>
				<Button size="sm" onClick={onAddLesson}>
					<CalendarPlus className="h-4 w-4" />
					Add lesson
				</Button>
			</CardHeader>
			<CardContent className="pt-4">
				{lessons.length === 0 ? (
					<div className="border-line-strong bg-surface-muted text-ink-muted rounded-lg border border-dashed p-5 text-sm">
						No lessons scheduled. Add the next lesson to start the day plan.
					</div>
				) : (
					<ScrollArea className="max-h-107.5 pr-3">
						<div className="space-y-3">
							{lessons.map((lesson) => {
								const sync = calendarSyncRecords.find((record) => record.lessonId === lesson.id)
								const attendanceCount = getLessonAttendanceCount(lesson, attendance)
								const isMarked = isLessonAttendanceMarked(lesson, attendance)
								return (
									<div
										key={lesson.id}
										className="border-line bg-surface-muted grid gap-3 rounded-lg border p-3 md:flex md:items-start"
									>
										<div className="text-sage md:w-22 flex items-center gap-2 font-mono text-sm font-semibold tabular-nums md:shrink-0">
											<Clock3 className="h-4 w-4" />
											{formatTime(lesson.startsAt)}
										</div>
										<div className="min-w-0 md:flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<p className="text-ink font-medium">{lesson.title}</p>
												<Badge tone={isMarked ? 'green' : 'amber'}>
													{attendanceCount}/{lesson.studentIds.length} marked
												</Badge>
												<Badge
													tone={sync?.status === 'synced' ? 'green' : sync?.status === 'failed' ? 'red' : 'neutral'}
												>
													Calendar {sync?.status ?? 'not synced'}
												</Badge>
											</div>
											<p className="text-ink-muted mt-1 truncate text-sm">{studentNames(lesson, students)}</p>
											<p className="text-ink-muted mt-1 text-xs">
												{lesson.durationMinutes} min{lesson.topic ? ` · ${lesson.topic}` : ''}
											</p>
										</div>
										<div className="flex items-center gap-2 md:justify-end">
											<Button
												size="sm"
												variant={isMarked ? 'secondary' : 'default'}
												onClick={() => onMarkGroupAttended(lesson.id)}
											>
												<CheckCheck className="h-4 w-4" />
												Mark attendance
											</Button>
											<Button
												size="icon"
												variant="ghost"
												aria-label="Sync lesson"
												onClick={() => onSyncLesson(lesson.id)}
											>
												<RefreshCw className="h-4 w-4" />
											</Button>
										</div>
									</div>
								)
							})}
						</div>
					</ScrollArea>
				)}
			</CardContent>
		</Card>
	)
}
