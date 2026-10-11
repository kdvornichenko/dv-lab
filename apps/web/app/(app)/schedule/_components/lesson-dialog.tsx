'use client'

import { useRef, useState } from 'react'

import Link from 'next/link'

import { Avatar } from '@/components/app/avatar'
import { TimePair } from '@/components/app/time-pair'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { OccurrenceSlot } from '@/lib/lesson-mark-text'
import { formatFullDate, formatRange, secondRange } from '@/lib/schedule-format'

import type { LessonMarkKind, ScheduleBlock, ScheduleSeries } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { LessonDetails, LessonStatus } from './lesson-details'
import { LessonFooter } from './lesson-footer'
import { LessonMarkRow } from './lesson-mark-row'
import { LessonMoveForm } from './lesson-move-form'
import type { OverlapBlock } from './new-lesson-dialog'
import { STALE_LESSON, STALE_TITLE } from './schedule-mutations'

export interface PairTarget {
	key: string
	slot: OccurrenceSlot
	at: Date
}

export type ActionOutcome = 'ok' | 'stale' | 'failed'

interface LessonDialogProps {
	block: ScheduleBlock
	series: ScheduleSeries | null
	now: Date
	secondZone: string | null
	currentYear: number
	onClose: () => void
	onOpenPair: (target: PairTarget) => void
	onCancel: () => Promise<ActionOutcome>
	onRestore: () => Promise<ActionOutcome>
	onMark: (kind: LessonMarkKind) => Promise<ActionOutcome>
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

const MARK_FAILURE = 'Could not save the mark. Try again.'

export function LessonDialog({
	block,
	series,
	now,
	secondZone,
	currentYear,
	onClose,
	onOpenPair,
	onCancel,
	onRestore,
	onMark,
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
	const [choosing, setChoosing] = useState<LessonMarkKind | null>(null)
	const [markFailed, setMarkFailed] = useState(false)
	const start = new Date(block.startsAt)
	const range = formatRange(start, block.durationMinutes, SCHEDULE_TIME_ZONE)
	const second = secondRange(start, block.durationMinutes, secondZone)
	const description = `${formatFullDate(start, SCHEDULE_TIME_ZONE, currentYear)} · ${range} VN`
	const { actions } = block

	async function run(action: () => Promise<ActionOutcome>, failure: 'cancel' | 'restore') {
		if (pending) return
		setPending(true)
		setNotice(null)
		const outcome = await action()
		setPending(false)
		setConfirming(false)
		setNotice(outcome === 'ok' ? null : outcome === 'stale' ? outcome : failure)
	}

	async function choose(kind: LessonMarkKind) {
		if (choosing !== null || pending) return
		setChoosing(kind)
		setNotice(null)
		setMarkFailed(false)
		const outcome = await onMark(kind)
		setChoosing(null)
		if (outcome === 'stale') setNotice('stale')
		if (outcome === 'failed') setMarkFailed(true)
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
						<LessonStatus block={block} now={now} secondZone={secondZone} onOpenPair={onOpenPair} />
						{markFailed ? (
							<Banner status="error" data-slot="lesson-mark-failed">
								<BannerTitle>{MARK_FAILURE}</BannerTitle>
							</Banner>
						) : null}
						<LessonMarkRow
							block={block}
							now={now}
							saving={choosing}
							locked={pending}
							onChoose={(kind) => void choose(kind)}
						/>
						<LessonDetails
							block={block}
							series={series}
							now={now}
							secondZone={secondZone}
							currentYear={currentYear}
							pending={pending}
							onSeries={onSeries}
						/>
						{moving && actions.move ? (
							<LessonMoveForm
								block={block}
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
				<LessonFooter
					block={block}
					confirming={confirming}
					moving={moving}
					pending={pending}
					moveButton={moveButton}
					onKeep={() => setConfirming(false)}
					onCancel={() => void run(onCancel, 'cancel')}
					onRestore={() => void run(onRestore, 'restore')}
					onMove={() => {
						setNotice(null)
						setMoving(true)
					}}
					onConfirm={() => {
						setNotice(null)
						setConfirming(true)
					}}
				/>
			</DialogContent>
		</Dialog>
	)
}
