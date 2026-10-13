'use client'

import { useRef, useState } from 'react'

import Link from 'next/link'

import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { calendarSeriesFor, canEditCalendarEvent, seriesDateInZone, type CalendarLesson } from '@/lib/lesson-actions'
import { cn } from '@/lib/utils'

import type {
	CalendarEditScope,
	CalendarEventView,
	CalendarSeriesContext,
	GoogleScheduleWindow,
} from '@dv-lab/contracts'
import { addDays, canChange, nextSeriesDate, scheduleDate, weekdayOf, zonedInstant } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { EventTime, eventTitle } from './calendar-event-details'
import { EndSeriesDialog } from './end-series-dialog'
import type { DirectState } from './event-form'
import { LessonDetails } from './lesson-details'
import { LessonFooter } from './lesson-footer'
import { LessonMoveForm, type MoveDraft } from './lesson-move-form'
import { backAt, placedEvent, type WriteRunner } from './optimistic-writes'
import { useScheduleMutation, type MoveLessonBody, type MoveSeriesBody } from './schedule-mutations'
import { ScopeDialog } from './scope-dialog'
import type { MoveSeed } from './use-lesson-drag'

type Props = {
	moveSeed?: MoveSeed
	event: CalendarLesson
	window: GoogleScheduleWindow
	now: Date
	mainTimeZone: string
	secondZone: string | null
	student?: { id: string; name: string }
	onClose: () => void
	onMoveDiscard?: () => void
	onRefresh: () => void
	onWrite: WriteRunner
}

export function CalendarLessonDialog(props: Props) {
	const [ending, setEnding] = useState(false)
	const mainTimeZone = props.mainTimeZone
	const asOf = props.window.read.state === 'unavailable' ? props.now.toISOString() : props.window.read.fetchedAt
	const currentSeries = calendarSeriesFor(props.window, props.event)
	const usableSeries = currentSeries !== null && canEditCalendarEvent(props.event, props.window)
	if (ending && currentSeries !== null)
		return (
			<EndSeriesDialog
				mainTimeZone={mainTimeZone}
				currentMainTimeZone={props.window.requestedRange.timeZone}
				asOf={asOf}
				studentName={props.student?.name ?? eventTitle(props.event)}
				now={props.now}
				onClose={props.onClose}
				onStale={props.onRefresh}
				onRefresh={props.onRefresh}
				series={currentSeries}
				available={usableSeries}
				onEnded={props.onClose}
			/>
		)
	return <LessonContent {...props} asOf={asOf} series={currentSeries} onEndSeries={() => setEnding(true)} />
}

