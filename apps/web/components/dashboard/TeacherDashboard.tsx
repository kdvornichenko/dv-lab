'use client'

import { StudentsPanel } from '@/components/students/StudentsPanel'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useTeacherCrm } from '@/hooks/useTeacherCrm'
import {
	formatDateShort,
	formatUsdAmount,
	selectMissingAttendanceLessons,
	selectOverdueStudents,
	selectTodayLessons,
} from '@/lib/crm/model'

import { CalendarPanel } from './CalendarPanel'
import { LessonsPanel } from './LessonsPanel'
import { PaymentsPanel } from './PaymentsPanel'
import { SummaryStrip } from './SummaryStrip'

export type WorkspaceView = 'dashboard' | 'lessons' | 'students' | 'payments' | 'calendar'

export function TeacherDashboard({ view = 'dashboard' }: { view?: WorkspaceView }) {
	const crm = useTeacherCrm()
	const now = new Date()
	const activeView = view
	const todayLessons = selectTodayLessons(crm.state.lessons, now)
	const dashboardLessons = todayLessons.length > 0 ? todayLessons : crm.state.lessons.slice(0, 4)
	const missingAttendanceLessons = selectMissingAttendanceLessons(todayLessons, crm.state.attendance)
	const overdueStudents = selectOverdueStudents(crm.studentRows)
	const atRiskStudent = overdueStudents[0]

	function cancelLesson(lessonId: string) {
		return crm.updateLesson(lessonId, { status: 'cancelled' })
	}

	const studentsPanel = (
		<StudentsPanel
			visibleStudents={crm.visibleStudents}
			lessons={crm.state.lessons}
			attendance={crm.state.attendance}
			filter={crm.studentFilter}
			now={now}
			onFilterChange={crm.setStudentFilter}
			onAddStudent={crm.addStudent}
			onArchiveStudent={crm.archiveStudent}
			onRecordPayment={crm.recordPayment}
		/>
	)

	return (
		<main className="flex min-h-dvh flex-col gap-unit p-unit">
			<div className="mx-auto grid h-full w-full grow gap-5">
				{crm.isLoading && <WorkspaceSkeleton view={activeView} />}

				{!crm.isLoading && (
					<>
						{activeView === 'dashboard' && (
							<div className="grid gap-5">
								<SummaryStrip summary={crm.summary} />
								<div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
									<LessonsPanel
										lessons={dashboardLessons}
										students={crm.state.students}
										attendance={crm.state.attendance}
										calendarSyncRecords={crm.state.calendarSyncRecords}
										title={todayLessons.length > 0 ? 'Today agenda' : 'Next lessons'}
										description="A compact agenda for the next attendance decision."
										onAddLesson={crm.addLesson}
										onUpdateLesson={crm.updateLesson}
										onCancelLesson={cancelLesson}
										onMarkGroupAttended={crm.markGroupAttended}
										onSyncLesson={crm.syncLesson}
									/>
									<FocusPanel
										overdueStudents={overdueStudents.length}
										missingAttendanceCount={missingAttendanceLessons.length}
										atRiskStudent={atRiskStudent?.fullName}
										monthIncome={crm.summary.monthIncome}
										todayLessonCount={crm.summary.todayLessons}
									/>
								</div>
							</div>
						)}

						{activeView === 'lessons' && (
							<LessonsPanel
								lessons={crm.state.lessons}
								students={crm.state.students}
								attendance={crm.state.attendance}
								calendarSyncRecords={crm.state.calendarSyncRecords}
								title="Schedule workspace"
								description="All planned lessons with attendance and sync actions in one focused view."
								onAddLesson={crm.addLesson}
								onUpdateLesson={crm.updateLesson}
								onCancelLesson={cancelLesson}
								onMarkGroupAttended={crm.markGroupAttended}
								onSyncLesson={crm.syncLesson}
							/>
						)}

						{activeView === 'students' && studentsPanel}

						{activeView === 'payments' && (
							<PaymentsPanel
								payments={crm.state.payments}
								students={crm.state.students}
								studentBalances={crm.state.studentBalances}
								now={now}
								onDeletePayment={crm.deletePayment}
							/>
						)}

						{activeView === 'calendar' && (
							<div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
								<CalendarPanel
									connection={crm.state.calendarConnection}
									syncRecords={crm.state.calendarSyncRecords}
									onConnect={crm.connectCalendar}
								/>
								<CalendarSyncPanel
									syncRecords={crm.state.calendarSyncRecords}
									lessonTitles={new Map(crm.state.lessons.map((lesson) => [lesson.id, lesson.title]))}
								/>
							</div>
						)}
					</>
				)}
			</div>
		</main>
	)
}

