'use client'

import { Fragment, useState } from 'react'

import { Check, ChevronDown, Copy, TriangleAlert } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import {
	datesPlural,
	lessonCountMonths,
	lessonCountText,
	periodText,
	type LessonCountMonth,
} from '@/lib/lesson-count-text'
import { dayMonthShort, formatDate, yearInZone } from '@/lib/schedule-format'
import { dayHref } from '@/lib/schedule-links'
import { copyTooltip, useCopy } from '@/lib/use-copy'
import { cn } from '@/lib/utils'

import { TextLink } from '../../../chat/_components/agent-links'

const MONTHS_SHOWN = 6
const NOTE_DATES_MAX = 3

export interface HeldDatesProps {
	form: 'full' | 'short'
	studentName: string
	dates: readonly string[]
	minutes: number
	period: { from: string; to: string }
	sincePayment: boolean
	lastPaidOn: string | null
	beforePayment: readonly string[]
	coverage: 'complete' | 'partial'
	loading?: boolean
	mainTimeZone: string
	onAllLessons?: () => void
}

export function heldDatesCopyText(input: {
	studentName: string
	dates: readonly string[]
	period: { from: string; to: string }
	sincePayment: boolean
	lastPaidOn: string | null
	year: number
}): string {
	const sorted = [...new Set(input.dates)].sort()
	const first = sorted[0] ?? input.period.from
	const last = sorted[sorted.length - 1] ?? input.period.to
	const scope =
		input.sincePayment && input.lastPaidOn !== null
			? `Held lessons since the last payment (${formatDate(input.lastPaidOn, input.year)})`
			: `Held lessons, ${periodText(input.period.from, input.period.to, '–')}`
	return [`Lessons of ${input.studentName}, ${periodText(first, last, '–')}`, scope, lessonCountText(sorted)].join('\n')
}

