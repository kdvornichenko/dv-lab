'use client'

import { Badge } from '@/components/ui/badge'
import { TeacherCrmPageShell, type TeacherCrm } from '@/components/workspace/TeacherCrmPageShell'
import { formatCurrencyTotals, selectOverdueStudents, selectTodayLessons } from '@/lib/crm/model'

import type { Currency } from '@teacher-crm/api-types'

import { LessonsPanel } from './LessonsPanel'
import { SummaryStrip } from './SummaryStrip'

export function TeacherDashboard() {
	return (
		<TeacherCrmPageShell skeletonRows={4}>{(crm, now) => <DashboardContent crm={crm} now={now} />}</TeacherCrmPageShell>
	)
}

function DashboardContent({ crm, now }: { crm: TeacherCrm; now: Date }) {
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

function FocusPanel({
	overdueStudents,
	atRiskStudent,
	monthIncomeByCurrency,
	todayLessonCount,
	cancelledToday,
}: {
	overdueStudents: number
	atRiskStudent?: string
	monthIncomeByCurrency: Record<Currency, number>
	todayLessonCount: number
	cancelledToday: number
}) {
	return (
		<section className="border-line bg-surface rounded-lg border p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<p className="text-sage font-mono text-xs font-semibold uppercase">Focus</p>
			<h2 className="text-ink mt-1 text-lg font-semibold">Payment and schedule pressure</h2>
			<div className="mt-4 grid gap-3">
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<p className="text-ink-muted text-xs font-medium">Today load</p>
					<p className="text-ink mt-1 font-mono text-2xl font-semibold tabular-nums">{todayLessonCount}</p>
				</div>
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-ink-muted text-xs font-medium">Cancelled today</p>
						<Badge tone={cancelledToday > 0 ? 'amber' : 'green'} className="font-mono tabular-nums">
							{cancelledToday}
						</Badge>
					</div>
				</div>
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<p className="text-ink-muted text-xs font-medium">Month income</p>
					<p className="text-ink mt-1 font-mono text-2xl font-semibold tabular-nums">
						{formatCurrencyTotals(monthIncomeByCurrency)}
					</p>
				</div>
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-ink-muted text-xs font-medium">Payment risk</p>
						<Badge tone={overdueStudents > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
							{overdueStudents}
						</Badge>
					</div>
					<p className="font-heading text-ink mt-2 truncate text-sm font-semibold">
						{atRiskStudent ?? 'No overdue student'}
					</p>
				</div>
			</div>
		</section>
	)
}
