'use client'

import { useState } from 'react'

import Link from 'next/link'

import { Avatar } from '@/components/app/avatar'
import { TimePair } from '@/components/app/time-pair'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { OccurrenceSlot } from '@/lib/lesson-mark-text'
import { formatFullDate, mainRange, secondRange } from '@/lib/schedule-format'
import { sameTimeZone } from '@/lib/time-zones'

import type { LessonMarkKind, ScheduleBlock, ScheduleSeries } from '@dv-lab/contracts'

import { LessonDetails, LessonStatus } from './lesson-details'
import { LessonMarkRow } from './lesson-mark-row'
import { TimeZoneStaleNotice, useScheduleFormContext } from './schedule-form-context'
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
	mainTimeZone: string
	currentMainTimeZone: string
	asOf: string
	secondZone: string | null
	onClose: () => void
	onOpenPair: (target: PairTarget) => void
	onMark: (kind: LessonMarkKind) => Promise<ActionOutcome>
	onRefresh: () => void
}

const MARK_FAILURE = 'Could not save the mark. Try again.'

export function LessonDialog({
	block,
	series,
	now,
	mainTimeZone,
	currentMainTimeZone,
	asOf,
	secondZone,
	onClose,
	onOpenPair,
	onMark,
	onRefresh,
}: LessonDialogProps) {
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const { currentYear } = context
	const shownSecondZone = secondZone !== null && !sameTimeZone(secondZone, context.mainTimeZone) ? secondZone : null
	const [notice, setNotice] = useState<'stale' | null>(null)
	const [choosing, setChoosing] = useState<LessonMarkKind | null>(null)
	const [markFailed, setMarkFailed] = useState(false)
	const busy = choosing !== null
	const start = new Date(block.startsAt)
	const range = mainRange(start, block.durationMinutes, context.mainTimeZone, null)
	const second = secondRange(start, block.durationMinutes, context.mainTimeZone, shownSecondZone)
	const description = `${formatFullDate(start, context.mainTimeZone, currentYear)} · ${range}`

	async function choose(kind: LessonMarkKind) {
		if (busy) return
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
				if (!open && !busy) onClose()
			}}
		>
			<DialogContent size="lg" showCloseButton={!busy}>
				<DialogHeader>
					<div className="flex min-w-0 items-center gap-2 pr-8">
						<Avatar name={block.studentName} />
						<DialogTitle className="min-w-0">
							<Link
								href={`/students/${block.studentId}`}
								aria-disabled={busy}
								tabIndex={busy ? -1 : undefined}
								onClick={(event) => {
									if (busy) event.preventDefault()
								}}
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
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] -m-1 p-1">
					<div className="flex flex-col gap-4 py-1">
						<TimeZoneStaleNotice stale={context.stale} pending={busy} onRefresh={onRefresh} />
						{notice === 'stale' ? (
							<Banner status="warning" data-slot="lesson-stale">
								<BannerTitle>{STALE_TITLE}</BannerTitle>
								<BannerDescription>{STALE_LESSON}</BannerDescription>
								<Button type="button" variant="ghost" size="compact" disabled={busy} onClick={onRefresh}>
									Refresh
								</Button>
							</Banner>
						) : null}
						<LessonStatus
							block={block}
							now={now}
							mainTimeZone={context.mainTimeZone}
							secondZone={shownSecondZone}
							pending={busy}
							onOpenPair={onOpenPair}
						/>
						{markFailed ? (
							<Banner status="error" data-slot="lesson-mark-failed">
								<BannerTitle>{MARK_FAILURE}</BannerTitle>
							</Banner>
						) : null}
						<LessonMarkRow
							block={block}
							mainTimeZone={context.mainTimeZone}
							now={now}
							saving={choosing}
							locked={busy}
							onChoose={(kind) => void choose(kind)}
						/>
						<LessonDetails
							block={block}
							series={series}
							mainTimeZone={context.mainTimeZone}
							secondZone={shownSecondZone}
						/>
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	)
}
