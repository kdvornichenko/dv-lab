'use client'

import { BookOpenCheck } from 'lucide-react'

import { CalendarPanel } from './CalendarPanel'
import { LessonsPanel } from './LessonsPanel'
import { PaymentsPanel } from './PaymentsPanel'
import { StudentsPanel } from './StudentsPanel'
import { SummaryStrip } from './SummaryStrip'
import { useTeacherCrm } from './useTeacherCrm'

export function TeacherDashboard() {
	const crm = useTeacherCrm()

	return (
		<main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
			<div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
				<header className="flex flex-col gap-3 border-b border-zinc-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<div className="flex items-center gap-2 text-sm font-medium text-sky-700">
							<BookOpenCheck className="h-4 w-4" />
							Teacher English CRM
						</div>
						<h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl">Daily control desk</h1>
					</div>
					<p className="max-w-xl text-sm leading-6 text-zinc-600">
						Students, attendance, payments, and Google Calendar sync are kept in one working view.
					</p>
				</header>

				{crm.error && (
					<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{crm.error}</div>
				)}
				{crm.isLoading && (
					<div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">
						Loading CRM data...
					</div>
				)}

				<SummaryStrip summary={crm.summary} />

				<section className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
					<div className="flex flex-col gap-5">
						<StudentsPanel
							students={crm.visibleStudents}
							filter={crm.studentFilter}
							onFilterChange={crm.setStudentFilter}
							onAddStudent={crm.addStudent}
							onArchiveStudent={crm.archiveStudent}
							onRecordPayment={crm.recordPayment}
						/>
						<LessonsPanel
							state={crm.state}
							onAddLesson={crm.addLesson}
							onMarkGroupAttended={crm.markGroupAttended}
							onSyncLesson={crm.syncLesson}
						/>
					</div>
					<aside className="flex flex-col gap-5">
						<CalendarPanel state={crm.state} onConnect={crm.connectCalendar} />
						<PaymentsPanel state={crm.state} />
					</aside>
				</section>
			</div>
		</main>
	)
}
