import { useState, type MouseEvent } from 'react'

import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion'
import Link from 'next/link'

import { TimePair } from '@/components/app/time-pair'
import { occurrenceSlot, statusKey, statusLabel, statusWord, type StatusKey } from '@/lib/lesson-mark-text'
import { formatDay, formatTime, secondWhen } from '@/lib/schedule-format'
import { spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

import type { LessonMarkKind, ScheduleBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, scheduleToday } from '@dv-lab/core'

import { TodayMarkControls } from './today-mark-controls'

export const ROW_LIMIT = 8

type RowStyle = { muted: boolean; struck: boolean; note: boolean }

const ROW_STYLE: Record<StatusKey, RowStyle> = {
	planned: { muted: false, struck: false, note: false },
	needs_mark: { muted: false, struck: false, note: true },
	done: { muted: true, struck: false, note: true },
	no_show: { muted: true, struck: false, note: true },
	cancelled: { muted: true, struck: true, note: true },
	moved: { muted: true, struck: false, note: true },
}

export function MoreRow({ count, href }: { count: number; href: string }) {
	return (
		<li>
			<Link
				href={href}
				data-slot="more-row"
				className="flex h-8 items-center rounded-lg px-3 text-caption text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus-ring"
			>
				+{count} more
			</Link>
		</li>
	)
}

interface LessonRowsProps {
	blocks: readonly ScheduleBlock[]
	now: Date
	showDate: boolean
	nextKey: string | null
	secondZone: string | null
	moreHref?: string
	onSaved: () => Promise<void>
	onStale: () => Promise<void>
	onOpen: (block: ScheduleBlock, trigger: HTMLButtonElement) => void
}

export function LessonRows({ blocks, moreHref, ...rowProps }: LessonRowsProps) {
	const shown = moreHref === undefined ? blocks : blocks.slice(0, ROW_LIMIT)
	return (
		<ul data-slot="today-rows" className="flex flex-col px-1 pb-2 text-body">
			<AnimatePresence initial={false} propagate>
				{shown.map((block) => (
					<LessonRow key={`${block.key}:${occurrenceSlot(block.outcome)}`} block={block} {...rowProps} />
				))}
			</AnimatePresence>
			{moreHref !== undefined && blocks.length > ROW_LIMIT ? (
				<MoreRow count={blocks.length - ROW_LIMIT} href={moreHref} />
			) : null}
		</ul>
	)
}

function LessonRow({
	block,
	now,
	showDate,
	nextKey,
	secondZone,
	onSaved,
	onStale,
	onOpen,
}: Omit<LessonRowsProps, 'blocks' | 'moreHref'> & { block: ScheduleBlock }) {
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState<LessonMarkKind | null>(null)
	const busy = pending !== null
	const present = useIsPresent()
	const reduced = useReducedMotion()
	const year = Number(scheduleToday(now).slice(0, 4))
	const start = new Date(block.startsAt)
	const key = statusKey(block, now)
	const style = ROW_STYLE[key]
	const next = block.key === nextKey && occurrenceSlot(block.outcome) === 'to'
	return (
		<motion.li
			initial={false}
			animate={{ opacity: 1 }}
			exit={showDate ? { opacity: 0 } : undefined}
			transition={reduced ? { duration: spring.fast.duration, ease: 'easeOut' } : spring.fast}
			inert={!present}
			data-slot="today-row"
			data-key={block.key}
			data-student-id={block.studentId}
			data-status={key}
			data-next={next ? 'true' : 'false'}
			className={cn(
				'relative flex h-10 items-center gap-3 rounded-lg px-3 tabular-nums hover:bg-hover',
				style.muted && 'text-muted-foreground',
				next && 'bg-active font-semibold'
			)}
		>
			{showDate ? (
				<span data-slot="today-row-date" className="min-w-0 truncate text-muted-foreground sm:min-w-18 sm:shrink-0">
					{formatDay(start, SCHEDULE_TIME_ZONE, year)}
				</span>
			) : null}
			<TimePair
				className="min-w-0 overflow-hidden whitespace-nowrap sm:min-w-22 sm:shrink-0"
				main={formatTime(start, SCHEDULE_TIME_ZONE)}
				second={secondWhen(start, secondZone)}
			/>
			<span data-slot="today-row-name" className={cn('flex min-w-0 flex-1 flex-col', style.struck && 'line-through')}>
				<button
					type="button"
					disabled={busy}
					data-slot="today-row-open"
					className="min-w-0 cursor-pointer truncate text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-focus-ring"
					aria-label={`${block.studentName}, ${formatDay(start, SCHEDULE_TIME_ZONE, year)}, ${formatTime(start, SCHEDULE_TIME_ZONE)}: ${statusLabel(block, now)}`}
					onClick={(event: MouseEvent<HTMLButtonElement>) => {
						if (!busy) onOpen(block, event.currentTarget)
					}}
				>
					{block.studentName}
				</button>
				{failed ? (
					<span className="truncate text-caption font-normal text-destructive">
						Could not save the mark. Try again.
					</span>
				) : null}
			</span>
			{block.actions.mark ? (
				<span data-slot="today-row-note" className="relative z-10 shrink-0 font-normal">
					<TodayMarkControls
						block={block}
						pending={pending}
						onPendingChange={setPending}
						onSaved={onSaved}
						onStale={onStale}
						onError={setFailed}
					/>
				</span>
			) : style.note ? (
				<span data-slot="today-row-note" className="shrink-0 text-caption font-normal text-muted-foreground">
					{statusWord(block, now)}
				</span>
			) : null}
		</motion.li>
	)
}
