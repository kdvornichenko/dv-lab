'use client'

import { useState } from 'react'

import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { datesPlural, lessonCountMonths, lessonCountText, periodText } from '@/lib/lesson-count-text'
import { formatDate, yearInZone } from '@/lib/schedule-format'
import { copyTooltip, useCopy } from '@/lib/use-copy'
import { cn } from '@/lib/utils'

import type { ChatCalendarEventsBlock, ChatCalendarEventsGroup } from '@dv-lab/contracts'

import { MonthLine } from './lesson-dates'

function EventsGroup({ group, label, year }: { group: ChatCalendarEventsGroup; label: string; year: number }) {
	const [open, setOpen] = useState(false)
	const { state, copy } = useCopy()
	const dates = group.events.map((event) => event.date)
	const months = lessonCountMonths(dates)
	const total = months.reduce((sum, month) => sum + month.days.length, 0)
	return (
		<section aria-label={label} data-slot="chat-calendar-group" className="flex flex-col gap-2">
			<div className="flex items-start gap-2">
				<div className="min-w-0 flex-1">
					<p className="text-body font-semibold text-foreground sm:truncate" title={label}>
						{label}
					</p>
					<p className="text-caption text-muted-foreground tabular-nums">{datesPlural(total)}</p>
				</div>
				<Tooltip side="top" forceOpen={state === 'idle' ? undefined : true} content={copyTooltip(state, 'Copy dates')}>
					<Button
						variant="secondary"
						size="icon-compact"
						aria-label={`Copy dates: ${label}`}
						data-slot="chat-calendar-copy"
						className="shrink-0 pointer-coarse:size-9"
						onClick={() => void copy(lessonCountText(dates))}
					>
						{state === 'copied' ? <Check /> : <Copy />}
					</Button>
				</Tooltip>
				<span className="sr-only" aria-live="polite">
					{state === 'copied' ? 'Copied' : state === 'failed' ? 'Could not copy' : ''}
				</span>
			</div>
			<div className="rounded-lg bg-hover px-3 py-2 text-body tabular-nums">
				{months.map((month) => (
					<MonthLine key={month.key} month={month} year={year} />
				))}
			</div>
			<Button
				variant="ghost"
				size="compact"
				aria-expanded={open}
				trailingIcon={open ? ChevronUp : ChevronDown}
				className="-ml-2 self-start text-caption text-muted-foreground pointer-coarse:h-8"
				onClick={() => setOpen((value) => !value)}
			>
				{open ? 'Hide times and titles' : 'Show times and titles'}
			</Button>
			<div
				className={cn(
					'grid transition-[grid-template-rows] duration-160 ease-out motion-reduce:transition-none',
					open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
				)}
			>
				<ul className="min-h-0 overflow-hidden" inert={!open}>
					{group.events.map((event, index) => (
						<li
							key={`${event.date}-${event.time ?? ''}-${index}`}
							className="flex gap-3 py-0.5 text-caption text-muted-foreground tabular-nums"
						>
							<span className="w-28 shrink-0">{formatDate(event.date, year)}</span>
							<span className="w-11 shrink-0">{event.time ?? 'All day'}</span>
							<span className="min-w-0 flex-1 truncate text-foreground" title={event.title}>
								{event.title}
							</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

export function CalendarEvents({ block }: { block: ChatCalendarEventsBlock }) {
	const year = yearInZone(new Date(), block.defaultTimeZone)
	const period = periodText(block.from, block.to, '–')
	return (
		<Panel>
			<div
				role="group"
				aria-label={`Calendar events, ${period}`}
				data-slot="chat-calendar-events"
				className="flex flex-col gap-4 px-4 py-3"
			>
				<p className="text-caption text-muted-foreground">Google Calendar · {period}</p>
				{block.groups.map((group, index) => (
					<EventsGroup
						key={`${group.title ?? ''}-${index}`}
						group={group}
						label={group.title ?? 'All events'}
						year={year}
					/>
				))}
				{block.more > 0 ? (
					<p className="text-caption text-muted-foreground">
						{block.more} more {block.more === 1 ? 'event is' : 'events are'} not shown. Ask for a shorter period.
					</p>
				) : null}
			</div>
		</Panel>
	)
}
