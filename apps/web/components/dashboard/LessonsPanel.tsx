import { useState } from 'react'

import { CalendarPlus, CheckCheck, CircleSlash, Clock3, Edit3, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatTime, getLessonAttendanceCount, isLessonAttendanceMarked, studentNames } from '@/lib/crm/model'
import { cn } from '@/lib/utils'

import type { AttendanceRecord, CalendarSyncRecord, CreateLessonInput, Lesson, Student } from '@teacher-crm/api-types'

import { LessonFormDialog } from './LessonFormDialog'

type LessonsPanelProps = {
	lessons: Lesson[]
	students: Student[]
	attendance: AttendanceRecord[]
	calendarSyncRecords: CalendarSyncRecord[]
	title?: string
	description?: string
	onAddLesson: (input: CreateLessonInput) => Promise<void>
	onUpdateLesson: (lessonId: string, input: CreateLessonInput) => Promise<void>
	onCancelLesson: (lessonId: string) => Promise<void>
	onMarkGroupAttended: (lessonId: string) => void
	onSyncLesson: (lessonId: string) => void
}

export function LessonsPanel({
	lessons,
	students,
	attendance,
	calendarSyncRecords,
	title = 'Today control',
	description = 'Lessons, attendance status, and calendar sync.',
	onAddLesson,
	onUpdateLesson,
	onCancelLesson,
	onMarkGroupAttended,
	onSyncLesson,
}: LessonsPanelProps) {
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
	const formOpen = isCreateOpen || Boolean(editingLesson)

	return (
		<>
			<Card id="lessons" className="overflow-hidden shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
				<CardHeader className="border-line-soft bg-surface-muted flex flex-row items-center justify-between gap-3 border-b">
					<div>
						<p className="text-sage font-mono text-xs font-semibold uppercase">Lesson flow</p>
						<CardTitle className="mt-1 text-lg">{title}</CardTitle>
						<p className="text-ink-muted mt-1 text-sm">{description}</p>
					</div>
					<Button size="sm" onClick={() => setIsCreateOpen(true)}>
						<CalendarPlus className="h-4 w-4" />
						Add lesson
					</Button>
				</CardHeader>
				<CardContent className="pt-5">
					{lessons.length === 0 ? (
						<div className="border-sage-line bg-sage-soft/55 rounded-lg border border-dashed p-5">
							<p className="text-ink font-semibold">No lessons scheduled</p>
							<p className="text-ink-muted mt-1 text-sm">Add the next lesson to start the day plan.</p>
						</div>
					) : (
						<ScrollArea className="max-h-[27rem] pr-3">
							<div className="space-y-3">
								{lessons.map((lesson) => {
									const sync = calendarSyncRecords.find((record) => record.lessonId === lesson.id)
									const attendanceCount = getLessonAttendanceCount(lesson, attendance)
									const isMarked = isLessonAttendanceMarked(lesson, attendance)
									return (
										<div
											key={lesson.id}
											className={cn(
												'relative grid gap-3 overflow-hidden rounded-lg border p-4 md:flex md:items-start',
												isMarked ? 'border-success-line bg-success-soft/45' : 'border-warning-line bg-warning-soft/55'
											)}
										>
											<span className={cn('absolute inset-y-0 left-0 w-1', isMarked ? 'bg-success' : 'bg-warning')} />
											<div className="md:w-26 flex items-center gap-2 font-mono text-sm font-semibold tabular-nums md:shrink-0">
												<span
													className={cn(
														'flex size-8 items-center justify-center rounded-lg border',
														isMarked
															? 'border-success-line bg-success-soft text-success'
															: 'border-warning-line bg-warning-soft text-warning'
													)}
												>
													<Clock3 className="h-4 w-4" />
												</span>
												<span className="text-ink">{formatTime(lesson.startsAt)}</span>
											</div>
											<div className="min-w-0 md:flex-1">
												<div className="flex flex-wrap items-center gap-2">
													<p className="text-ink font-semibold">{lesson.title}</p>
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
												<Button size="sm" variant="ghost" onClick={() => setEditingLesson(lesson)}>
													<Edit3 className="h-4 w-4" />
													Edit
												</Button>
												{lesson.status !== 'cancelled' && (
													<Button size="sm" variant="ghost" onClick={() => onCancelLesson(lesson.id)}>
														<CircleSlash className="h-4 w-4" />
														Cancel
													</Button>
												)}
												<Button
													size="sm"
													variant={isMarked ? 'secondary' : 'default'}
													onClick={() => onMarkGroupAttended(lesson.id)}
												>
													<CheckCheck className="h-4 w-4" />
													Mark attendance
												</Button>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															size="icon"
															variant="ghost"
															aria-label="Sync lesson"
															onClick={() => onSyncLesson(lesson.id)}
														>
															<RefreshCw className="h-4 w-4" />
														</Button>
													</TooltipTrigger>
													<TooltipContent sideOffset={6}>Sync lesson</TooltipContent>
												</Tooltip>
											</div>
										</div>
									)
								})}
							</div>
						</ScrollArea>
					)}
				</CardContent>
			</Card>
			<LessonFormDialog
				open={formOpen}
				students={students}
				lesson={editingLesson}
				onOpenChange={(open) => {
					if (open) return
					setIsCreateOpen(false)
					setEditingLesson(null)
				}}
				onSubmit={async (input) => {
					if (editingLesson) {
						await onUpdateLesson(editingLesson.id, input)
						setEditingLesson(null)
					} else {
						await onAddLesson(input)
						setIsCreateOpen(false)
					}
				}}
			/>
		</>
	)
}