function joinDates(dates: readonly string[], year: number): string {
	if (dates.length > NOTE_DATES_MAX) return `${dates.length} lessons`
	const words = dates.map((date) => formatDate(date, year))
	if (words.length < 2) return words.join('')
	return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

function MonthLine({ month, year }: { month: LessonCountMonth; year: number }) {
	const last = month.days.length - 1
	return (
		<p data-slot="held-dates-month" className="leading-6 pointer-coarse:leading-8">
			{month.days.map((entry, index) => {
				const link = (
					<TextLink
						href={dayHref(entry.date)}
						title={`Open ${formatDate(entry.date, year)} in calendar`}
						className="whitespace-nowrap pointer-coarse:-mx-1 pointer-coarse:px-1 pointer-coarse:py-1"
					>
						{entry.day}
					</TextLink>
				)
				return (
					<Fragment key={entry.date}>
						{index === last ? (
							<span className="whitespace-nowrap">
								{link} - {month.name}
							</span>
						) : (
							<>
								{link}
								{', '}
							</>
						)}
					</Fragment>
				)
			})}
		</p>
	)
}

function CopyDates({ text, disabled }: { text: string; disabled: boolean }) {
	const { state, copy } = useCopy()
	return (
		<>
			<Tooltip side="top" forceOpen={state === 'idle' ? undefined : true} content={copyTooltip(state, 'Copy dates')}>
				<Button
					variant="secondary"
					size="icon-compact"
					aria-label="Copy dates"
					disabled={disabled}
					className="shrink-0 pointer-coarse:size-9"
					onClick={() => void copy(text)}
				>
					{state === 'copied' ? <Check /> : <Copy />}
				</Button>
			</Tooltip>
			<span className="sr-only" aria-live="polite">
				{state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : ''}
			</span>
		</>
	)
}

function LoadingLines() {
	return (
		<div data-slot="held-dates-loading" aria-hidden className="flex flex-col gap-2 rounded-lg bg-hover px-3 py-2">
			<Skeleton className="h-3 w-48" />
			<Skeleton className="h-3 w-32" />
		</div>
	)
}

export function HeldDates(props: HeldDatesProps) {
	const { form, studentName, dates, minutes, period, sincePayment, lastPaidOn, beforePayment, coverage, loading } =
		props
	const [all, setAll] = useState(false)
	const year = yearInZone(new Date(), props.mainTimeZone)
	const short = form === 'short'
	const months = lessonCountMonths(dates)
	const total = months.reduce((sum, month) => sum + month.days.length, 0)
	const folded = months.length > MONTHS_SHOWN
	const partial = coverage === 'partial'
	const title = short
		? 'Held since the last payment'
		: sincePayment
			? 'Held lessons since the last payment'
			: `Held lessons, ${periodText(period.from, period.to, '–')}`
	const scope =
		sincePayment && lastPaidOn !== null
			? `Payment of ${formatDate(lastPaidOn, year)} · ${datesPlural(total)} · ${minutes} min`
			: `${datesPlural(total)} · ${minutes} min`
	const text = heldDatesCopyText({ studentName, dates, period, sincePayment, lastPaidOn, year })
	const allLessons =
		short && props.onAllLessons !== undefined ? (
			<Button variant="ghost" size="compact" onClick={props.onAllLessons}>
				All lessons
			</Button>
		) : null
	return (
		<Panel>
			<div
				role="group"
				aria-label={title}
				data-slot="held-dates"
				data-form={form}
				data-state={loading ? 'loading' : partial ? 'partial' : total === 0 ? 'empty' : 'ready'}
				className="flex flex-col gap-2.5 px-4 py-3"
			>
				<div className="flex items-start gap-2 max-sm:flex-wrap">
					<p className="min-w-0 flex-1 text-body font-semibold text-foreground sm:truncate">{title}</p>
					{allLessons === null ? null : <span className="max-sm:hidden">{allLessons}</span>}
					<CopyDates text={text} disabled={loading === true || partial || total === 0} />
				</div>
				{loading ? (
					<LoadingLines />
				) : partial ? (
					<p data-slot="held-dates-partial" className="flex items-start gap-2 text-caption text-muted-foreground">
						<TriangleAlert aria-hidden size={14} className="mt-0.5 shrink-0 text-warning" />
						<span className="min-w-0 flex-1">Not checked in full. Counted from the part that was read.</span>
					</p>
				) : null}
				{loading ? null : total === 0 ? (
					partial ? null : (
						<p className="text-body text-muted-foreground">No held lessons in this range.</p>
					)
				) : (
					<>
						<p data-slot="held-dates-scope" className="text-caption text-muted-foreground tabular-nums">
							{scope}
						</p>
						<div className="rounded-lg bg-hover px-3 py-2 text-body tabular-nums">
							{months.slice(0, MONTHS_SHOWN).map((month) => (
								<MonthLine key={month.key} month={month} year={year} />
							))}
							{folded ? (
								<div
									className={cn(
										'grid transition-[grid-template-rows] duration-160 ease-out motion-reduce:transition-none',
										all ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
									)}
								>
									<div className="min-h-0 overflow-hidden" inert={!all}>
										{months.slice(MONTHS_SHOWN).map((month) => (
											<MonthLine key={month.key} month={month} year={year} />
										))}
									</div>
								</div>
							) : null}
						</div>
						{folded ? (
							<Button
								variant="ghost"
								size="compact"
								aria-expanded={all}
								className="-ml-2 self-start text-caption text-muted-foreground pointer-coarse:h-8"
								onClick={() => setAll((value) => !value)}
							>
								{all ? 'Show fewer months' : `Show all ${months.length} months`}
								<ChevronDown
									size={14}
									aria-hidden
									className={cn('transition-transform duration-120', all && 'rotate-180')}
								/>
							</Button>
						) : null}
					</>
				)}
				{loading || short || !sincePayment || lastPaidOn === null || beforePayment.length === 0 ? null : (
					<p data-slot="held-dates-note" className="text-caption text-muted-foreground">
						Includes {joinDates(beforePayment, year)}, held before the payment on {dayMonthShort(lastPaidOn)} and
						covered by it.
					</p>
				)}
				{allLessons === null ? null : <span className="self-start sm:hidden">{allLessons}</span>}
			</div>
		</Panel>
	)
}
