'use client'

import { useRef, useState, type ReactNode } from 'react'

import { CalendarCheck2, CalendarClock, CalendarX2 } from 'lucide-react'
import Link from 'next/link'

import { Avatar } from '@/components/app/avatar'
import { TimePair } from '@/components/app/time-pair'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
	formatDate,
	formatFullDate,
	formatRange,
	secondRange,
	seriesPhrase,
	vnDayAt,
	vnDayTime,
	weekdayName,
} from '@/lib/schedule-format'

import type { ScheduleBlock, ScheduleSeries } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { LessonStatus, type BlockSlot } from './lesson-block'
import { LessonMoveForm } from './lesson-move-form'
import type { OverlapBlock } from './new-lesson-dialog'
import { STALE_LESSON, STALE_TITLE } from './schedule-mutations'

export interface PairTarget {
	key: string
	slot: BlockSlot
	at: Date
}

export type ActionOutcome = 'ok' | 'stale' | 'failed'

interface LessonDialogProps {
	block: ScheduleBlock
	series: ScheduleSeries | null
	secondZone: string | null
	currentYear: number
	onClose: () => void
	onOpenPair: (target: PairTarget) => void
	onCancel: () => Promise<ActionOutcome>
	onRestore: () => Promise<ActionOutcome>
	today: string
	blocksOn: (date: string) => Promise<OverlapBlock[]>
	onStale: () => void
	onMoved: (startsAt: Date) => void
	onSeries: (kind: 'move' | 'end') => void
}

type Notice = 'stale' | 'cancel' | 'restore' | null

const FAILURE: Record<Exclude<Notice, 'stale' | null>, string> = {
	cancel: 'Could not cancel the lesson. Try again.',
	restore: 'Could not restore the lesson. Try again.',
}

