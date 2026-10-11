import type { ReactNode } from 'react'

import { CalendarClock, CalendarX2 } from 'lucide-react'

import { StatusDot } from '@/components/app/status-dot'
import { Button } from '@/components/ui/button'
import { statusTone, statusWord } from '@/lib/lesson-mark-text'
import { formatDate, seriesWhen, seriesSecondLine, mainDayTime, weekdayName } from '@/lib/schedule-format'
import { sameTimeZone, zoneLabel, zoneName } from '@/lib/time-zones'

import type { ScheduleBlock, ScheduleSeries } from '@dv-lab/contracts'
import { zonedParts } from '@dv-lab/core'

import type { PairTarget } from './lesson-dialog'

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

export function LessonDetails({
	block,
	series,
	mainTimeZone,
	secondZone,
	currentYear,
	pending,
	onSeries,
}: {
	block: ScheduleBlock
	series: ScheduleSeries | null
	mainTimeZone: string
	secondZone: string | null
	currentYear: number
	pending: boolean
	onSeries: (kind: 'move' | 'end') => void
}) {
	const { actions } = block
	const reference = series?.referenceOccurrence ?? null
	const seriesMain = seriesWhen(reference, mainTimeZone, null)
	const seriesSecond = seriesSecondLine(reference, mainTimeZone, secondZone)
	const repeats =
		reference?.ruleStartsAt == null
			? 'Weekly'
			: `Every ${weekdayName(zonedParts(new Date(reference.ruleStartsAt), mainTimeZone).weekday)}`
	return (
		<>
			<dl className="grid gap-4 rounded-xl bg-hover p-4 sm:grid-cols-2">
				<Detail label="Length">{block.durationMinutes} min</Detail>
				<Detail label="Repeats">{series === null ? 'Once' : repeats}</Detail>
				{sameTimeZone(block.timeZone, mainTimeZone) ? null : (
					<Detail label="Created in">
						{zoneName(block.timeZone)} time ({zoneLabel(block.timeZone, new Date(block.startsAt))})
					</Detail>
				)}
				{series === null ? null : (
					<Detail label="Series" wide>
						{series.endsOn === null
							? `From ${formatDate(series.startsOn, currentYear)}`
							: `From ${formatDate(series.startsOn, currentYear)} until ${formatDate(series.endsOn, currentYear)}`}
					</Detail>
				)}
			</dl>
			{actions.series && series !== null ? (
				<div data-slot="lesson-series" className="flex flex-col gap-4 rounded-xl bg-hover p-4">
					<div className="flex min-w-0 flex-col gap-1">
						<p className="text-body font-semibold text-foreground">Whole series</p>
						<p data-slot="lesson-series-main" className="text-caption text-muted-foreground tabular-nums">
							{seriesMain === null ? 'From ' : `Every ${seriesMain} · from `}
							{formatDate(series.startsOn, currentYear)}
						</p>
						{seriesSecond === null ? null : (
							<p data-slot="lesson-series-second" className="text-micro text-muted-foreground tabular-nums">
								{seriesSecond}
							</p>
						)}
						{reference?.ruleStartsAt == null || sameTimeZone(series.timeZone, mainTimeZone) ? null : (
							<p className="text-caption text-muted-foreground">
								Created in {zoneName(series.timeZone)} time (
								{zoneLabel(series.timeZone, new Date(reference.ruleStartsAt))})
							</p>
						)}
					</div>
					<div data-slot="lesson-series-actions" className="flex flex-wrap gap-2">
						<Button
							type="button"
							variant="secondary"
							size="compact"
							leadingIcon={CalendarClock}
							disabled={pending}
							onClick={() => onSeries('move')}
						>
							Move series
						</Button>
						<Button
							type="button"
							variant="secondary"
							size="compact"
							leadingIcon={CalendarX2}
							disabled={pending}
							onClick={() => onSeries('end')}
						>
							End series
						</Button>
					</div>
				</div>
			) : null}
		</>
	)
}
