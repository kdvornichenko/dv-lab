'use client'

import { useEffect, useState } from 'react'

import { Info, MapPin, Pencil, Text, Trash2 } from 'lucide-react'
import Link from 'next/link'

import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { READ_ISSUES } from '@/components/app/google-calendar-state'
import { TimePair } from '@/components/app/time-pair'
import { useGoogleSync } from '@/components/app/use-google-sync'
import { Banner, BannerTitle } from '@/components/ui/banner'
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
import { eventPaint } from '@/lib/event-colors'
import { canChangePlainEvent } from '@/lib/lesson-actions'
import {
	formatDate,
	formatFullDate,
	formatRange,
	formatWhen,
	mainRange,
	secondRange,
	weekdayName,
} from '@/lib/schedule-format'
import { zoneLabel, zoneName } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import {
	calendarIssue,
	placeView,
	type CalendarEditScope,
	type CalendarEventDetails as EventDetailsData,
	type CalendarEventView,
	type CalendarIssue,
	type GoogleScheduleWindow,
} from '@dv-lab/contracts'
import { addDays, scheduleDate } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { ManualAssign, SuggestionBox, type AssignBusy, type AssignFailure } from './event-assign'
import { EventEditForm, type DirectState } from './event-form'
import { EventDescription, EventPlace } from './event-text'
import type { WriteRunner } from './optimistic-writes'
import { ignoreEvent, useScheduleMutation } from './schedule-mutations'
import { detailsKey, dropCache, keepCache, peekCache, readDetails } from './schedule-prefetch'
import { ScopeDialog } from './scope-dialog'
import type { MoveSeed } from './use-lesson-drag'
import type { StudentsState } from './use-lesson-students'

export function eventTitle(event: CalendarEventView): string {
	return event.title?.trim() || 'Busy'
}

export function eventStatus(event: CalendarEventView): string {
	if (event.status === 'cancelled') return 'Cancelled'
	if (event.status === 'tentative') return 'Tentative'
	return event.binding.kind === 'lesson' ? 'Planned' : 'Confirmed'
}

export function eventRange(event: CalendarEventView, timeZone: string): string {
	if (event.when.kind === 'all_day') return 'All day'
	const start = new Date(event.when.startsAt)
	const minutes = (Date.parse(event.when.endsAt) - start.getTime()) / 60000
	return formatRange(start, minutes, timeZone)
}

export function EventTime({
	event,
	timeZone,
	secondZone,
	currentYear,
}: {
	event: CalendarEventView
	timeZone: string
	secondZone: string | null
	currentYear: number
}) {
	if (event.when.kind === 'all_day') {
		const last = addDays(event.when.endsBefore, -1)
		return (
			<>
				<span>All day</span>
				<span className="text-muted-foreground">
					{event.when.startsOn}
					{last !== event.when.startsOn ? ` – ${last}` : ''}
				</span>
				<span className="text-caption text-muted-foreground">{event.when.timeZone}</span>
			</>
		)
	}
	const start = new Date(event.when.startsAt)
	const end = new Date(event.when.endsAt)
	const minutes = (end.getTime() - start.getTime()) / 60000
	const firstDay = formatFullDate(start, timeZone, currentYear)
	const lastDay = formatFullDate(end, timeZone, currentYear)
	return (
		<>
			<span className="text-muted-foreground">
				{firstDay}
				{lastDay !== firstDay ? ` – ${lastDay}` : ''}
			</span>
			<TimePair
				as="span"
				main={mainRange(start, minutes, timeZone, null)}
				second={secondRange(start, minutes, timeZone, secondZone)}
				mainClassName="text-body tabular-nums"
			/>
		</>
	)
}