function WorkspaceSkeleton({ view }: { view: WorkspaceView }) {
	const rows = view === 'dashboard' ? 4 : 7

	return (
		<div className="grid gap-5">
			<div className="grid gap-3 md:grid-cols-4">
				{Array.from({ length: 4 }).map((_, index) => (
					<Skeleton key={index} className="h-24 rounded-lg" />
				))}
			</div>
			<div className="rounded-lg border border-line bg-surface p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="grid gap-2">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-6 w-48" />
					</div>
					<Skeleton className="h-9 w-24 rounded-lg" />
				</div>
				<div className="mt-5 grid gap-3">
					{Array.from({ length: rows }).map((_, index) => (
						<Skeleton key={index} className="h-16 rounded-lg" />
					))}
				</div>
			</div>
		</div>
	)
}

function FocusPanel({
	overdueStudents,
	missingAttendanceCount,
	atRiskStudent,
	monthIncome,
	todayLessonCount,
}: {
	overdueStudents: number
	missingAttendanceCount: number
	atRiskStudent?: string
	monthIncome: number
	todayLessonCount: number
}) {
	return (
		<section className="rounded-lg border border-line bg-surface p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<p className="font-mono text-xs font-semibold text-sage uppercase">Focus</p>
			<h2 className="mt-1 text-lg font-semibold text-ink">Payment and schedule pressure</h2>
			<div className="mt-4 grid gap-3">
				<div className="rounded-lg border border-line-soft bg-surface-muted p-3">
					<p className="text-xs font-medium text-ink-muted">Today load</p>
					<p className="mt-1 font-mono text-2xl font-semibold text-ink tabular-nums">{todayLessonCount}</p>
				</div>
				<div className="rounded-lg border border-line-soft bg-surface-muted p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs font-medium text-ink-muted">Missing marks</p>
						<Badge tone={missingAttendanceCount > 0 ? 'amber' : 'green'} className="font-mono tabular-nums">
							{missingAttendanceCount}
						</Badge>
					</div>
				</div>
				<div className="rounded-lg border border-line-soft bg-surface-muted p-3">
					<p className="text-xs font-medium text-ink-muted">Month income</p>
					<p className="mt-1 font-mono text-2xl font-semibold text-ink tabular-nums">{formatUsdAmount(monthIncome)}</p>
				</div>
				<div className="rounded-lg border border-line-soft bg-surface-muted p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs font-medium text-ink-muted">Payment risk</p>
						<Badge tone={overdueStudents > 0 ? 'red' : 'green'} className="font-mono tabular-nums">
							{overdueStudents}
						</Badge>
					</div>
					<p className="mt-2 truncate text-sm font-semibold text-ink">{atRiskStudent ?? 'No overdue student'}</p>
				</div>
			</div>
		</section>
	)
}

function CalendarSyncPanel({
	syncRecords,
	lessonTitles,
}: {
	syncRecords: { id: string; lessonId: string; status: string; updatedAt: string; lastError: string | null }[]
	lessonTitles: Map<string, string>
}) {
	return (
		<section className="rounded-lg border border-line bg-surface p-4 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
			<p className="font-mono text-xs font-semibold text-sage uppercase">Event ledger</p>
			<h2 className="mt-1 text-lg font-semibold text-ink">Calendar sync records</h2>
			<div className="mt-4 grid gap-2">
				{syncRecords.map((record) => (
					<div key={record.id} className="rounded-lg border border-line-soft bg-surface-muted p-3">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<p className="truncate text-sm font-semibold text-ink">
									{lessonTitles.get(record.lessonId) ?? 'Unknown lesson'}
								</p>
								<p className="mt-1 font-mono text-xs text-ink-muted tabular-nums">
									Updated {formatDateShort(record.updatedAt)}
								</p>
								{record.lastError && <p className="mt-1 truncate text-xs text-danger">{record.lastError}</p>}
							</div>
							<Badge
								tone={record.status === 'synced' ? 'green' : record.status === 'failed' ? 'red' : 'neutral'}
								className="font-mono tabular-nums"
							>
								{record.status}
							</Badge>
						</div>
					</div>
				))}
				{syncRecords.length === 0 && (
					<div className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-4">
						<p className="text-sm font-semibold text-ink">No calendar events queued</p>
						<p className="mt-1 text-xs text-ink-muted">Sync records will appear after lesson calendar actions.</p>
					</div>
				)}
			</div>
		</section>
	)
}
