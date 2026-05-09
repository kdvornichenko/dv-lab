import { type FC, useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'

import {
	Banknote,
	CalendarCheck2,
	CalendarDays,
	CheckCircle2,
	Copy,
	NotebookText,
	ReceiptText,
	Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
	formatCompletedLessonDatesText,
	formatCurrencyAmount,
	formatDateShortEn,
	getBillingModeLabel,
	getStudentDurationPrice,
	isChargeableLessonStatus,
	selectStudentLedgerProjection,
} from '@/lib/crm/model'

import type { StudentProfilePaneProps } from './StudentProfilePane.types'
import { ProfileMetric, ProfileRow } from './StudentProfileParts'

type StudentLesson = StudentProfilePaneProps['lessons'][number]

function startOfDay(value: Date) {
	const date = new Date(value)
	date.setHours(0, 0, 0, 0)
	return date
}

function endOfDay(value: Date) {
	const date = new Date(value)
	date.setHours(23, 59, 59, 999)
	return date
}

function sortLessonsByStart(lessons: StudentLesson[]) {
	return [...lessons].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
}

function selectLessonsInRange(lessons: StudentLesson[], range?: DateRange) {
	if (!range?.from) return lessons

	const from = startOfDay(range.from).getTime()
	const to = endOfDay(range.to ?? range.from).getTime()
	return lessons.filter((lesson) => {
		const startsAt = new Date(lesson.startsAt).getTime()
		return startsAt >= from && startsAt <= to
	})
}

function formatLessonHistoryRange(range?: DateRange) {
	if (!range?.from) return undefined
	if (!range.to) return formatDateShortEn(range.from)
	return `${formatDateShortEn(range.from)} - ${formatDateShortEn(range.to)}`
}

export const StudentProfilePane: FC<StudentProfilePaneProps> = ({ student, lessons, now }) => {
	const [lessonHistoryRange, setLessonHistoryRange] = useState<DateRange | undefined>()

	useEffect(() => {
		setLessonHistoryRange(undefined)
	}, [student?.id])

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
	const completedCount = projection.stats.relatedLessons.filter((lesson) =>
		isChargeableLessonStatus(lesson.status)
	).length
	const packageProgress = projection.packageProgress
	const chargedLessons = sortLessonsByStart(
		projection.stats.relatedLessons.filter((lesson) => isChargeableLessonStatus(lesson.status))
	)
	const defaultLessonHistory = student.billingMode === 'package' ? packageProgress.completedLessons : chargedLessons
	const lessonHistoryLessons = sortLessonsByStart(
		lessonHistoryRange?.from ? selectLessonsInRange(chargedLessons, lessonHistoryRange) : defaultLessonHistory
	)
	const lessonHistoryRangeLabel =
		formatLessonHistoryRange(lessonHistoryRange) ??
		(student.billingMode === 'package' ? 'Current package' : 'All charged lessons')
	const lessonHistorySummary = lessonHistoryRange?.from
		? `${lessonHistoryLessons.length} charged`
		: student.billingMode === 'package'
			? `${packageProgress.label} · ${packageProgress.remainingLabel}`
			: `${completedCount} charged`
	const completedDatesText = formatCompletedLessonDatesText(lessonHistoryLessons)
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
						<h3 className="mt-1 truncate text-lg font-semibold text-ink" data-private>
							{student.fullName}
						</h3>
						<p className="mt-1 text-sm text-ink-muted" data-private>
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
					<ProfileMetric
						icon={CalendarCheck2}
						label="Scheduled"
						value={projection.stats.relatedLessons.length}
						tone="sage"
					/>
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

				<div className="mt-4 rounded-lg border border-line-soft bg-surface p-3">
					<p className="text-xs font-semibold text-ink-muted uppercase">Next payment</p>
					<p className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">{projection.nextPayment}</p>
					<p className="mt-1 text-xs text-ink-muted">
						{student.balance.unpaidLessonCount} unpaid lessons · {billingLabel}
					</p>
				</div>

				<div className="mt-4 rounded-lg border border-line-soft bg-surface p-3">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
							<p className="text-xs font-semibold text-ink-muted uppercase">Lesson history</p>
							<p className="mt-1 font-mono text-sm font-semibold text-ink tabular-nums">{lessonHistorySummary}</p>
							<p className="mt-1 text-xs text-ink-muted">{lessonHistoryRangeLabel}</p>
						</div>
						<div className="flex shrink-0 items-center gap-1.5">
							<Popover>
								<PopoverTrigger asChild>
									<Button
										type="button"
										variant="outline"
										size="icon"
										aria-label="Select lesson history range"
										title="Select lesson history range"
									>
										<CalendarDays className="h-4 w-4" />
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
									<Calendar
										mode="range"
										selected={lessonHistoryRange}
										onSelect={setLessonHistoryRange}
										numberOfMonths={2}
										captionLayout="dropdown"
										startMonth={new Date(2020, 0)}
										endMonth={new Date(2030, 11)}
									/>
								</PopoverContent>
							</Popover>
							<Tooltip>
								<TooltipTrigger asChild>
									<Button
										type="button"
										variant="secondary"
										size="icon"
										aria-label="Copy lesson history"
										onClick={copyCompletedDates}
									>
										<Copy className="h-4 w-4" />
									</Button>
								</TooltipTrigger>
								<TooltipContent sideOffset={6}>Copy lesson history</TooltipContent>
							</Tooltip>
						</div>
					</div>
					<pre className="mt-3 rounded-lg border border-line-soft bg-surface-muted p-3 font-mono text-xs leading-5 whitespace-pre-wrap text-ink">
						{completedDatesText}
					</pre>
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
