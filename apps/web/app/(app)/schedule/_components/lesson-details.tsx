import type { ReactNode } from 'react'

import { StatusDot } from '@/components/app/status-dot'
import { statusTone, statusWord } from '@/lib/lesson-mark-text'
import { formatTime, mainDayTime, weekdayName } from '@/lib/schedule-format'
import { sameTimeZone, zoneLabel, zoneName } from '@/lib/time-zones'

import type { ScheduleBlock, ScheduleOccurrenceRef, ScheduleSeries } from '@dv-lab/contracts'
import { zonedParts } from '@dv-lab/core'

import { LessonComments } from './lesson-comments'
import type { PairTarget } from './lesson-dialog'
import { commentsPath } from './schedule-prefetch'

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

export function LessonStatus({
	block,
	now,
	mainTimeZone,
	secondZone,
	pending,
	onOpenPair,
}: {
	block: ScheduleBlock
	now: Date
	mainTimeZone: string
	secondZone: string | null
	pending: boolean
	onOpenPair: (target: PairTarget) => void
}) {
	const movedTo = block.movedTo === null ? null : new Date(block.movedTo)
	const movedFrom = block.movedFrom === null ? null : new Date(block.movedFrom)
	const word = statusWord(block, now, mainTimeZone, false)
	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
			<span className="inline-flex items-center gap-2">
				<StatusDot tone={statusTone(block, now)} label={word} />
				<span>{word}</span>
			</span>
			{movedTo !== null ? (
				<button
					type="button"
					className={pairButtonClass}
					disabled={pending}
					onClick={() => onOpenPair({ key: block.key, slot: 'to', at: movedTo })}
				>
					moved to {mainDayTime(movedTo, mainTimeZone, secondZone)}
				</button>
			) : null}
			{movedFrom !== null ? (
				<button
					type="button"
					className={pairButtonClass}
					disabled={pending}
					onClick={() => onOpenPair({ key: block.key, slot: 'from', at: movedFrom })}
				>
					moved from {mainDayTime(movedFrom, mainTimeZone, secondZone)}
				</button>
			) : null}
			{block.studentGoal ? <span className="text-muted-foreground">· {block.studentGoal}</span> : null}
		</div>
	)
}

function everyAt(instant: Date, zone: string): string {
	return `Every ${weekdayName(zonedParts(instant, zone).weekday)} at ${formatTime(instant, zone)} ${zoneLabel(zone, instant)}`
}

export function LessonDetails({
	block,
	series,
	mainTimeZone,
	secondZone,
	commentRef,
	started = false,
	now,
}: {
	block: Pick<ScheduleBlock, 'durationMinutes' | 'startsAt'> & { timeZone: string | null }
	series: ScheduleSeries | null
	mainTimeZone: string
	secondZone: string | null
	commentRef?: ScheduleOccurrenceRef
	started?: boolean
	now?: Date
}) {
	const reference = series?.referenceOccurrence?.ruleStartsAt
	const ruleStart = reference == null ? null : new Date(reference)
	const second = secondZone !== null && !sameTimeZone(secondZone, mainTimeZone) ? secondZone : null
	return (
		<>
			<dl className="grid gap-4 rounded-xl bg-hover p-4 sm:grid-cols-2">
				<Detail label="Length">{block.durationMinutes} min</Detail>
				<Detail label="Repeats">
					{series === null ? (
						'Once'
					) : ruleStart === null ? (
						'Weekly'
					) : (
						<span data-slot="lesson-repeats" className="flex flex-col gap-1 tabular-nums">
							<span>{everyAt(ruleStart, mainTimeZone)}</span>
							{second === null ? null : (
								<span className="text-micro text-muted-foreground">{everyAt(ruleStart, second)}</span>
							)}
						</span>
					)}
				</Detail>
				{block.timeZone === null || sameTimeZone(block.timeZone, mainTimeZone) ? null : (
					<Detail label="Created in">
						{zoneName(block.timeZone)} time ({zoneLabel(block.timeZone, new Date(block.startsAt))})
					</Detail>
				)}
			</dl>
			{commentRef !== undefined && started && now !== undefined ? (
				<LessonComments key={commentsPath(commentRef)} lessonRef={commentRef} mainTimeZone={mainTimeZone} now={now} />
			) : null}
		</>
	)
}
