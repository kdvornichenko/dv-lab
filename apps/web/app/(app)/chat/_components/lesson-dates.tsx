'use client'

import { Fragment, useState } from 'react'

import { Check, ChevronDown, ChevronUp, Copy, TriangleAlert } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import {
	datesPlural,
	lessonCountMonths,
	lessonCountText,
	periodText,
	type LessonCountMonth,
} from '@/lib/lesson-count-text'
import { formatDate, yearInZone } from '@/lib/schedule-format'
import { dayHref } from '@/lib/schedule-links'
import { copyTooltip, useCopy } from '@/lib/use-copy'
import { cn } from '@/lib/utils'

import type { ChatLessonDateScope, ChatLessonDatesBlock } from '@dv-lab/contracts'

import { TextLink } from './agent-links'
import { StudentMention } from './student-mention'

const MONTHS_SHOWN = 6

const SCOPE_WORDS: Record<ChatLessonDateScope, string> = {
	held: 'Held lessons',
	ahead: 'Lessons still ahead',
	no_show: 'No-shows',
	all: 'All lessons',
	since_payment: 'Held lessons since the last payment',
}

function leftOutLine(leftOut: ChatLessonDatesBlock['leftOut']): string | null {
	const parts: string[] = []
	if (leftOut.noShow > 0) parts.push(`${leftOut.noShow} ${leftOut.noShow === 1 ? 'no-show' : 'no-shows'}`)
	if (leftOut.ahead > 0) parts.push(`${leftOut.ahead} still ahead`)
	return parts.length === 0 ? null : `Not in the list: ${parts.join(', ')}.`
}

function MonthLine({ month, year }: { month: LessonCountMonth; year: number }) {
	const last = month.days.length - 1
	return (
		<p data-slot="chat-dates-month" className="leading-6 pointer-coarse:leading-8">
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

export function LessonDates({ block }: { block: ChatLessonDatesBlock }) {
	const [all, setAll] = useState(false)
	const { state, copy } = useCopy()
	const months = lessonCountMonths(block.dates)
	const total = months.reduce((sum, month) => sum + month.days.length, 0)
	const year = yearInZone(new Date(), block.defaultTimeZone)
	const period = periodText(block.from, block.to, '–')
	const since = block.scope === 'since_payment'
	const folded = months.length > MONTHS_SHOWN
	const left = leftOutLine(block.leftOut)
	return (
		<Panel>
			<div
				role="group"
				aria-label={`Lessons of ${block.studentName}, ${period}`}
				data-slot="chat-lesson-dates"
				className="flex flex-col gap-2.5 px-4 py-3"
			>
				<div className="flex items-start gap-2 max-sm:flex-wrap">
					<p className="min-w-0 flex-1 text-body font-semibold text-foreground sm:truncate">
						Lessons of <StudentMention studentId={block.studentId}>{block.studentName}</StudentMention>, {period}
					</p>
					{total === 0 ? null : (
						<>
							<Tooltip
								side="top"
								forceOpen={state === 'idle' ? undefined : true}
								content={copyTooltip(state, 'Copy dates')}
							>
								<Button
									variant="secondary"
									size="icon-compact"
									aria-label="Copy dates"
									className="shrink-0 pointer-coarse:size-9"
									onClick={() => void copy(lessonCountText(block.dates))}
								>
									{state === 'copied' ? <Check /> : <Copy />}
								</Button>
							</Tooltip>
							<span className="sr-only" aria-live="polite">
								{state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : ''}
							</span>
						</>
					)}
				</div>
				{total === 0 ? (
					since ? (
						<div className="flex flex-col gap-0.5">
							<p className="text-body text-muted-foreground">No lessons since the last payment.</p>
							{block.lastPaidOn ? (
								<p className="text-caption text-muted-foreground tabular-nums">
									Last payment: {formatDate(block.lastPaidOn, 0)}.
								</p>
							) : null}
						</div>
					) : (
						<p className="text-body text-muted-foreground">No lessons in this period.</p>
					)
				) : (
					<>
						<p className="text-caption text-muted-foreground tabular-nums">
							{SCOPE_WORDS[block.scope]}
							{since ? ` (${formatDate(block.sinceFrom ?? block.from, year)})` : ''} · {datesPlural(total)}
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
								trailingIcon={all ? ChevronUp : ChevronDown}
								className="-ml-2 self-start text-caption text-muted-foreground pointer-coarse:h-8"
								onClick={() => setAll((value) => !value)}
							>
								{all ? 'Show fewer months' : `Show all ${months.length} months`}
							</Button>
						) : null}
					</>
				)}
				{left === null ? null : <p className="text-caption text-muted-foreground">{left}</p>}
				{block.coverage === 'partial' ? (
					<p role="status" className="flex items-start gap-2 text-caption text-muted-foreground">
						<TriangleAlert aria-hidden size={14} className="mt-0.5 shrink-0 text-warning" />
						<span className="min-w-0 flex-1">Some records could not be read. The dates may be incomplete.</span>
					</p>
				) : null}
			</div>
		</Panel>
	)
}
