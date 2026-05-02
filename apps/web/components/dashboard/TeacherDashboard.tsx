'use client'

import type { FC } from 'react'

import { TeacherCrmPageShell } from '@/components/workspace/TeacherCrmPageShell'
import { selectOverdueStudents, selectTodayLessons } from '@/lib/crm/model'

import { FocusPanel } from './FocusPanel'
import { LessonsPanel } from './LessonsPanel'
import { SummaryStrip } from './SummaryStrip'
import type { DashboardContentProps } from './TeacherDashboard.types'

export const TeacherDashboard: FC = () => {
	return (
		<TeacherCrmPageShell skeletonRows={4}>{(crm, now) => <DashboardContent crm={crm} now={now} />}</TeacherCrmPageShell>
	)
}

const DashboardContent: FC<DashboardContentProps> = ({ crm, now }) => {
	const todayLessons = selectTodayLessons(crm.state.lessons, now)
	const dashboardLessons = todayLessons.length > 0 ? todayLessons : crm.state.lessons.slice(0, 4)
	const cancelledToday = todayLessons.filter((lesson) => lesson.status === 'cancelled').length
	const overdueStudents = selectOverdueStudents(crm.studentRows)
	const atRiskStudent = overdueStudents[0]

	function cancelLesson(lessonId: string) {
		return crm.updateLesson(lessonId, { status: 'cancelled' })
	}

	return (
		<div className="grid gap-5">
			<SummaryStrip summary={crm.summary} />
			<div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
				<LessonsPanel
					lessons={dashboardLessons}
					students={crm.state.students}
					attendanceRecords={crm.state.attendance}
					calendarSyncRecords={crm.state.calendarSyncRecords}
					title={todayLessons.length > 0 ? 'Today agenda' : 'Next lessons'}
					description="A compact agenda for the next schedule decision."
					onAddLesson={crm.addLesson}
					onUpdateLesson={crm.updateLesson}
					onCancelLesson={cancelLesson}
					onDeleteLesson={crm.deleteLesson}
					onMarkAttendance={crm.markAttendance}
					onCheckCalendarConflicts={crm.checkCalendarConflicts}
				/>
				<FocusPanel
					overdueStudents={overdueStudents.length}
					atRiskStudent={atRiskStudent?.fullName}
					monthIncomeByCurrency={crm.summary.monthIncomeByCurrency}
					todayLessonCount={crm.summary.todayLessons}
					cancelledToday={cancelledToday}
				/>
			</div>
		</div>
	)
}