export function CalendarEventDetails({
	editable = false,
	event,
	timeZone,
	secondZone,
	currentYear,
}: {
	editable?: boolean
	event: CalendarEventView
	timeZone: string
	secondZone: string | null
	currentYear: number
}) {
	return (
		<div className="flex min-w-0 flex-col gap-1 text-body wrap-anywhere" data-slot="calendar-event-details">
			<EventTime event={event} timeZone={timeZone} secondZone={secondZone} currentYear={currentYear} />
			<span>{eventStatus(event)}</span>
			<span>{event.blocksTime ? 'Busy' : 'Available'}</span>
			<span className="text-muted-foreground">Google Calendar event</span>
			<span className="text-muted-foreground">{editable ? 'Editable' : 'Read-only'}</span>
			{event.binding.kind === 'transition' ? (
				<p className="text-muted-foreground">
					This change has not been confirmed. Check its status before trying again.{' '}
					<Link href="/settings?tab=calendar" className="underline underline-offset-2">
						Check status
					</Link>
				</p>
			) : null}
		</div>
	)
}

type DetailsState =
	{ kind: 'loading' } | { kind: 'ready'; data: EventDetailsData } | { kind: 'removed' } | { kind: 'error' }

function useEventDetails(eventKey: string, version: string, revision: string) {
	const [state, setState] = useState<DetailsState>(() => {
		const known = peekCache<EventDetailsData>(detailsKey(eventKey, version))
		return known === undefined ? { kind: 'loading' } : { kind: 'ready', data: known }
	})
	useEffect(() => {
		const abort = new AbortController()
		void readDetails(eventKey, abort.signal).then((result) => {
			if (abort.signal.aborted) return
			if (result.kind === 'ready') keepCache(detailsKey(eventKey, version), result.data)
			else if (result.kind === 'removed') dropCache(detailsKey(eventKey, version))
			setState((previous) => (result.kind === 'error' && previous.kind === 'ready' ? previous : result))
		})
		return () => abort.abort()
	}, [eventKey, version, revision])
	return state
}

function repeatLine(repeat: EventDetailsData['repeat']): string | null {
	if (repeat.kind === 'once') return null
	if (repeat.kind === 'weekly') return `Repeats every ${weekdayName(repeat.weekday)}`
	if (repeat.frequency === 'custom') return 'Repeats on a custom schedule'
	const unit = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[repeat.frequency]
	return repeat.interval === 1 ? `Repeats every ${unit}` : `Repeats every ${repeat.interval} ${unit}s`
}

function Dot({ fill }: { fill: string }) {
	return (
		<span
			aria-hidden
			data-slot="event-dot"
			className="mt-1 size-3 shrink-0 rounded-full ring-1 ring-foreground/10 ring-inset"
			style={{ background: fill }}
		/>
	)
}

