'use client'

import type { ReactNode } from 'react'

import Link from 'next/link'

import { Avatar } from '@/components/app/avatar'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
	formatDate,
	formatDayMonth,
	formatFullDate,
	formatRange,
	formatTime,
	secondRange,
	weekdayName,
} from '@/lib/schedule-format'

import type { ScheduleBlock, ScheduleSeries } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { LessonStatus, type BlockSlot } from './lesson-block'

export interface PairTarget {
	key: string
	slot: BlockSlot
	at: Date
}

interface LessonDialogProps {
	block: ScheduleBlock
	series: ScheduleSeries | null
	secondZone: string | null
	currentYear: number
	onClose: () => void
	onOpenPair: (target: PairTarget) => void
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
	return (
		<div className={wide ? 'flex flex-col gap-1 sm:col-span-2' : 'flex flex-col gap-1'}>
			<dt className="text-caption text-muted-foreground">{label}</dt>
			<dd className="text-body text-foreground">{children}</dd>
		</div>
	)
}

const pairButtonClass =
	'cursor-pointer rounded-sm text-body text-foreground underline underline-offset-2 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-focus-ring'

export function LessonDialog({ block, series, secondZone, currentYear, onClose, onOpenPair }: LessonDialogProps) {
	const start = new Date(block.startsAt)
	const range = formatRange(start, block.durationMinutes, SCHEDULE_TIME_ZONE)
	const second = secondRange(start, block.durationMinutes, secondZone)
	const movedTo = block.movedTo === null ? null : new Date(block.movedTo)
	const movedFrom = block.movedFrom === null ? null : new Date(block.movedFrom)
	const description = [
		formatFullDate(start, SCHEDULE_TIME_ZONE, currentYear),
		`${range} VN`,
		...(second === null ? [] : [second]),
	].join(' · ')

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose()
			}}
		>
			<DialogContent size="lg">
				<DialogHeader>
					<div className="flex min-w-0 items-center gap-2 pr-8">
						<Avatar name={block.studentName} />
						<DialogTitle className="min-w-0">
							<Link
								href={`/students/${block.studentId}`}
								className="block truncate rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
							>
								{block.studentName}
							</Link>
						</DialogTitle>
					</div>
					<DialogDescription className="tabular-nums">{description}</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] px-1 -mx-1">
					<div className="flex flex-col gap-4 py-1">
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
							<LessonStatus status={block.status} />
							{movedTo !== null ? (
								<button
									type="button"
									className={pairButtonClass}
									onClick={() => onOpenPair({ key: block.key, slot: 'to', at: movedTo })}
								>
									moved to {formatDayMonth(movedTo, SCHEDULE_TIME_ZONE)}, {formatTime(movedTo, SCHEDULE_TIME_ZONE)} VN
								</button>
							) : null}
							{movedFrom !== null ? (
								<button
									type="button"
									className={pairButtonClass}
									onClick={() => onOpenPair({ key: block.key, slot: 'from', at: movedFrom })}
								>
									moved from {formatDayMonth(movedFrom, SCHEDULE_TIME_ZONE)},{' '}
									{formatTime(movedFrom, SCHEDULE_TIME_ZONE)}
								</button>
							) : null}
							{block.studentGoal ? <span className="text-muted-foreground">· {block.studentGoal}</span> : null}
						</div>
						{block.changeable ? null : (
							<p className="text-caption text-muted-foreground">
								This lesson has already taken place and cannot be changed.
							</p>
						)}
						<dl className="grid gap-4 rounded-xl bg-hover p-4 sm:grid-cols-2">
							<Detail label="Length">{block.durationMinutes} min</Detail>
							<Detail label="Repeats">{series === null ? 'Once' : `Every ${weekdayName(series.weekday)}`}</Detail>
							{series === null ? null : (
								<Detail label="Series" wide>
									{series.endsOn === null
										? `From ${formatDate(series.startsOn, currentYear)}`
										: `From ${formatDate(series.startsOn, currentYear)} until ${formatDate(series.endsOn, currentYear)}`}
								</Detail>
							)}
						</dl>
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	)
}
