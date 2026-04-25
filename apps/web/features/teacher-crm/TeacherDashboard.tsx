'use client'

import { AlertTriangle, BookOpenCheck, CalendarPlus, ClipboardCheck, ReceiptText, UserPlus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { CalendarPanel } from './CalendarPanel'
import { LessonsPanel } from './LessonsPanel'
import { PaymentsPanel } from './PaymentsPanel'
import { StudentsPanel } from './StudentsPanel'
import { SummaryStrip } from './SummaryStrip'
import { formatMoney, formatWeekday } from './model'
import { useTeacherCrm } from './useTeacherCrm'

function isToday(value: string) {
	const date = new Date(value)
	const now = new Date()
	return (
		date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
	)
}

export function TeacherDashboard() {
	const crm = useTeacherCrm()
	const todayLessons = crm.state.lessons.filter((lesson) => isToday(lesson.startsAt))
	const missingAttendanceLessons = todayLessons.filter((lesson) => {
		const marked = crm.state.attendance.filter((record) => record.lessonId === lesson.id).length
		return marked < lesson.studentIds.length
	})
	const overdueStudents = crm.studentRows.filter((student) => student.balance.overdue)
	const failedSyncs = crm.state.calendarSyncRecords.filter((record) => record.status === 'failed')
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
				? `${atRiskStudent.fullName}: ${formatMoney(atRiskStudent.balance.balance)}`
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
		<main className="min-h-[100dvh] bg-[#F7F5EF] px-4 py-5 sm:px-6 lg:px-8">
			<div className="mx-auto grid w-full max-w-[1440px] gap-5">
				<header className="grid gap-4 border-b border-[#E6E0D4] pb-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[#2F6F5E]">
							<BookOpenCheck className="h-4 w-4" />
							<span>Teaching studio</span>
							<span className="font-mono text-xs text-[#6F6B63]">{formatWeekday(new Date())}</span>
						</div>
						<h1 className="mt-2 text-2xl font-semibold text-[#181713] sm:text-3xl">Today control desk</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-[#6F6B63]">
							Today lessons, attendance gaps, payment risk, and Google Calendar status.
						</p>
					</div>
					<div className="grid gap-2 sm:grid-cols-4 xl:w-[560px]">
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
					<div className="rounded-lg border border-[#EDCBC5] bg-[#F8E9E6] px-4 py-3 text-sm text-[#A64235]">
						{crm.error}
					</div>
				)}
				{crm.isLoading && (
					<div className="rounded-lg border border-[#E6E0D4] bg-white px-4 py-3 text-sm text-[#6F6B63]">
						Loading CRM data...
					</div>
				)}

				<section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
					<div className="grid min-w-0 gap-5">
						<SummaryStrip summary={crm.summary} />
						<LessonsPanel
							state={{ ...crm.state, lessons: todayLessons.length > 0 ? todayLessons : crm.state.lessons }}
							onAddLesson={crm.addLesson}
							onMarkGroupAttended={crm.markGroupAttended}
							onSyncLesson={crm.syncLesson}
						/>
						<StudentsPanel
							students={crm.visibleStudents}
							allStudents={crm.studentRows}
							lessons={crm.state.lessons}
							attendance={crm.state.attendance}
							filter={crm.studentFilter}
							onFilterChange={crm.setStudentFilter}
							onAddStudent={crm.addStudent}
							onUpdateStudent={crm.updateStudent}
							onArchiveStudent={crm.archiveStudent}
							onRecordPayment={crm.recordPayment}
						/>
					</div>
					<aside className="grid content-start gap-5">
						<section
							className="rounded-lg border border-[#E6E0D4] bg-white p-4 shadow-none"
							aria-label="Attention queue"
						>
							<div className="flex items-center justify-between gap-3">
								<div>
									<h2 className="text-base font-semibold text-[#181713]">Attention queue</h2>
									<p className="mt-1 text-sm text-[#6F6B63]">Items to clear before the day ends.</p>
								</div>
								<AlertTriangle className="h-5 w-5 text-[#9A6A1F]" />
							</div>
							<div className="mt-4 divide-y divide-[#EFE8DC]">
								{attentionItems.map((item) => (
									<div key={item.label} className="grid grid-cols-[1fr_auto] gap-3 py-3">
										<div className="min-w-0">
											<p className="text-sm font-medium text-[#181713]">{item.label}</p>
											<p className="mt-1 truncate text-xs text-[#6F6B63]">{item.detail}</p>
										</div>
										<Badge tone={item.tone} className="font-mono tabular-nums">
											{item.value}
										</Badge>
									</div>
								))}
							</div>
						</section>
						<CalendarPanel state={crm.state} onConnect={crm.connectCalendar} />
						<PaymentsPanel state={crm.state} />
					</aside>
				</section>
			</div>
		</main>
	)
}
