import type { FC } from 'react'

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

import { lessonStatusTone, ProfileMetric, ProfileRow } from './StudentProfileParts'
import type { StudentProfilePaneProps } from './StudentProfilePane.types'

export const StudentProfilePane: FC<StudentProfilePaneProps> = ({ student, lessons, now }) => {
	if (!student) {
		return (
			<aside className="border-sage-line bg-sage-soft/45 rounded-lg border border-dashed p-5">
				<p className="font-heading text-ink font-semibold">Select a student</p>
				<p className="text-ink-muted mt-1 text-sm leading-5">Lessons, billing, and payment balance will appear here.</p>
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
		<aside className="border-line bg-surface-muted overflow-hidden rounded-lg border">
			<div className="border-line-soft bg-surface border-b p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-sage font-mono text-xs font-semibold uppercase">Profile</p>
						<h3 className="text-ink mt-1 truncate text-lg font-semibold" data-private>
							{student.fullName}
						</h3>
						<p className="text-ink-muted mt-1 text-sm" data-private>
							{student.level || 'No level set'}
						</p>
					</div>
					<div className="flex flex-wrap justify-end gap-1.5">
						{student.packageLessonPriceOverride !== null && <Badge tone="neutral">custom plan</Badge>}
						<Badge tone={projection.statusTone}>{student.status}</Badge>
					</div>
				</div>
			</div>

			<div className="p-4">
				<div className="grid grid-cols-2 gap-2">
					<ProfileMetric icon={CalendarCheck2} label="Scheduled" value={projection.stats.relatedLessons.length} tone="sage" />
					<ProfileMetric icon={CheckCircle2} label="Charged" value={completedCount} tone="success" />
					<ProfileMetric
						icon={ReceiptText}
						label={student.billingMode === 'package' ? 'Package progress' : 'Lessons'}
						value={student.billingMode === 'package' ? packageProgress.label : projection.lessonsLeft}
						tone="warning"
					/>
					<ProfileMetric
						icon={Banknote}
						label="Balance"
						value={formatCurrencyAmount(student.balance.balance, student.currency)}
						tone="danger"
					/>
				</div>

				<div className="border-line-soft bg-surface mt-4 rounded-lg border p-3">
					<p className="text-ink-muted text-xs font-semibold uppercase">Next payment</p>
					<p className="text-ink mt-1 font-mono text-sm font-semibold tabular-nums">{projection.nextPayment}</p>
					<p className="text-ink-muted mt-1 text-xs">
						{student.balance.unpaidLessonCount} unpaid lessons · {billingLabel}
					</p>
				</div>

				{student.billingMode === 'package' && (
					<div className="border-line-soft bg-surface mt-4 rounded-lg border p-3">
						<div className="flex items-start justify-between gap-3">
							<div>
								<p className="text-ink-muted text-xs font-semibold uppercase">Completed dates</p>
								<p className="text-ink mt-1 font-mono text-sm font-semibold tabular-nums">{packageProgress.label}</p>
								<p className="text-ink-muted mt-1 text-xs">{packageProgress.remainingLabel}</p>
							</div>
							<Button type="button" variant="secondary" size="sm" onClick={copyCompletedDates}>
								<Copy className="h-4 w-4" />
								Copy
							</Button>
						</div>
						<pre className="border-line-soft bg-surface-muted text-ink mt-3 whitespace-pre-wrap rounded-lg border p-3 font-mono text-xs leading-5">
							{completedDatesText}
						</pre>
					</div>
				)}

				<div className="border-line-soft bg-surface mt-4 rounded-lg border p-3">
					<div className="flex items-center justify-between gap-3">
						<p className="text-ink-muted text-xs font-semibold uppercase">Lesson history</p>
						<Badge tone="neutral" className="font-mono tabular-nums">
							{completedCount}/{projection.stats.relatedLessons.length}
						</Badge>
					</div>
					<div className="mt-3 grid gap-2">
						{recentLessons.slice(0, 5).map((lesson) => {
							return (
								<div key={lesson.id} className="border-line-soft bg-surface-muted rounded-lg border p-2.5">
									<div className="flex items-start justify-between gap-3">
										<div className="min-w-0">
											<p className="font-heading text-ink truncate text-sm font-medium">
												{getStudentShortName(student)}
											</p>
											<p className="text-ink-muted mt-1 font-mono text-xs tabular-nums">
												{formatDateShort(lesson.startsAt)} · {formatTime(lesson.startsAt)}
											</p>
										</div>
										<Badge tone={lessonStatusTone(lesson.status)}>{lesson.status}</Badge>
									</div>
								</div>
							)
						})}
						{recentLessons.length === 0 && (
							<p className="border-line-strong bg-surface-muted text-ink-muted rounded-lg border border-dashed p-3 text-sm">
								No lessons scheduled for this student yet.
							</p>
						)}
					</div>
				</div>

				<div className="divide-line-soft mt-4 divide-y text-sm">
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
