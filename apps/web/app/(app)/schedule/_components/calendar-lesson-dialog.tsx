'use client'

import { useRef, useState } from 'react'

import Link from 'next/link'

import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { calendarSeriesFor, canEditCalendarEvent, type CalendarLesson } from '@/lib/lesson-actions'

import type { CalendarSeriesContext, GoogleScheduleWindow } from '@dv-lab/contracts'
import { scheduleDate } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { EventTime, eventTitle } from './calendar-event-details'
import { EndSeriesDialog } from './end-series-dialog'
import { LessonDetails } from './lesson-details'
import { LessonFooter } from './lesson-footer'
import { LessonMoveForm } from './lesson-move-form'
import { MoveSeriesDialog } from './move-series-dialog'
import { useScheduleMutation } from './schedule-mutations'
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
	onRefresh: () => void
}

export function CalendarLessonDialog(props: Props) {
	const [series, setSeries] = useState<{ kind: 'move' | 'end'; context: CalendarSeriesContext } | null>(null)
	const mainTimeZone = props.mainTimeZone
	const asOf = props.window.read.state === 'unavailable' ? props.now.toISOString() : props.window.read.fetchedAt
	const currentSeries = calendarSeriesFor(props.window, props.event)
	const usableSeries = currentSeries !== null && canEditCalendarEvent(props.event, props.window)
	const shared = {
		mainTimeZone,
		currentMainTimeZone: props.window.requestedRange.timeZone,
		asOf,
		studentName: props.student?.name ?? eventTitle(props.event),
		now: props.now,
		onClose: props.onClose,
		onStale: props.onRefresh,
		onRefresh: props.onRefresh,
	}
	if (series?.kind === 'move')
		return <MoveSeriesDialog {...shared} series={series.context} available={usableSeries} onMoved={props.onClose} />
	if (series?.kind === 'end')
		return <EndSeriesDialog {...shared} series={series.context} available={usableSeries} onEnded={props.onClose} />
	return (
		<LessonContent
			{...props}
			asOf={asOf}
			series={currentSeries}
			onSeries={(kind) => {
				if (currentSeries !== null) setSeries({ kind, context: currentSeries })
			}}
		/>
	)
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
	onRefresh,
	asOf,
	series,
	onSeries,
}: Props & {
	asOf: string
	series: CalendarSeriesContext | null
	onSeries: (kind: 'move' | 'end') => void
}) {
	const toast = useToast()
	const [initial] = useState(event)
	const command = useScheduleMutation({
		mainTimeZone,
		date: scheduleDate(new Date(initial.when.startsAt), mainTimeZone),
		event: initial,
	})
	const { blocked } = useCalendarCommands()
	const [moving, setMoving] = useState(moveSeed !== undefined)
	const [movePending, setMovePending] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const [failure, setFailure] = useState(false)
	const moveButton = useRef<HTMLButtonElement>(null)
	const editable = canEditCalendarEvent(event, window) && !blocked
	const pending = command.pending || movePending
	const details = {
		startsAt: event.when.startsAt,
		durationMinutes: (Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000,
		timeZone: event.when.timeZone,
		actions: { series: editable && series !== null },
	}
	const actions = {
		move: editable && event.status !== 'cancelled',
		cancel: editable && event.status !== 'cancelled',
		restore: editable && event.status === 'cancelled',
	}
	const title = student?.name ?? eventTitle(event)
	async function change(action: 'cancel' | 'restore') {
		if (pending || !editable) return
		setFailure(false)
		const result = await command.mutate(initial.binding.ref, action, { expectedStartsAt: initial.when.startsAt })
		if (result.kind === 'detached') return
		if (result.kind !== 'ok') {
			setFailure(true)
			return
		}
		toast.show({
			title: action === 'cancel' ? 'Lesson cancelled' : 'Lesson restored',
			description: `${title}. Google Calendar confirmed the change.`,
		})
		onClose()
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
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="max-h-[inherit] px-1 -mx-1">
					<div className="flex flex-col gap-4 py-1">
						<p className="text-body">{event.status === 'cancelled' ? 'Cancelled' : 'Planned'}</p>
						<CalendarFormStatus
							entry={command.entry}
							blocked={command.blocked}
							onViewSchedule={() => {
								command.detach()
								onClose()
							}}
						/>
						{!editable && !pending ? <p className="text-body text-muted-foreground">Read-only</p> : null}
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
							currentYear={Number(scheduleDate(now, mainTimeZone).slice(0, 4))}
							pending={pending}
							onSeries={onSeries}
						/>
						{moving ? (
							<LessonMoveForm
								moveSeed={moveSeed}
								available={editable}
								event={initial}
								mainTimeZone={mainTimeZone}
								currentMainTimeZone={window.requestedRange.timeZone}
								asOf={asOf}
								secondZone={secondZone}
								locked={command.pending}
								onPendingChange={setMovePending}
								onDiscard={() => {
									if (movePending) onClose()
									else setMoving(false)
								}}
								onStale={onRefresh}
								onRefresh={onRefresh}
								onMoved={onClose}
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
					onConfirm={() => setConfirming(true)}
				/>
				{!pending && !moving ? (
					<Button variant="secondary" onClick={onClose}>
						Close
					</Button>
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
