import { useState } from 'react'
import type { ReactNode } from 'react'

import { CalendarPlus, CircleSlash, Edit3, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatTime, lessonDisplayTitle } from '@/lib/crm/model'
import { cn } from '@/lib/utils'

import type {
	CalendarBusyInterval,
	CalendarSyncRecord,
	CreateLessonInput,
	Lesson,
	Student,
	UpdateLessonInput,
} from '@teacher-crm/api-types'

import { LessonFormDialog } from './LessonFormDialog'

type LessonsPanelProps = {
	lessons: Lesson[]
	students: Student[]
	calendarSyncRecords: CalendarSyncRecord[]
	title?: string
	description?: string
	toolbar?: ReactNode
	onAddLesson: (input: CreateLessonInput) => Promise<void>
	onUpdateLesson: (lessonId: string, input: UpdateLessonInput) => Promise<void>
	onCancelLesson: (lessonId: string) => Promise<void>
	onDeleteLesson: (lessonId: string) => Promise<void>
	onCheckCalendarConflicts?: (input: CreateLessonInput) => Promise<CalendarBusyInterval[]>
	previewMode?: boolean
}

function lessonTone(lesson: Lesson) {
	if (lesson.status === 'completed')
		return { badge: 'green' as const, rail: 'bg-success', frame: 'border-success-line bg-success-soft/35' }
	if (lesson.status === 'cancelled')
		return { badge: 'red' as const, rail: 'bg-danger', frame: 'border-danger-line bg-danger-soft/35' }
	if (lesson.status === 'rescheduled')
		return { badge: 'amber' as const, rail: 'bg-warning', frame: 'border-warning-line bg-warning-soft/45' }
	return { badge: 'neutral' as const, rail: 'bg-sage', frame: 'border-line-soft bg-surface-muted' }
}

export function LessonsPanel({
	lessons,
	students,
	calendarSyncRecords,
	title = 'Today control',
	description = 'Individual lessons, statuses, and calendar sync.',
	toolbar,
	onAddLesson,
	onUpdateLesson,
	onCancelLesson,
	onDeleteLesson,
	onCheckCalendarConflicts,
	previewMode = false,
}: LessonsPanelProps) {
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
	const formOpen = isCreateOpen || Boolean(editingLesson)

	function handleDeleteLesson(lesson: Lesson) {
		if (previewMode) return
		if (!window.confirm(`Delete lesson "${lesson.title}" from the CRM database?`)) return
		void onDeleteLesson(lesson.id)
	}

	return (
		<>
			<Card id="lessons" className="overflow-hidden shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
				<CardHeader className="border-line-soft bg-surface-muted flex flex-row items-center justify-between gap-3 border-b">
					<div>
						<p className="text-sage font-mono text-xs font-semibold uppercase">Lesson flow</p>
						<CardTitle className="mt-1 text-lg">{title}</CardTitle>
						<p className="text-ink-muted mt-1 text-sm">{description}</p>
					</div>
					<div className="flex flex-wrap items-center justify-end gap-2">
						{toolbar}
						<Button size="sm" onClick={() => setIsCreateOpen(true)}>
							<CalendarPlus className="h-4 w-4" />
							Add lesson
						</Button>
					</div>
				</CardHeader>
				<CardContent className="pt-5">
					{lessons.length === 0 ? (
						<div className="border-sage-line bg-sage-soft/55 rounded-lg border border-dashed p-5">
							<p className="font-heading text-ink font-semibold">No lessons scheduled</p>
							<p className="text-ink-muted mt-1 text-sm">Add the next lesson to start the day plan.</p>
						</div>
					) : (
						<ScrollArea className="max-h-108">
							<div className="space-y-3">
								{lessons.map((lesson) => {
									const sync = calendarSyncRecords.find((record) => record.lessonId === lesson.id)
									const tone = lessonTone(lesson)
									const endsAt = new Date(
										new Date(lesson.startsAt).getTime() + lesson.durationMinutes * 60_000
									).toISOString()
									return (
										<div
											key={lesson.id}
											className={cn(
												'relative grid gap-3 overflow-hidden rounded-lg border p-4 md:flex md:flex-col md:items-start',
												tone.frame
											)}
										>
											<div className="flex gap-2">
												<Badge tone="green" className="tabular-nums">
													{lesson.durationMinutes} min
												</Badge>
												<Badge tone={tone.badge}>{lesson.status}</Badge>
												<Badge
													tone={sync?.status === 'synced' ? 'green' : sync?.status === 'failed' ? 'red' : 'neutral'}
												>
													Calendar {sync?.status ?? 'not synced'}
												</Badge>
											</div>
											<div className="flex w-full">
												<span className={cn('absolute inset-y-0 left-0 w-1', tone.rail)} />
												<div className="flex flex-1">
													<span className="text-ink mr-2 font-mono text-sm font-semibold tabular-nums">
														{formatTime(lesson.startsAt)} - {formatTime(endsAt)}
													</span>
													<p className="font-heading text-ink font-semibold leading-none">
														{lessonDisplayTitle(lesson, students)}
													</p>
												</div>
												<div className="flex items-center gap-2 md:justify-end">
													<Button size="sm" variant="ghost" onClick={() => setEditingLesson(lesson)}>
														<Edit3 className="h-4 w-4" />
														Edit
													</Button>
													{lesson.status !== 'cancelled' && (
														<Button
															size="sm"
															variant="ghost"
															onClick={() => onCancelLesson(lesson.id)}
															disabled={previewMode}
														>
															<CircleSlash className="h-4 w-4" />
															Cancel
														</Button>
													)}
													<Button
														size="sm"
														variant="ghost"
														className="text-danger hover:text-danger"
														onClick={() => handleDeleteLesson(lesson)}
														disabled={previewMode}
													>
														<Trash2 className="h-4 w-4" />
														Delete
													</Button>
												</div>
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
				lessons={lessons}
				lesson={editingLesson}
				onCheckCalendarConflicts={onCheckCalendarConflicts}
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