function Detail({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
	return (
		<div className={wide ? 'flex flex-col gap-1 sm:col-span-2' : 'flex flex-col gap-1'}>
			<dt className="text-caption text-muted-foreground">{label}</dt>
			<dd className="text-body text-foreground">{children}</dd>
		</div>
	)
}

function cancelQuestion(start: Date, zone: string | null): string {
	return `Cancel the lesson on ${vnDayAt(start, zone)}?`
}

const pairButtonClass =
	'cursor-pointer rounded-sm text-body text-foreground underline underline-offset-2 outline-none hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-focus-ring'

export function LessonDialog({
	block,
	series,
	secondZone,
	currentYear,
	onClose,
	onOpenPair,
	onCancel,
	onRestore,
	today,
	blocksOn,
	onStale,
	onMoved,
	onSeries,
}: LessonDialogProps) {
	const [confirming, setConfirming] = useState(false)
	const [moving, setMoving] = useState(false)
	const [pending, setPending] = useState(false)
	const moveButton = useRef<HTMLButtonElement>(null)
	const [notice, setNotice] = useState<Notice>(null)
	const start = new Date(block.startsAt)
	const range = formatRange(start, block.durationMinutes, SCHEDULE_TIME_ZONE)
	const second = secondRange(start, block.durationMinutes, secondZone)
	const movedTo = block.movedTo === null ? null : new Date(block.movedTo)
	const movedFrom = block.movedFrom === null ? null : new Date(block.movedFrom)
	const description = `${formatFullDate(start, SCHEDULE_TIME_ZONE, currentYear)} · ${range} VN`
	const plannedActions = block.changeable && block.status === 'scheduled'
	const restoreAction = block.changeable && block.status === 'cancelled'
	const seriesActions = block.changeable && block.ref.kind === 'series' && block.status !== 'moved'

	async function run(action: () => Promise<ActionOutcome>, failure: 'cancel' | 'restore') {
		if (pending) return
		setPending(true)
		setNotice(null)
		const outcome = await action()
		setPending(false)
		setConfirming(false)
		setNotice(outcome === 'ok' ? null : outcome === 'stale' ? 'stale' : failure)
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="lg" showCloseButton={!pending}>
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
					<DialogDescription className="tabular-nums">
						<TimePair as="span" main={description} second={second} />
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] px-1 -mx-1">
					<div className="flex flex-col gap-4 py-1">
						{notice === 'stale' ? (
							<Banner status="warning" data-slot="lesson-stale">
								<BannerTitle>{STALE_TITLE}</BannerTitle>
								<BannerDescription>{STALE_LESSON}</BannerDescription>
							</Banner>
						) : notice !== null ? (
							<Banner status="error" data-slot="lesson-failed">
								<BannerTitle>{FAILURE[notice]}</BannerTitle>
							</Banner>
						) : null}
						<div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body">
							<LessonStatus status={block.status} />
							{movedTo !== null ? (
								<button
									type="button"
									className={pairButtonClass}
									onClick={() => onOpenPair({ key: block.key, slot: 'to', at: movedTo })}
								>
									moved to {vnDayTime(movedTo, secondZone)}
								</button>
							) : null}
							{movedFrom !== null ? (
								<button
									type="button"
									className={pairButtonClass}
									onClick={() => onOpenPair({ key: block.key, slot: 'from', at: movedFrom })}
								>
									moved from {vnDayTime(movedFrom, secondZone)}
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
						{seriesActions && series !== null ? (
							<div
								data-slot="lesson-series"
								className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-hover p-4"
							>
								<div className="flex min-w-0 flex-col gap-1">
									<p className="text-body font-semibold text-foreground">Whole series</p>
									<p className="text-caption text-muted-foreground tabular-nums">
										{seriesPhrase(series.weekday, series.startTime)} VN · from{' '}
										{formatDate(series.startsOn, currentYear)}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
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
						{moving && plannedActions ? (
							<LessonMoveForm
								block={block}
								today={today}
								secondZone={secondZone}
								currentYear={currentYear}
								blocksOn={blocksOn}
								onPendingChange={setPending}
								onDiscard={() => {
									setMoving(false)
									setTimeout(() => moveButton.current?.focus(), 50)
								}}
								onStale={() => {
									setNotice('stale')
									onStale()
								}}
								onMoved={(startsAt) => {
									setMoving(false)
									setNotice(null)
									onMoved(startsAt)
								}}
							/>
						) : null}
					</div>
				</ScrollArea>
				{plannedActions && !moving ? (
					<DialogFooter>
						{confirming ? (
							<div
								role="alert"
								data-slot="lesson-cancel-question"
								className="flex w-full flex-wrap items-center justify-end gap-2"
							>
								<span className="mr-auto text-body text-foreground">{cancelQuestion(start, secondZone)}</span>
								<Button
									type="button"
									variant="ghost"
									size="compact"
									disabled={pending}
									onClick={() => setConfirming(false)}
								>
									Keep
								</Button>
								<Button
									type="button"
									size="compact"
									leadingIcon={CalendarX2}
									loading={pending}
									onClick={() => void run(onCancel, 'cancel')}
								>
									{pending ? 'Cancelling…' : 'Yes, cancel'}
								</Button>
							</div>
						) : (
							<div className="flex w-full flex-wrap items-center justify-end gap-2">
								<Button
									ref={moveButton}
									type="button"
									variant="secondary"
									size="compact"
									leadingIcon={CalendarClock}
									onClick={() => {
										setNotice(null)
										setMoving(true)
									}}
								>
									Move lesson
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="compact"
									leadingIcon={CalendarX2}
									onClick={() => {
										setNotice(null)
										setConfirming(true)
									}}
								>
									Cancel lesson
								</Button>
							</div>
						)}
					</DialogFooter>
				) : null}
				{restoreAction ? (
					<DialogFooter>
						<Button
							type="button"
							variant="secondary"
							size="compact"
							leadingIcon={CalendarCheck2}
							loading={pending}
							onClick={() => void run(onRestore, 'restore')}
						>
							Return to schedule
						</Button>
					</DialogFooter>
				) : null}
			</DialogContent>
		</Dialog>
	)
}
