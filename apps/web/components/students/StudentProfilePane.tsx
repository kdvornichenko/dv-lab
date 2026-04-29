import type { ComponentType } from 'react'

import { Banknote, CalendarCheck2, CheckCircle2, Copy, NotebookText, ReceiptText, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	formatCompletedLessonDatesText,
	formatCurrencyAmount,
	formatDateShort,
	formatTime,
	getBillingModeLabel,
	getStudentShortName,
	getStudentDurationPrice,
	isChargeableLessonStatus,
	selectStudentLedgerProjection,
} from '@/lib/crm/model'
import type { StudentWithBalance } from '@/lib/crm/types'

import type { Lesson } from '@teacher-crm/api-types'

type StudentProfilePaneProps = {
	student: StudentWithBalance | null
	lessons: Lesson[]
	now: Date
}

export function StudentProfilePane({ student, lessons, now }: StudentProfilePaneProps) {
	if (!student) {
		return (
			<aside className="rounded-lg border border-dashed border-sage-line bg-sage-soft/45 p-5">
				<p className="font-heading font-semibold text-ink">Select a student</p>
				<p className="mt-1 text-sm leading-5 text-ink-muted">Lessons, billing, and payment balance will appear here.</p>
			</aside>
		)
	}

	const projection = selectStudentLedgerProjection(student, lessons, now)
	const billingLabel = getBillingModeLabel(student.billingMode)
	const recentLessons = [...projection.stats.relatedLessons].sort(
		(a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
	)
	const completedCount = projection.stats.relatedLessons.filter((lesson) =>
		isChargeableLessonStatus(lesson.status)
	).length
	const packageProgress = projection.packageProgress
	const completedDatesText = formatCompletedLessonDatesText(packageProgress.completedLessons)
	const copyCompletedDates = async () => {
		try {
			await navigator.clipboard.writeText(completedDatesText)
			toast.success('Lesson dates copied')
		} catch {
			toast.error('Could not copy lesson dates')
		}
	}

	return (
		<aside className="overflow-hidden rounded-lg border border-line bg-surface-muted">
			<div className="border-b border-line-soft bg-surface p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="font-mono text-xs font-semibold text-sage uppercase">Profile</p>
						<h3 className="mt-1 truncate text-lg font-semibold text-ink">{student.fullName}</h3>
						<p className="mt-1 text-sm text-ink-muted">{student.level || 'No level set'}</p>
					</div>
					<Badge tone={projection.statusTone}>{student.status}</Badge>
				</div>
			</div>

			<div className="p-4">
				<div className="grid grid-cols-2 gap-2">
					<Metric icon={CalendarCheck2} label="Scheduled" value={projection.stats.relatedLessons.length} tone="sage" />
					<Metric icon={CheckCircle2} label="Charged" value={completedCount} tone="success" />
					<Metric
						icon={ReceiptText}
						label={student.billingMode === 'package' ? 'Package progress' : 'Lessons'}
						value={student.billingMode === 'package' ? packageProgress.label : projection.lessonsLeft}
						tone="warning"
					/>
					<Metric
						icon={Banknote}
						label="Balance"
						value={formatCurrencyAmount(student.balance.balance, student.currency)}
						tone="danger"
					/>
				</div>

				<div className="mt-4 rounded-lg border border-line-soft bg-surface p-3">
					<p className="text-xs font-semibold text-ink-muted uppercase">Next payment</p>
					<p className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">{projection.nextPayment}</p>
					<p className="mt-1 text-xs text-ink-muted">
						{student.balance.unpaidLessonCount} unpaid lessons · {billingLabel}
					</p>
				</div>

				{student.billingMode === 'package' && (
					<div className="mt-4 rounded-lg border border-line-soft bg-surface p-3">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-xs font-semibold text-ink-muted uppercase">Completed dates</p>
								<p className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">{packageProgress.label}</p>
								<p className="mt-1 text-xs text-ink-muted">{packageProgress.remainingLabel}</p>
							</div>
							<Button type="button" variant="secondary" size="sm" onClick={copyCompletedDates}>
								<Copy className="h-4 w-4" />
								Copy
							</Button>
						</div>
						<pre className="mt-3 rounded-lg border border-line-soft bg-surface-muted p-3 font-mono text-xs leading-5 whitespace-pre-wrap text-ink">
							{completedDatesText}
						</pre>
					</div>
				)}

				<div className="mt-4 rounded-lg border border-line-soft bg-surface p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs font-semibold text-ink-muted uppercase">Lesson history</p>
						<Badge tone="neutral" className="font-mono tabular-nums">
							{completedCount}/{projection.stats.relatedLessons.length}
						</Badge>
					</div>
					<div className="mt-3 grid gap-2">
						{recentLessons.slice(0, 5).map((lesson) => {
							return (
								<div key={lesson.id} className="rounded-lg border border-line-soft bg-surface-muted p-2.5">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="truncate font-heading text-sm font-medium text-ink">
												{getStudentShortName(student)}
											</p>
											<p className="mt-1 font-mono text-xs text-ink-muted tabular-nums">
												{formatDateShort(lesson.startsAt)} · {formatTime(lesson.startsAt)}
											</p>
										</div>
										<Badge tone={lessonStatusTone(lesson.status)}>{lesson.status}</Badge>
									</div>
								</div>
							)
						})}
						{recentLessons.length === 0 && (
							<p className="rounded-lg border border-dashed border-line-strong bg-surface-muted p-3 text-sm text-ink-muted">
								No lessons scheduled for this student yet.
							</p>
						)}
					</div>
				</div>

				<div className="mt-4 divide-y divide-line-soft text-sm">
					<ProfileRow icon={Sparkles} label="Special" value={student.special || 'Not set'} />
					<ProfileRow
						icon={ReceiptText}
						label="Billing"
						value={`${billingLabel} · ${formatCurrencyAmount(student.defaultLessonPrice, student.currency)} base · ${
							student.defaultLessonDurationMinutes
						} min · ${formatCurrencyAmount(getStudentDurationPrice(student), student.currency)} actual`}
					/>
					{student.billingMode === 'package' && (
						<ProfileRow
							icon={Banknote}
							label="Package"
							value={`${student.packageMonths} months · ${student.packageLessonCount} lessons · ${formatCurrencyAmount(
								projection.packageTotal,
								student.currency
							)} total · ${formatCurrencyAmount(projection.packageLessonPrice, student.currency)} per lesson`}
						/>
					)}
					<ProfileRow icon={NotebookText} label="Notes" value={student.notes || 'No notes'} multiline />
				</div>
			</div>
		</aside>
	)
}

function lessonStatusTone(status: Lesson['status']) {
	if (status === 'completed') return 'green'
	if (status === 'no_show') return 'amber'
	if (status === 'rescheduled') return 'amber'
	if (status === 'cancelled') return 'red'
	return 'neutral'
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
		<div className="rounded-lg border border-line-soft bg-surface p-3">
			<div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
				<span className={`flex size-6 items-center justify-center rounded-md border ${toneClass[tone]}`}>
					<Icon className="h-3.5 w-3.5" />
				</span>
				{label}
			</div>
			<div className="mt-2 truncate font-mono text-sm font-semibold text-ink tabular-nums">{value}</div>
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
			<div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-muted uppercase">
				<Icon className="h-3.5 w-3.5 text-sage" />
				{label}
			</div>
			<p className={multiline ? 'leading-5 whitespace-pre-wrap text-ink' : 'truncate text-ink'}>{value}</p>
		</div>
	)
}
