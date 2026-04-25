'use client'

import { AlertTriangle, BookOpenCheck, CalendarPlus, ClipboardCheck, ReceiptText, UserPlus } from 'lucide-react'

import { StudentsPanel } from '@/components/students/StudentsPanel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTeacherCrm } from '@/hooks/useTeacherCrm'
import {
	formatUsdAmount,
	formatWeekday,
	selectFailedCalendarSyncs,
	selectMissingAttendanceLessons,
	selectOverdueStudents,
	selectTodayLessons,
} from '@/lib/crm/model'

import { CalendarPanel } from './CalendarPanel'
import { LessonsPanel } from './LessonsPanel'
import { PaymentsPanel } from './PaymentsPanel'
import { SummaryStrip } from './SummaryStrip'

export function TeacherDashboard() {
	const crm = useTeacherCrm()
	const now = new Date()
	const todayLessons = selectTodayLessons(crm.state.lessons, now)
	const visibleLessons = todayLessons.length > 0 ? todayLessons : crm.state.lessons
	const missingAttendanceLessons = selectMissingAttendanceLessons(todayLessons, crm.state.attendance)
	const overdueStudents = selectOverdueStudents(crm.studentRows)
	const failedSyncs = selectFailedCalendarSyncs(crm.state.calendarSyncRecords)
	const atRiskStudent = overdueStudents[0]

	const attentionItems = [
		{
			label: 'Missing attendance',
			value: missingAttendanceLessons.length,
			detail:
				missingAttendanceLessons.length > 0
					? `${missingAttendanceLessons[0]!.title} needs a mark`
					: 'All visible lessons are marked',
			tone: missingAttendanceLessons.length > 0 ? 'amber' : 'green',
		},
		{
			label: 'Payment risk',
			value: overdueStudents.length,
			detail: atRiskStudent
				? `${atRiskStudent.fullName}: ${formatUsdAmount(atRiskStudent.balance.balance)}`
				: 'No overdue student balance',
			tone: overdueStudents.length > 0 ? 'red' : 'green',
		},
		{
			label: 'Calendar sync',
			value: failedSyncs.length,
			detail: failedSyncs.length > 0 ? 'Calendar sync failed' : crm.state.calendarConnection.status,
			tone: failedSyncs.length > 0 ? 'red' : crm.state.calendarConnection.status === 'connected' ? 'green' : 'amber',
		},
	] as const

	return (
		<main className="bg-canvas min-h-dvh px-4 py-5 sm:px-6 lg:px-8">
			<div className="max-w-360 mx-auto grid w-full gap-5">
				<header className="border-line grid gap-4 border-b pb-5 xl:flex xl:items-end xl:justify-between">
					<div className="min-w-0">
						<div className="text-sage flex flex-wrap items-center gap-2 text-sm font-medium">
							<BookOpenCheck className="h-4 w-4" />
							<span>Teaching studio</span>
							<span className="text-ink-muted font-mono text-xs">{formatWeekday(now)}</span>
						</div>
						<h1 className="text-ink mt-2 text-2xl font-semibold sm:text-3xl">Today control desk</h1>
						<p className="text-ink-muted mt-2 max-w-2xl text-sm leading-6">
							Today lessons, attendance gaps, payment risk, and Google Calendar status.
						</p>
					</div>
					<div className="xl:w-140 grid gap-2 sm:grid-cols-4">
						<Button asChild variant="secondary" size="sm" className="justify-start">
							<a href="#students">
								<UserPlus className="h-4 w-4" />
								Add student
							</a>
						</Button>
						<Button size="sm" className="justify-start" onClick={crm.addLesson}>
							<CalendarPlus className="h-4 w-4" />
							Add lesson
						</Button>
						<Button asChild variant="secondary" size="sm" className="justify-start">
							<a href="#payments">
								<ReceiptText className="h-4 w-4" />
								Record payment
							</a>
						</Button>
						<Button asChild variant="secondary" size="sm" className="justify-start">
							<a href="#lessons">
								<ClipboardCheck className="h-4 w-4" />
								Mark attendance
							</a>
						</Button>
					</div>
				</header>

				{crm.error && (
					<div className="border-danger-line bg-danger-soft text-danger rounded-lg border px-4 py-3 text-sm">
						{crm.error}
					</div>
				)}
				{crm.isLoading && (
					<div className="border-line bg-surface text-ink-muted rounded-lg border px-4 py-3 text-sm">
						Loading CRM data...
					</div>
				)}

				<section className="grid gap-5 xl:flex xl:items-start">
					<div className="grid min-w-0 gap-5 xl:flex-1">
						<SummaryStrip summary={crm.summary} />
						<LessonsPanel
							lessons={visibleLessons}
							students={crm.state.students}
							attendance={crm.state.attendance}
							calendarSyncRecords={crm.state.calendarSyncRecords}
							onAddLesson={crm.addLesson}
							onMarkGroupAttended={crm.markGroupAttended}
							onSyncLesson={crm.syncLesson}
						/>
						<StudentsPanel
							visibleStudents={crm.visibleStudents}
							profileStudents={crm.studentRows}
							lessons={crm.state.lessons}
							attendance={crm.state.attendance}
							filter={crm.studentFilter}
							now={now}
							onFilterChange={crm.setStudentFilter}
							onAddStudent={crm.addStudent}
							onUpdateStudent={crm.updateStudent}
							onArchiveStudent={crm.archiveStudent}
							onRecordPayment={crm.recordPayment}
						/>
					</div>
					<aside className="xl:w-90 grid content-start gap-5 xl:shrink-0">
						<section className="border-line bg-surface rounded-lg border p-4 shadow-none" aria-label="Attention queue">
							<div className="flex items-center justify-between gap-3">
								<div>
									<h2 className="text-ink text-base font-semibold">Attention queue</h2>
									<p className="text-ink-muted mt-1 text-sm">Items to clear before the day ends.</p>
								</div>
								<AlertTriangle className="text-warning h-5 w-5" />
							</div>
							<div className="divide-line-soft mt-4 divide-y">
								{attentionItems.map((item) => (
									<div key={item.label} className="flex items-start justify-between gap-3 py-3">
										<div className="min-w-0">
											<p className="text-ink text-sm font-medium">{item.label}</p>
											<p className="text-ink-muted mt-1 truncate text-xs">{item.detail}</p>
										</div>
										<Badge tone={item.tone} className="font-mono tabular-nums">
											{item.value}
										</Badge>
									</div>
								))}
							</div>
						</section>
						<CalendarPanel
							connection={crm.state.calendarConnection}
							syncRecords={crm.state.calendarSyncRecords}
							onConnect={crm.connectCalendar}
						/>
						<PaymentsPanel
							payments={crm.state.payments}
							students={crm.state.students}
							studentBalances={crm.state.studentBalances}
							now={now}
						/>
					</aside>
				</section>
			</div>
		</main>
	)
}