function DetailRow({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
	return (
		<div className="flex min-w-0 items-start gap-3">
			<Icon size={16} aria-hidden className="mt-0.5 shrink-0 text-muted-foreground" />
			<div className="flex min-w-0 flex-1 flex-col gap-1 text-body wrap-anywhere">{children}</div>
		</div>
	)
}

function readOnlyReason(
	event: CalendarEventView,
	window: GoogleScheduleWindow | null,
	details: EventDetailsData | null,
	editable: boolean
): CalendarIssue | null {
	if (details?.repeat.kind === 'other') return 'unsupported_recurrence'
	if (details !== null && details.scopes.edit.length === 0 && event.when.kind === 'timed') {
		const parsed = calendarIssue.safeParse(details.scopes.reason)
		return parsed.success ? parsed.data : 'read_only_event'
	}
	if (event.editBlock !== null) return event.editBlock
	if (window === null || window.read.state !== 'fresh') return 'provider_unavailable'
	if (window.write.state === 'blocked') return window.write.reason
	return editable ? null : 'command_pending'
}

export function CalendarEventDialog({
	moveSeed,
	students,
	event,
	window,
	editable,
	timeZone,
	secondZone,
	currentYear,
	onClose,
	onMoveDiscard,
	onReload,
	onWrite,
}: {
	moveSeed?: MoveSeed
	students: StudentsState
	event: CalendarEventView
	window: GoogleScheduleWindow | null
	editable: boolean
	timeZone: string
	secondZone: string | null
	currentYear: number
	onClose: () => void
	onMoveDiscard: () => void
	onReload: () => void
	onWrite: WriteRunner
}) {
	const toast = useToast()
	const controller = useCalendarCommands()
	const sync = useGoogleSync()
	const state = useEventDetails(
		event.eventKey,
		event.version,
		`${sync?.revision ?? ''}|${event.version}|${event.binding.kind}`
	)
	const latest = state.kind === 'ready' ? state.data : null
	const [formBase, setFormBase] = useState<EventDetailsData | null>(null)
	const [dirty, setDirty] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const [removing, setRemoving] = useState<'confirm' | 'scope' | null>(null)
	const [seeded, setSeeded] = useState(false)
	const [busy, setBusy] = useState<AssignBusy>(null)
	const [assignFailure, setAssignFailure] = useState<AssignFailure>(null)
	const [assignChanged, setAssignChanged] = useState(false)
	const allDay = event.when.kind === 'all_day'
	const day = event.when.kind === 'timed' ? scheduleDate(new Date(event.when.startsAt), timeZone) : event.when.startsOn
	const command = useScheduleMutation({ mainTimeZone: timeZone, date: day })
	const calendarLabel = controller.view.connection?.calendar?.label ?? null
	const [seenVersion, setSeenVersion] = useState<string | null>(null)
	const [direct, setDirect] = useState<DirectState>(moveSeed !== undefined ? 'sending' : 'shown')

	if (latest !== null && latest.version !== seenVersion) setSeenVersion(latest.version)
	if (refreshing && latest !== null && event.version === latest.version) {
		setRefreshing(false)
		setFormBase(latest)
	}
	if (
		formBase !== null &&
		latest !== null &&
		latest.version !== formBase.version &&
		!dirty &&
		event.version === latest.version
	)
		setFormBase(latest)

	useEffect(() => {
		if (seenVersion === null || event.version === seenVersion) return
		void controller.readWindow(day)
	}, [seenVersion, event.version, controller, day])

	const title = latest?.title?.trim() || event.title?.trim() || 'Busy'
	const paint = eventPaint((latest ?? event).color)
	const unsupported = latest?.repeat.kind === 'other'
	const canWrite = window !== null && editable && canChangePlainEvent(event, window)
	const editShape =
		!allDay &&
		latest !== null &&
		latest.scopes.edit.length > 0 &&
		(!unsupported || moveSeed !== undefined) &&
		event.binding.kind === 'external' &&
		event.status !== 'cancelled' &&
		event.editBlock === null
	if (moveSeed !== undefined && !seeded && latest !== null) {
		setSeeded(true)
		if (editShape && canWrite) setFormBase(latest)
	}
	const canEdit = canWrite && editShape
	const canDelete = canWrite && latest !== null && latest.scopes.delete.length > 0
	const reason = readOnlyReason(event, window, latest, editable)
	const transition = event.binding.kind === 'transition'
	const removed = state.kind === 'removed'
	const editing = formBase !== null && editShape && !removed
	const pending = command.pending
	const tentative = (latest === null ? event.status : event.status) === 'tentative'
	const repeats = latest === null ? null : repeatLine(latest.repeat)
	const assignable =
		canWrite &&
		latest !== null &&
		!allDay &&
		!unsupported &&
		event.binding.kind === 'external' &&
		event.status !== 'cancelled'
	const suggestedName =
		event.suggestion === null || students.kind !== 'ready'
			? null
			: (students.rows.find((row) => row.id === event.suggestion?.studentId)?.displayName ?? null)
	const suggestionShown = assignable && event.suggestion !== null && suggestedName !== null
	const waitingForSeed = moveSeed !== undefined && !seeded && state.kind === 'loading'
	const quiet = editing ? direct : waitingForSeed && direct !== 'shown' ? 'sending' : 'shown'

	function whenText(label = title) {
		if (event.when.kind === 'timed') {
			const start = new Date(event.when.startsAt)
			return `${label}, ${formatWhen(start, timeZone, currentYear)} ${zoneLabel(timeZone, start)}.`
		}
		return `${label}, ${formatDate(event.when.startsOn, currentYear)}.`
	}

	async function assign(studentId: string, name: string) {
		if (busy !== null || pending) return
		setAssignFailure(null)
		setBusy({ kind: 'assign', studentId })
		const result = await command.mutate({ kind: 'event', eventKey: event.eventKey, version: event.version }, 'assign', {
			studentId,
		})
		setBusy(null)
		if (result.kind === 'detached') return onClose()
		if (result.kind === 'stale') return setAssignChanged(true)
		if (result.kind !== 'ok') return setAssignFailure('assign')
		toast.show({ title: 'Event assigned', description: whenText(name) })
		onClose()
	}

	async function ignore() {
		if (busy !== null || pending) return
		setAssignFailure(null)
		setBusy({ kind: 'ignore' })
		const result = await ignoreEvent(event.eventKey, event.version)
		if (result.kind === 'stale') {
			setBusy(null)
			return setAssignChanged(true)
		}
		if (result.kind !== 'ok') {
			setBusy(null)
			return setAssignFailure('ignore')
		}
		toast.show({ title: 'Suggestion dismissed', description: 'The event stays in Google Calendar.' })
		await controller.readWindow(day)
		setBusy(null)
	}

	function refreshChanged() {
		setAssignChanged(false)
		setAssignFailure(null)
		void controller.readWindow(day)
	}

	async function remove(scope: CalendarEditScope): Promise<boolean> {
		if (latest === null || pending) return false
		const result = await command.mutate(
			{ kind: 'event', eventKey: event.eventKey, version: latest.version },
			'event_delete',
			{ scope }
		)
		if (result.kind !== 'ok') return false
		toast.show({ title: scope === 'one' ? 'Event deleted' : 'Events deleted', description: whenText() })
		onClose()
		return true
	}

	function askDelete() {
		if (latest === null) return
		setRemoving(latest.scopes.delete.length > 1 ? 'scope' : 'confirm')
	}

	return (
		<Dialog
			open
			disablePointerDismissal={editing}
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent
				size={editing ? 'lg' : 'sm'}
				showCloseButton={!editing && !pending}
				className={cn('overflow-hidden data-[nested-dialog-open]:invisible', quiet !== 'shown' && 'invisible')}
				backdropClassName={quiet === 'sending' ? 'invisible' : undefined}
			>
				<DialogHeader className={editing ? undefined : 'pr-10'}>
					<DialogTitle className="flex items-start gap-2 wrap-anywhere">
						<Dot fill={paint?.fill ?? 'var(--selected)'} />
						<span className="min-w-0">{title}</span>
					</DialogTitle>
					<DialogDescription className={editing ? undefined : 'sr-only'}>
						{editing
							? `In ${calendarLabel ?? 'your calendar'}. Times are in ${zoneName(timeZone)} time.`
							: 'Calendar event details'}
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] -m-1 p-1">
					{editing && latest !== null && window !== null ? (
						<EventEditForm
							key={formBase.version}
							moveSeed={moveSeed}
							event={event}
							details={formBase}
							latestVersion={latest.version}
							window={window}
							mainTimeZone={timeZone}
							secondZone={secondZone}
							available={editable}
							direct={direct !== 'shown'}
							onDirect={setDirect}
							onDirtyChange={setDirty}
							onRefresh={() => {
								setRefreshing(true)
								void controller.readWindow(day)
							}}
							onReload={onReload}
							onDiscard={() => {
								setDirty(false)
								setFormBase(null)
								onMoveDiscard()
							}}
							onClose={onClose}
							onWrite={onWrite}
						/>
					) : removed ? (
						<Banner status="warning">
							<BannerTitle>This event no longer exists in Google Calendar.</BannerTitle>
						</Banner>
					) : waitingForSeed ? (
						<div aria-busy className="h-40" data-slot="calendar-event-body" />
					) : (
						<div className="flex flex-col gap-3 py-1" data-slot="calendar-event-body">
							{suggestionShown && event.suggestion !== null && suggestedName !== null ? (
								<SuggestionBox
									name={suggestedName}
									scope={event.suggestion.scope}
									busy={busy}
									failure={assignFailure}
									changed={assignChanged}
									onAssign={() => void assign(event.suggestion?.studentId ?? '', suggestedName)}
									onIgnore={() => void ignore()}
									onRefresh={refreshChanged}
								/>
							) : null}
							<DetailRow icon={Info}>
								<EventTime event={event} timeZone={timeZone} secondZone={secondZone} currentYear={currentYear} />
							</DetailRow>
							{placeView(event.location) !== null ? (
								<DetailRow icon={MapPin}>
									<EventPlace location={event.location} />
								</DetailRow>
							) : null}
							{latest !== null && latest.descriptionBlocks.length > 0 ? (
								<DetailRow icon={Text}>
									<EventDescription blocks={latest.descriptionBlocks} />
								</DetailRow>
							) : null}
							<div className="flex flex-col gap-1 pl-7 text-body text-muted-foreground">
								<span>{event.blocksTime ? 'Busy' : 'Available'}</span>
								{calendarLabel !== null ? <span>{calendarLabel}</span> : null}
								{repeats !== null ? <span>{repeats}</span> : null}
								{tentative ? <span>Tentative</span> : null}
							</div>
							{assignable && !suggestionShown ? (
								<ManualAssign
									students={students}
									seriesMember={event.seriesMember}
									busy={busy}
									failure={assignFailure}
									disabled={pending}
									onPick={(studentId) =>
										void assign(
											studentId,
											students.kind === 'ready'
												? (students.rows.find((row) => row.id === studentId)?.displayName ?? 'Student')
												: 'Student'
										)
									}
								/>
							) : null}
							{transition ? (
								<p className="text-body text-muted-foreground">
									This change has not been confirmed. Check its status before trying again.{' '}
									<Link href="/settings?tab=calendar" className="underline underline-offset-2">
										Check status
									</Link>
								</p>
							) : null}
							{!transition && !canEdit && !(allDay && canDelete) && reason !== null ? (
								<p data-slot="event-read-only" className="flex items-start gap-2 text-body text-muted-foreground">
									<Info size={16} aria-hidden className="mt-0.5 shrink-0" />
									<span>{READ_ISSUES[reason]}</span>
								</p>
							) : null}
						</div>
					)}
				</ScrollArea>
				{editing || removed || transition || !(canEdit || canDelete) ? null : (
					<DialogFooter>
						<Button
							type="button"
							variant="ghost"
							size="compact"
							leadingIcon={Trash2}
							disabled={pending}
							onClick={askDelete}
						>
							Delete event
						</Button>
						{canEdit ? (
							<Button
								type="button"
								variant="secondary"
								size="compact"
								leadingIcon={Pencil}
								disabled={pending}
								onClick={() => latest !== null && setFormBase(latest)}
							>
								Edit event
							</Button>
						) : null}
					</DialogFooter>
				)}
				{removing === 'confirm' ? (
					<ConfirmDialog
						title="Delete this event?"
						body="It is removed from Google Calendar."
						cancelLabel="Keep event"
						confirmLabel="Delete event"
						pendingLabel="Deleting…"
						tone="destructive"
						failureText="Could not delete the event. Try again."
						failureLine
						onConfirm={() => remove('one')}
						onClose={() => setRemoving(null)}
					/>
				) : null}
				{removing === 'scope' && latest !== null ? (
					<ScopeDialog
						kind={{ subject: 'event', action: 'delete' }}
						allowed={latest.scopes.delete}
						onConfirm={remove}
						onClose={() => setRemoving(null)}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	)
}
