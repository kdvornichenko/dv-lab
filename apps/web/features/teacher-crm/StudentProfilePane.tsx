import type { ComponentType } from 'react'

import { Banknote, CalendarCheck2, ClipboardCheck, Mail, NotebookText, Phone, ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

import type { AttendanceRecord, Lesson } from '@teacher-crm/api-types'

import { formatMoney } from './model'
import type { StudentWithBalance } from './types'

type StudentProfilePaneProps = {
	student: StudentWithBalance | null
	lessons: Lesson[]
	attendance: AttendanceRecord[]
}

export function StudentProfilePane({ student, lessons, attendance }: StudentProfilePaneProps) {
	if (!student) {
		return (
			<div className="rounded-md border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
				Select a student to view profile details.
			</div>
		)
	}

	const lessonCount = lessons.filter((lesson) => lesson.studentIds.includes(student.id)).length
	const attendanceCount = attendance.filter(
		(record) => record.studentId === student.id && record.status === 'attended'
	).length

	return (
		<aside className="rounded-md border border-zinc-200 bg-zinc-50/70 p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="text-base font-semibold text-zinc-950">{student.fullName}</h3>
					<p className="mt-1 text-sm text-zinc-600">{student.level || 'No level set'}</p>
				</div>
				<Badge tone={student.status === 'active' ? 'green' : student.status === 'paused' ? 'amber' : 'neutral'}>
					{student.status}
				</Badge>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-2">
				<Metric icon={CalendarCheck2} label="Lessons" value={lessonCount} />
				<Metric icon={ClipboardCheck} label="Attended" value={attendanceCount} />
				<Metric icon={Banknote} label="Balance" value={formatMoney(student.balance.balance)} />
				<Metric icon={ReceiptText} label="Unpaid" value={student.balance.unpaidLessonCount} />
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
		<div className="rounded-md border border-zinc-200 bg-white p-3">
			<div className="flex items-center gap-1.5 text-xs text-zinc-500">
				<Icon className="h-3.5 w-3.5" />
				{label}
			</div>
			<div className="mt-1 truncate text-sm font-semibold text-zinc-950">{value}</div>
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
			<div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase text-zinc-500">
				<Icon className="h-3.5 w-3.5" />
				{label}
			</div>
			<p className={multiline ? 'whitespace-pre-wrap text-zinc-700' : 'truncate text-zinc-700'}>{value}</p>
		</div>
	)
}