function dayGap(later: string, earlier: string): number {
	return Math.round((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000)
}

function lessonMoveBody(event: CalendarLesson, draft: MoveDraft, mainTimeZone: string): MoveLessonBody {
	const length = (Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000
	return {
		date: draft.date,
		startTime: draft.time,
		...(draft.durationMinutes !== length ? { durationMinutes: draft.durationMinutes } : {}),
		expectedStartsAt: event.when.startsAt,
		expectedDefaultTimeZone: mainTimeZone,
	}
}

function seriesMoveBody(
	scope: 'following' | 'all',
	draft: MoveDraft,
	event: CalendarLesson,
	context: CalendarSeriesContext,
	now: Date,
	mainTimeZone: string
): MoveSeriesBody {
	const rule = context.series
	const ref = event.binding.ref
	const today = scheduleDate(now, mainTimeZone)
	const inZone = (date: string) => seriesDateInZone(rule, date, mainTimeZone) ?? date
	const opened =
		ref.kind === 'series' ? inZone(ref.originalOn) : scheduleDate(new Date(event.when.startsAt), mainTimeZone)
	const natural = scope === 'following' ? opened : nextSeriesDate(rule, now)
	const cut = natural === null ? today : scope === 'following' ? natural : inZone(natural)
	const first = addDays(cut, dayGap(draft.date, opened))
	const earlier = first < cut ? first : cut
	const from = earlier < today ? today : earlier
	return {
		from,
		weekday: weekdayOf(first),
		startTime: draft.time,
		...(draft.durationMinutes !== rule.durationMinutes ? { durationMinutes: draft.durationMinutes } : {}),
		...(first > from ? { newStartsOn: first } : {}),
		expectedDefaultTimeZone: mainTimeZone,
	}
}

function movedBlocks(
	scope: CalendarEditScope,
	draft: MoveDraft,
	event: CalendarLesson,
	events: readonly CalendarEventView[],
	now: Date,
	mainTimeZone: string
): CalendarEventView[] {
	const ref = event.binding.ref
	const shift = dayGap(draft.date, scheduleDate(new Date(event.when.startsAt), mainTimeZone))
	const place = (block: CalendarEventView) => {
		if (block.when.kind !== 'timed') return block
		const date = addDays(scheduleDate(new Date(block.when.startsAt), mainTimeZone), shift)
		return placedEvent(block, zonedInstant(date, draft.time, mainTimeZone), draft.durationMinutes)
	}
	if (scope === 'one' || ref.kind !== 'series') return [place(event)]
	const members = events.filter((block) => {
		if (block.eventKey === event.eventKey) return true
		if (block.binding.kind !== 'lesson' || block.binding.ref.kind !== 'series') return false
		if (block.binding.ref.seriesId !== ref.seriesId || block.status === 'cancelled' || block.when.kind !== 'timed')
			return false
		return scope === 'following'
			? block.binding.ref.originalOn >= ref.originalOn
			: canChange(new Date(block.when.startsAt), now)
	})
	return members.map(place)
}

function LessonContent({
	moveSeed,
	event,
	window,
	now,
	mainTimeZone,
	secondZone,
	student,
	onClose,
	onMoveDiscard,
	onRefresh,
	onWrite,
	asOf,
	series,
	onEndSeries,
}: Props & {
	asOf: string
	series: CalendarSeriesContext | null
	onEndSeries: () => void
}) {
	const toast = useToast()
	const [initial] = useState(event)
	const command = useScheduleMutation({
		mainTimeZone,
		date: scheduleDate(new Date(initial.when.startsAt), mainTimeZone),
		event: initial,
		series: series ?? undefined,
	})
	const { blocked } = useCalendarCommands()
	const [moving, setMoving] = useState(moveSeed !== undefined)
	const [direct, setDirect] = useState<DirectState>(moveSeed !== undefined ? 'sending' : 'shown')
	const [confirming, setConfirming] = useState(false)
	const [scoping, setScoping] = useState(false)
	const [failure, setFailure] = useState(false)
	const moveButton = useRef<HTMLButtonElement>(null)
	const editable = canEditCalendarEvent(event, window) && !blocked
	const pending = command.pending
	const details = {
		startsAt: event.when.startsAt,
		durationMinutes: (Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000,
		timeZone: event.when.timeZone,
	}
	const endable =
		editable && series !== null && event.status !== 'cancelled' && canChange(new Date(event.when.startsAt), now)
	const actions = {
		move: editable && event.status !== 'cancelled',
		cancel: editable && event.status !== 'cancelled',
		restore: editable && event.status === 'cancelled',
	}
	const title = student?.name ?? eventTitle(event)
	async function apply(action: 'cancel' | 'restore'): Promise<'ok' | 'failed' | 'detached'> {
		const result = await command.mutate(initial.binding.ref, action, { expectedStartsAt: initial.when.startsAt })
		if (result.kind === 'detached') return 'detached'
		if (result.kind !== 'ok') return 'failed'
		toast.show({
			title: action === 'cancel' ? 'Lesson cancelled' : 'Lesson restored',
			description: `${title}. Google Calendar confirmed the change.`,
		})
		onClose()
		return 'ok'
	}
	async function change(action: 'cancel' | 'restore') {
		if (pending || !editable) return
		setFailure(false)
		if ((await apply(action)) === 'failed') setFailure(true)
	}
	async function cancelScope(scope: CalendarEditScope): Promise<boolean> {
		if (pending || !editable) return false
		if (scope === 'one') return (await apply('cancel')) === 'ok'
		const ref = initial.binding.ref
		if (series === null || ref.kind !== 'series') return false
		const result = await command.mutate({ kind: 'rule', seriesId: series.series.id }, 'end', {
			lastOn: addDays(ref.originalOn, -1),
			expectedDefaultTimeZone: mainTimeZone,
		})
		if (result.kind !== 'ok') return false
		toast.show({ title: 'Series ended', description: `${title}'s series was ended.` })
		onClose()
		return true
	}
	function save(scope: CalendarEditScope, draft: MoveDraft): Promise<boolean> {
		if (pending || !editable) return Promise.resolve(false)
		const send =
			scope === 'one' || series === null
				? command.prepare(initial.binding.ref, 'move', lessonMoveBody(initial, draft, mainTimeZone), draft.checked)
				: command.prepare(
						{ kind: 'rule', seriesId: series.series.id },
						'move',
						seriesMoveBody(scope, draft, initial, series, now, mainTimeZone)
					)
		onWrite(
			{
				title: 'Could not change the lesson',
				back: backAt(initial, mainTimeZone),
				hidden: [],
				shown: movedBlocks(scope, draft, initial, window.events, now, mainTimeZone),
			},
			send
		)
		onClose()
		return Promise.resolve(true)
	}
	function askCancel() {
		if (initial.binding.ref.kind === 'series') setScoping(true)
		else setConfirming(true)
	}
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent
				size="lg"
				showCloseButton={!pending}
				className={cn('data-[nested-dialog-open]:invisible', direct !== 'shown' && 'invisible')}
				backdropClassName={direct === 'sending' ? 'invisible' : undefined}
			>
				<DialogHeader>
					<LessonTitle studentId={event.binding.studentId} title={title} pending={pending} />
					<DialogDescription>
						<EventTime
							event={event}
							timeZone={mainTimeZone}
							secondZone={secondZone}
							currentYear={Number(scheduleDate(now, mainTimeZone).slice(0, 4))}
						/>
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] -m-1 p-1">
					<div className="flex flex-col gap-4 py-1">
						<div className="flex flex-wrap items-baseline justify-between gap-x-4">
							<p className="text-body">{event.status === 'cancelled' ? 'Cancelled' : 'Planned'}</p>
							{!editable && !pending ? <p className="text-body text-muted-foreground">Read-only</p> : null}
						</div>
						<CalendarFormStatus
							entry={command.entry}
							blocked={command.blocked}
							connectionShown={moving}

							onViewSchedule={() => {
								command.detach()
								onClose()
							}}
						/>
						{failure ? (
							<p role="alert" className="text-body text-destructive">
								Could not apply this change. Refresh the calendar before trying again.
							</p>
						) : null}
						<LessonDetails
							block={details}
							series={series?.series ?? null}
							mainTimeZone={mainTimeZone}
							secondZone={secondZone}
						/>
						{moving ? (
							<LessonMoveForm
								moveSeed={moveSeed}
								available={editable}
								scopes={series !== null && editable ? ['one', 'following', 'all'] : ['one']}
								event={initial}
								weekEvents={window.events}
								mainTimeZone={mainTimeZone}
								currentMainTimeZone={window.requestedRange.timeZone}
								asOf={asOf}
								secondZone={secondZone}
								locked={command.pending}
								direct={direct !== 'shown'}
								onDirect={setDirect}
								onClose={onClose}
								onDiscard={() => {
									setMoving(false)
									onMoveDiscard?.()
								}}
								onRefresh={onRefresh}
								onSave={save}
							/>
						) : null}
					</div>
				</ScrollArea>
				<LessonFooter
					block={{ startsAt: event.when.startsAt, actions }}
					mainTimeZone={mainTimeZone}
					confirming={confirming}
					moving={moving}
					pending={pending}
					locked={pending}
					moveButton={moveButton}
					onKeep={() => setConfirming(false)}
					onCancel={() => void change('cancel')}
					onRestore={() => void change('restore')}
					onMove={() => setMoving(true)}
					onConfirm={askCancel}
					onEndSeries={endable ? onEndSeries : undefined}
				/>
				{!pending && !moving ? (
					<Button variant="secondary" onClick={onClose}>
						Close
					</Button>
				) : null}
				{scoping ? (
					<ScopeDialog
						kind={{ subject: 'lesson', action: 'cancel' }}
						allowed={series !== null && editable ? ['one', 'following'] : ['one']}
						onConfirm={cancelScope}
						onClose={() => setScoping(false)}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	)
}

function LessonTitle({ studentId, title, pending }: { studentId: string; title: string; pending: boolean }) {
	return (
		<DialogTitle>
			<Link
				href={`/students/${studentId}`}
				className="block truncate"
				onClick={(event) => {
					if (pending) event.preventDefault()
				}}
				aria-disabled={pending}
			>
				{title}
			</Link>
		</DialogTitle>
	)
}
