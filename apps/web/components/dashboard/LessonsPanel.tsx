import { type FC, useState } from 'react'

import { CalendarPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

import type { Lesson } from '@teacher-crm/api-types'

import { LessonFormDialog } from './LessonFormDialog'
import { LessonListItem } from './LessonListItem'
import type { LessonsPanelProps } from './LessonsPanel.types'

export const LessonsPanel: FC<LessonsPanelProps> = ({
	lessons,
	students,
	attendanceRecords = [],
	calendarConnection,
	calendarSyncRecords,
	title = 'Today control',
	description = 'Individual lessons, statuses, and calendar sync.',
	toolbar,
	onAddLesson,
	onUpdateLesson,
	onCancelLesson,
	onDeleteLesson,
	onMarkAttendance,
	onCheckCalendarConflicts,
	onConnectCalendar,
	previewMode = false,
}) => {
	const [isCreateOpen, setIsCreateOpen] = useState(false)
	const [editingLesson, setEditingLesson] = useState<Lesson | null>(null)
	const formOpen = isCreateOpen || Boolean(editingLesson)

	return (
		<>
			<Card id="lessons" data-pet-target className="overflow-hidden shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
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
					{calendarConnection && (calendarConnection.status !== 'connected' || !calendarConnection.tokenAvailable) && (
						<div role="alert" className="border-warning-line bg-warning-soft mb-4 rounded-lg border p-3 text-sm">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="font-heading text-ink font-semibold">Google Calendar is not connected</p>
									<p className="text-ink-muted mt-1 text-xs">
										Lesson changes are saved locally until Google reconnect completes.
									</p>
								</div>
								{onConnectCalendar ? (
									<Button type="button" variant="secondary" size="sm" onClick={onConnectCalendar}>
										Reconnect Google
									</Button>
								) : null}
							</div>
						</div>
					)}
					{lessons.length === 0 ? (
						<div className="border-sage-line bg-sage-soft/55 rounded-lg border border-dashed p-5">
							<p className="font-heading text-ink font-semibold">No lessons scheduled</p>
							<p className="text-ink-muted mt-1 text-sm">Add the next lesson to start the day plan.</p>
						</div>
					) : (
						<ScrollArea className="max-h-108">
							<div className="space-y-3">
								{lessons.map((lesson) => (
									<LessonListItem
										key={lesson.id}
										lesson={lesson}
										students={students}
										attendanceRecords={attendanceRecords}
										calendarConnection={calendarConnection}
										calendarSyncRecords={calendarSyncRecords}
										previewMode={previewMode}
										onEdit={setEditingLesson}
										onUpdateLesson={onUpdateLesson}
										onCancelLesson={onCancelLesson}
										onDeleteLesson={onDeleteLesson}
										onMarkAttendance={onMarkAttendance}
									/>
								))}
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
