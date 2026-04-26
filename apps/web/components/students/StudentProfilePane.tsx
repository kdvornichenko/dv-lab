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
			<aside className="border-sage-line bg-sage-soft/45 rounded-lg border border-dashed p-5">
				<p className="text-ink font-semibold">Select a student</p>
				<p className="text-ink-muted mt-1 text-sm leading-5">
					Lessons, attendance, billing, and payment balance will appear here.
				</p>
			</aside>
		)
	}

	const projection = selectStudentLedgerProjection(student, lessons, attendance, now)
	const billingLabel = getBillingModeLabel(student.billingMode)

	return (
		<aside className="border-line bg-surface-muted overflow-hidden rounded-lg border">
			<div className="border-line-soft bg-surface border-b p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-sage font-mono text-xs font-semibold uppercase">Profile</p>
						<h3 className="text-ink mt-1 truncate text-lg font-semibold">{student.fullName}</h3>
						<p className="text-ink-muted mt-1 text-sm">{student.level || 'No level set'}</p>
					</div>
					<Badge tone={projection.statusTone}>{student.status}</Badge>
				</div>
			</div>

			<div className="p-4">
				<div className="grid grid-cols-2 gap-2">
					<Metric icon={CalendarCheck2} label="Scheduled" value={projection.stats.relatedLessons.length} tone="sage" />
					<Metric icon={ClipboardCheck} label="Attended" value={projection.stats.attendedCount} tone="success" />
					<Metric
						icon={ReceiptText}
						label={student.billingMode === 'package' ? 'Package' : 'Lessons'}
						value={projection.lessonsLeft}
						tone="warning"
					/>
					<Metric icon={Banknote} label="Balance" value={formatUsdAmount(student.balance.balance)} tone="danger" />
				</div>

				<div className="border-line-soft bg-surface mt-4 rounded-lg border p-3">
					<p className="text-ink-muted text-xs font-semibold uppercase">Next payment</p>
					<p className="text-ink mt-1 font-mono text-sm font-semibold tabular-nums">{projection.nextPayment}</p>
					<p className="text-ink-muted mt-1 text-xs">
						{student.balance.unpaidLessonCount} unpaid lessons · {billingLabel}
					</p>
				</div>

				<div className="divide-line-soft mt-4 divide-y text-sm">
					<ProfileRow icon={Mail} label="Email" value={student.email || 'Not set'} />
					<ProfileRow icon={Phone} label="Phone" value={student.phone || 'Not set'} />
					<ProfileRow
						icon={ReceiptText}
						label="Billing"
						value={`${billingLabel} · ${formatUsdAmount(student.defaultLessonPrice)}`}
					/>
					{student.billingMode === 'package' && (
						<ProfileRow
							icon={Banknote}
							label="Package"
							value={`${student.packageMonths} months · ${student.packageLessonCount} lessons · ${formatUsdAmount(
								projection.packageTotal
							)} total · ${formatUsdAmount(projection.packageLessonPrice)} per lesson`}
						/>
					)}
					<ProfileRow icon={NotebookText} label="Notes" value={student.notes || 'No notes'} multiline />
				</div>
			</div>
		</aside>
	)
}

function Metric({
	icon: Icon,
	label,
	value,
	tone,
}: {
	icon: ComponentType<{ className?: string }>
	label: string
	value: string | number
	tone: 'sage' | 'success' | 'warning' | 'danger'
}) {
	const toneClass = {
		sage: 'border-sage-line bg-sage-soft text-sage',
		success: 'border-success-line bg-success-soft text-success',
		warning: 'border-warning-line bg-warning-soft text-warning',
		danger: 'border-danger-line bg-danger-soft text-danger',
	}

	return (
		<div className="border-line-soft bg-surface rounded-lg border p-3">
			<div className="text-ink-muted flex items-center gap-1.5 text-xs font-medium">
				<span className={`flex size-6 items-center justify-center rounded-md border ${toneClass[tone]}`}>
					<Icon className="h-3.5 w-3.5" />
				</span>
				{label}
			</div>
			<div className="text-ink mt-2 truncate font-mono text-sm font-semibold tabular-nums">{value}</div>
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
		<div className="py-3 first:pt-0 last:pb-0">
			<div className="text-ink-muted mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase">
				<Icon className="text-sage h-3.5 w-3.5" />
				{label}
			</div>
			<p className={multiline ? 'text-ink whitespace-pre-wrap leading-5' : 'text-ink truncate'}>{value}</p>
		</div>
	)
}
