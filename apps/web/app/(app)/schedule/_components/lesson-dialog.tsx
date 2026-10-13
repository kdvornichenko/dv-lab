'use client'

import { useRef, useState } from 'react'

import Link from 'next/link'

import { Avatar } from '@/components/app/avatar'
import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { READ_ISSUES } from '@/components/app/google-calendar-state'
import { TimePair } from '@/components/app/time-pair'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
	calendarSeriesFor,
	canEditCalendarEvent,
	changeableLesson,
	writeIssueFor,
	type CalendarLesson,
} from '@/lib/lesson-actions'
import type { OccurrenceSlot } from '@/lib/lesson-mark-text'
import { formatFullDate, mainRange, secondRange } from '@/lib/schedule-format'
import { sameTimeZone } from '@/lib/time-zones'

import type {
	CalendarEditScope,
	GoogleScheduleWindow,
	LessonMarkKind,
	ScheduleBlock,
	ScheduleSeries,
} from '@dv-lab/contracts'
import { countsAsLesson, scheduleDate } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { lessonMoveBody, movedBlocks } from './calendar-lesson-dialog'
import { LessonDetails, LessonStatus } from './lesson-details'
import { LessonFooter } from './lesson-footer'
import { LessonMarkRow } from './lesson-mark-row'
import { LessonMoveForm, type MoveDraft } from './lesson-move-form'
import { backAt, codeRefusal, type WriteRunner } from './optimistic-writes'
import { TimeZoneStaleNotice, useScheduleFormContext } from './schedule-form-context'
import { STALE_LESSON, STALE_TITLE, useScheduleMutation } from './schedule-mutations'

export interface PairTarget {
	key: string
	slot: OccurrenceSlot
	at: Date
}

export type ActionOutcome = 'ok' | 'stale' | 'failed'

export interface LessonCalendar {
	event: CalendarLesson | null
	window: GoogleScheduleWindow | null
	loading: boolean
	onWrite: WriteRunner
}

interface LessonDialogProps {
	block: ScheduleBlock
	series: ScheduleSeries | null
	calendar?: LessonCalendar
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
const CHANGE_FAILURE = 'Could not apply this change. Refresh the calendar before trying again.'

export function LessonDialog({
	block,
	series,
	calendar,
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
	const toast = useToast()
	const event = calendar?.event ?? null
	const window = calendar?.window ?? null
	const seriesContext = event !== null && window !== null ? calendarSeriesFor(window, event) : null
	const command = useScheduleMutation(
		event === null
			? null
			: {
					mainTimeZone: context.mainTimeZone,
					date: scheduleDate(new Date(event.when.startsAt), context.mainTimeZone),
					event,
					series: seriesContext ?? undefined,
				}
	)
	const { blocked } = useCalendarCommands()
	const [moving, setMoving] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const [failure, setFailure] = useState<string | null>(null)
	const moveButton = useRef<HTMLButtonElement>(null)
	const editable = event !== null && window !== null && canEditCalendarEvent(event, window) && !blocked
	const busy = choosing !== null || command.pending
	const start = new Date(block.startsAt)
	const range = mainRange(start, block.durationMinutes, context.mainTimeZone, null)
	const second = secondRange(start, block.durationMinutes, context.mainTimeZone, shownSecondZone)
	const description = `${formatFullDate(start, context.mainTimeZone, currentYear)} · ${range}`

	const mark = block.mark
	const changeable = event === null ? countsAsLesson(block.outcome) && mark !== 'done' : changeableLesson(event)
	const actions = {
		move: changeable,
		cancel: changeable,
		restore: event !== null && event.status === 'cancelled' && mark !== 'done',
	}
	const issue =
		calendar === undefined || editable || busy || calendar.loading ? null : writeIssueFor(event, window, blocked)
	const unavailable = issue === null ? null : READ_ISSUES[issue]

	async function change(action: 'cancel' | 'restore') {
		if (event === null || busy || !editable) return
		setFailure(null)
		const result = await command.mutate(event.binding.ref, action, { expectedStartsAt: event.when.startsAt })
		if (result.kind === 'detached') return
		if (result.kind !== 'ok') {
			setFailure((result.kind === 'failed' ? codeRefusal(result.code) : null) ?? CHANGE_FAILURE)
			return
		}
		toast.show({
			title: action === 'cancel' ? 'Lesson cancelled' : 'Lesson restored',
			description: `${block.studentName}. Google Calendar confirmed the change.`,
		})
		onClose()
	}

	function save(_scope: CalendarEditScope, draft: MoveDraft): Promise<boolean> {
		if (event === null || calendar === undefined || busy || !editable) return Promise.resolve(false)
		const send = command.prepare(
			event.binding.ref,
			'move',
			lessonMoveBody(event, draft, context.mainTimeZone),
			draft.checked
		)
		calendar.onWrite(
			{
				title: 'Could not change the lesson',
				back: backAt(event, context.mainTimeZone),
				hidden: [],
				shown: movedBlocks('one', draft, event, [], null, context.mainTimeZone),
			},
			send
		)
		onClose()
		return Promise.resolve(true)
	}

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
						{calendar === undefined ? null : (
							<CalendarFormStatus
								entry={command.entry}
								blocked={command.blocked}
								connectionShown={moving}
								onViewSchedule={() => {
									command.detach()
									onClose()
								}}
							/>
						)}
						{failure !== null ? (
							<p role="alert" className="text-body text-destructive">
								{failure}
							</p>
						) : null}
						{moving && event !== null && window !== null ? (
							<LessonMoveForm
								available={editable}
								scopes={['one']}
								openingOn={block.ledger.openingOn}
								event={event}
								weekEvents={window.events}
								mainTimeZone={context.mainTimeZone}
								currentMainTimeZone={currentMainTimeZone}
								asOf={asOf}
								secondZone={shownSecondZone}
								locked={busy}
								onClose={onClose}
								onDiscard={() => setMoving(false)}
								onRefresh={onRefresh}
								onSave={save}
							/>
						) : null}
					</div>
				</ScrollArea>
				{calendar === undefined ? null : (
					<LessonFooter
						block={{ startsAt: block.startsAt, actions }}
						mainTimeZone={context.mainTimeZone}
						confirming={confirming}
						moving={moving}
						pending={command.pending}
						locked={busy || !editable}
						mark={mark}
						unavailable={unavailable}
						moveButton={moveButton}
						onKeep={() => setConfirming(false)}
						onCancel={() => void change('cancel')}
						onRestore={() => void change('restore')}
						onMove={() => setMoving(true)}
						onConfirm={() => setConfirming(true)}
					/>
				)}
			</DialogContent>
		</Dialog>
	)
}
