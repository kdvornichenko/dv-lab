import type { ComponentType } from 'react'

import { Banknote, CalendarCheck2, ClipboardCheck, Mail, NotebookText, Phone, ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import type { AttendanceRecord, Lesson } from '@teacher-crm/api-types'

import { formatDateShort, formatMoney } from './model'
import type { StudentWithBalance } from './types'

type StudentProfilePaneProps = {
	student: StudentWithBalance | null
	lessons: Lesson[]
	attendance: AttendanceRecord[]
}

export function StudentProfilePane({ student, lessons, attendance }: StudentProfilePaneProps) {
	if (!student) {
		return (
			<aside className="rounded-lg border border-dashed border-[#D8D0C2] bg-[#FBFAF6] p-4 text-sm text-[#6F6B63]">
				Select a student to view lessons, attendance, and payment balance.
			</aside>
		)
	}

	const studentLessons = lessons.filter((lesson) => lesson.studentIds.includes(student.id))
	const attendanceCount = attendance.filter(
		(record) => record.studentId === student.id && record.status === 'attended'
	).length
	const nextLesson = studentLessons
		.filter((lesson) => new Date(lesson.startsAt).getTime() >= Date.now())
		.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0]
	const lessonsLeft = student.billingMode === 'package' ? 'Track soon' : `${student.balance.unpaidLessonCount} unpaid`

	return (
		<aside className="rounded-lg border border-[#E6E0D4] bg-[#FBFAF6] p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="truncate text-base font-semibold text-[#181713]">{student.fullName}</h3>
					<p className="mt-1 text-sm text-[#6F6B63]">{student.level || 'No level set'}</p>
				</div>
				<Badge tone={student.status === 'active' ? 'green' : student.status === 'paused' ? 'amber' : 'neutral'}>
					{student.status}
				</Badge>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-2">
				<Metric icon={CalendarCheck2} label="Scheduled" value={studentLessons.length} />
				<Metric icon={ClipboardCheck} label="Attended" value={attendanceCount} />
				<Metric icon={ReceiptText} label="Lessons left" value={lessonsLeft} />
				<Metric icon={Banknote} label="Balance" value={formatMoney(student.balance.balance)} />
			</div>

			<div className="mt-4 rounded-md border border-[#E6E0D4] bg-white p-3">
				<p className="text-xs font-medium uppercase text-[#6F6B63]">Next payment</p>
				<p className="mt-1 font-mono text-sm tabular-nums text-[#181713]">
					{student.balance.overdue
						? 'Due now'
						: nextLesson
							? `After ${formatDateShort(nextLesson.startsAt)}`
							: 'Not scheduled'}
				</p>
				<p className="mt-1 text-xs text-[#6F6B63]">
					{student.balance.unpaidLessonCount} unpaid lessons · {student.billingMode.replace('_', ' ')}
				</p>
			</div>

			<div className="mt-4 space-y-3 text-sm">
				<ProfileRow icon={Mail} label="Email" value={student.email || 'Not set'} />
				<ProfileRow icon={Phone} label="Phone" value={student.phone || 'Not set'} />
				<ProfileRow
					icon={ReceiptText}
					label="Billing"
					value={`${student.billingMode.replace('_', ' ')} · ${formatMoney(student.defaultLessonPrice)}`}
				/>
				<ProfileRow icon={NotebookText} label="Notes" value={student.notes || 'No notes'} multiline />
			</div>
		</aside>
	)
}

function Metric({
	icon: Icon,
	label,
	value,
}: {
	icon: ComponentType<{ className?: string }>
	label: string
	value: string | number
}) {
	return (
		<div className="rounded-md border border-[#E6E0D4] bg-white p-3">
			<div className="flex items-center gap-1.5 text-xs text-[#6F6B63]">
				<Icon className="h-3.5 w-3.5 text-[#2F6F5E]" />
				{label}
			</div>
			<div className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-[#181713]">{value}</div>
		</div>
	)
}

function ProfileRow({
	icon: Icon,
	label,
	value,
	multiline = false,
}: {
	icon: ComponentType<{ className?: string }>
	label: string
	value: string
	multiline?: boolean
}) {
	return (
		<div>
			<div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-[#6F6B63]">
				<Icon className="h-3.5 w-3.5 text-[#2F6F5E]" />
				{label}
			</div>
			<p className={multiline ? 'whitespace-pre-wrap text-[#181713]' : 'truncate text-[#181713]'}>{value}</p>
		</div>
	)
}
