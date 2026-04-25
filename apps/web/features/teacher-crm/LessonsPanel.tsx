import { CalendarPlus, CheckCheck, Clock3, RefreshCw } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'

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
		<Card id="lessons" className="rounded-lg border-[#E6E0D4] bg-white shadow-none">
			<CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[#EFE8DC]">
				<div>
					<CardTitle className="text-base text-[#181713]">Today control</CardTitle>
					<p className="mt-1 text-sm text-[#6F6B63]">Lessons, attendance status, and calendar sync.</p>
				</div>
				<Button size="sm" onClick={onAddLesson}>
					<CalendarPlus className="h-4 w-4" />
					Add lesson
				</Button>
			</CardHeader>
			<CardContent className="pt-4">
				{state.lessons.length === 0 ? (
					<div className="rounded-lg border border-dashed border-[#D8D0C2] bg-[#FBFAF6] p-5 text-sm text-[#6F6B63]">
						No lessons scheduled. Add the next lesson to start the day plan.
					</div>
				) : (
					<ScrollArea className="max-h-[430px] pr-3">
						<div className="space-y-3">
							{state.lessons.map((lesson) => {
								const sync = state.calendarSyncRecords.find((record) => record.lessonId === lesson.id)
								const attendanceCount = state.attendance.filter(
									(record) => record.lessonId === lesson.id && record.status === 'attended'
								).length
								const isMarked = attendanceCount >= lesson.studentIds.length
								return (
									<div
										key={lesson.id}
										className="grid gap-3 rounded-lg border border-[#E6E0D4] bg-[#FBFAF6] p-3 md:grid-cols-[88px_minmax(0,1fr)_auto]"
									>
										<div className="flex items-center gap-2 font-mono text-sm font-semibold tabular-nums text-[#2F6F5E]">
											<Clock3 className="h-4 w-4" />
											{formatTime(lesson.startsAt)}
										</div>
										<div className="min-w-0">
											<div className="flex flex-wrap items-center gap-2">
												<p className="font-medium text-[#181713]">{lesson.title}</p>
												<Badge tone={isMarked ? 'green' : 'amber'}>
													{attendanceCount}/{lesson.studentIds.length} marked
												</Badge>
												<Badge
													tone={sync?.status === 'synced' ? 'green' : sync?.status === 'failed' ? 'red' : 'neutral'}
												>
													Calendar {sync?.status ?? 'not synced'}
												</Badge>
											</div>
											<p className="mt-1 truncate text-sm text-[#6F6B63]">{studentNames(lesson, state.students)}</p>
											<p className="mt-1 text-xs text-[#6F6B63]">
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
