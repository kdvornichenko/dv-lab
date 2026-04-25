import type { ComponentType } from 'react'

import { Banknote, CalendarCheck2, ClipboardCheck, Mail, NotebookText, Phone, ReceiptText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatUsdAmount, getBillingModeLabel, selectStudentLedgerProjection } from '@/lib/crm/model'
import type { StudentWithBalance } from '@/lib/crm/types'

import type { AttendanceRecord, Lesson } from '@teacher-crm/api-types'

type StudentProfilePaneProps = {
	student: StudentWithBalance | null
	lessons: Lesson[]
	attendance: AttendanceRecord[]
	now: Date
}

export function StudentProfilePane({ student, lessons, attendance, now }: StudentProfilePaneProps) {
	if (!student) {
		return (
			<aside className="border-line-strong bg-surface-muted text-ink-muted rounded-lg border border-dashed p-4 text-sm">
				Select a student to view lessons, attendance, and payment balance.
			</aside>
		)
	}

	const projection = selectStudentLedgerProjection(student, lessons, attendance, now)
	const billingLabel = getBillingModeLabel(student.billingMode)

	return (
		<aside className="border-line bg-surface-muted rounded-lg border p-4">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0">
					<h3 className="text-ink truncate text-base font-semibold">{student.fullName}</h3>
					<p className="text-ink-muted mt-1 text-sm">{student.level || 'No level set'}</p>
				</div>
				<Badge tone={projection.statusTone}>{student.status}</Badge>
			</div>

			<div className="mt-4 grid grid-cols-2 gap-2">
				<Metric icon={CalendarCheck2} label="Scheduled" value={projection.stats.relatedLessons.length} />
				<Metric icon={ClipboardCheck} label="Attended" value={projection.stats.attendedCount} />
				<Metric icon={ReceiptText} label="Lessons left" value={projection.lessonsLeft} />
				<Metric icon={Banknote} label="Balance" value={formatUsdAmount(student.balance.balance)} />
			</div>

			<div className="border-line bg-surface mt-4 rounded-md border p-3">
				<p className="text-ink-muted text-xs font-medium uppercase">Next payment</p>
				<p className="text-ink mt-1 font-mono text-sm tabular-nums">{projection.nextPayment}</p>
				<p className="text-ink-muted mt-1 text-xs">
					{student.balance.unpaidLessonCount} unpaid lessons · {billingLabel}
				</p>
			</div>

			<div className="mt-4 space-y-3 text-sm">
				<ProfileRow icon={Mail} label="Email" value={student.email || 'Not set'} />
				<ProfileRow icon={Phone} label="Phone" value={student.phone || 'Not set'} />
				<ProfileRow
					icon={ReceiptText}
					label="Billing"
					value={`${billingLabel} · ${formatUsdAmount(student.defaultLessonPrice)}`}
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
		<div className="border-line bg-surface rounded-md border p-3">
			<div className="text-ink-muted flex items-center gap-1.5 text-xs">
				<Icon className="text-sage h-3.5 w-3.5" />
				{label}
			</div>
			<div className="text-ink mt-1 truncate font-mono text-sm font-semibold tabular-nums">{value}</div>
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
			<div className="text-ink-muted mb-1 flex items-center gap-1.5 text-xs font-medium uppercase">
				<Icon className="text-sage h-3.5 w-3.5" />
				{label}
			</div>
			<p className={multiline ? 'text-ink whitespace-pre-wrap' : 'text-ink truncate'}>{value}</p>
		</div>
	)
}
