'use client'

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react'

import { CircleAlert, ExternalLink, Loader2, TriangleAlert } from 'lucide-react'
import type { z } from 'zod'

import { calendarVersionFor } from '@/app/(app)/schedule/_components/calendar-overlaps'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest } from '@/lib/api-client'
import { formatDate, formatDay, formatTime, mainRange, yearInZone } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'

import {
	googleConflictRequest,
	googleConflictResult,
	type GoogleConflictResult,
	type GoogleScheduleWindow,
	type CalendarSeriesContext,
	type CalendarEventView,
	type GoogleConflictEvent,
} from '@dv-lab/contracts'
import { addDays, firstOnOrAfter, mondayOf, scheduleDate } from '@dv-lab/core'

import { useCalendarCommands } from './calendar-command-provider'
import { DateField } from './date-field'

type ConflictRequest = z.infer<typeof googleConflictRequest>
type Selection = {
	proposal: ConflictRequest['proposal'] | null
	editedRef?: ConflictRequest['editedRef']
	date: string
	available: boolean
	series?: CalendarSeriesContext
}
type Check = { key: string; result: GoogleConflictResult; window: GoogleScheduleWindow | null } | null

function targetVersion(window: GoogleScheduleWindow, selection: Selection): string | null {
	if (window.read.state !== 'fresh' || window.write.state !== 'ready') return null
	if (selection.proposal?.operation === 'create') return calendarVersionFor(window, { kind: 'new' })
	const ref = selection.editedRef
	if (!ref) return null
	const target =
		selection.proposal?.operation === 'move_series' && ref.kind === 'series'
			? { kind: 'rule' as const, seriesId: ref.seriesId }
			: ref
	return calendarVersionFor(window, target, {
		series: selection.series,
		expectedStartsAt: selection.proposal?.operation === 'move' ? selection.proposal.input.expectedStartsAt : undefined,
	})
}

async function conflictInputKey(input: ConflictRequest, window: GoogleScheduleWindow) {
	if (window.read.state !== 'fresh') throw new Error('Conflict input requires a fresh window')
	const values = [
		JSON.stringify(input),
		window.requestedRange.timeZone,
		window.connection.calendar?.id,
		window.connection.generation,
		window.read.revision,
	]
	const data = new TextEncoder().encode(values.map(String).join('\0'))
	const digest = await crypto.subtle.digest('SHA-256', data)
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function samePublication(window: GoogleScheduleWindow | null | undefined, publication: GoogleScheduleWindow | null) {
	if (window?.read.state !== 'fresh') return false
	return (
		publication === null || (publication.read.state === 'fresh' && publication.read.revision === window.read.revision)
	)
}

function publicationRevision(window: GoogleScheduleWindow | null) {
	return window?.read.state === 'fresh' ? window.read.revision : JSON.stringify(window?.read)
}

function selectionRange(selection: Selection) {
	const proposal = selection.proposal
	const infinite =
		proposal?.operation === 'create'
			? proposal.input.repeats === 'weekly'
			: proposal?.operation === 'move_series' && selection.series?.series.endsOn === null
	const minimum =
		proposal?.operation === 'create'
			? proposal.input.date
			: proposal?.operation === 'move_series'
				? firstOnOrAfter(proposal.input.newStartsOn ?? proposal.input.from, proposal.input.weekday)
				: selection.date
	return { infinite, minimum }
}

function automaticThrough(minimum: string, window: GoogleScheduleWindow | null) {
	if (window !== null) {
		const range = window.requestedRange
		const first = scheduleDate(new Date(range.start), range.timeZone)
		const last = addDays(scheduleDate(new Date(range.end), range.timeZone), -1)
		if (first <= minimum && minimum <= last) return last
	}
	return addDays(mondayOf(minimum), 6)
}

function sameGrant(
	window: GoogleScheduleWindow | null | undefined,
	connection: GoogleScheduleWindow['connection'] | null
) {
	if (!window || !connection || connection.state !== 'connected') return false
	return (
		window.connection.generation === connection.generation && window.connection.calendar?.id === connection.calendar?.id
	)
}

function resultState(
	stored: Check,
	key: string,
	publication: GoogleScheduleWindow | null,
	connection: GoogleScheduleWindow['connection'] | null,
	allowed: boolean,
	loading: string | null
) {
	const current = stored?.key === key ? stored : null
	const published = samePublication(current?.window, publication)
	const ready =
		allowed &&
		published &&
		sameGrant(current?.window, connection) &&
		current?.result.state === 'complete' &&
		loading !== key
	return {
		current,
		result: current?.result.state === 'unavailable' ? current.result : published ? (current?.result ?? null) : null,
		ready,
		window: ready ? (current?.window ?? null) : null,
	}
}

export function useGoogleConflicts(selection: Selection) {
	const controller = useCalendarCommands()
	const { store, readWindow, subscribeWindow } = controller
	const [customThrough, setThrough] = useState<string | null>(null)
	const [stored, setStored] = useState<Check>(null)
	const [loading, setLoading] = useState<string | null>(null)
	const [publication, setPublication] = useState<GoogleScheduleWindow | null>(null)
	const sequence = useRef(0)
	const request = useRef<AbortController | null>(null)
	const mounted = useRef(false)
	const latestPublication = useRef<GoogleScheduleWindow | null>(null)
	const attempted = useRef<string | null>(null)
	const started = useRef(false)
	const proposal = selection.proposal
	const { infinite, minimum } = selectionRange(selection)
	const through = infinite ? (customThrough ?? automaticThrough(minimum, publication)) : customThrough
	const rangeValid = !infinite || (through !== null && through >= minimum)
	const key = JSON.stringify([
		proposal,
		selection.editedRef,
		selection.series,
		selection.available,
		selection.date,
		through,
		controller.view.connection,
		controller.blocked,
	])
	const currentKey = useRef(key)
	const allowed = selection.available && !controller.blocked && proposal !== null && rangeValid
	const autoKey = JSON.stringify([key, publicationRevision(publication)])
	if (stored !== null && stored.key !== key) setStored(null)
	if (loading !== null && loading !== key) setLoading(null)

	useEffect(() => {
		currentKey.current = key
		attempted.current = null
		sequence.current += 1
		request.current?.abort()
	}, [key])
	useEffect(() => {
		mounted.current = true
		const remove = subscribeWindow((window) => {
			latestPublication.current = window
			setPublication(window)
		})
		function returned() {
			if (document.visibilityState !== 'visible') return
			const token = ++sequence.current
			request.current?.abort()
			attempted.current = null
			setLoading(null)
			void store.refresh().then(() => {
				const current = () => mounted.current && token === sequence.current
				return current() ? readWindow(selection.date, current) : null
			})
		}
		window.addEventListener('focus', returned)
		document.addEventListener('visibilitychange', returned)
		return () => {
			mounted.current = false
			sequence.current += 1
			request.current?.abort()
			remove()
			window.removeEventListener('focus', returned)
			document.removeEventListener('visibilitychange', returned)
		}
	}, [store, readWindow, subscribeWindow, selection.date])

	async function check() {
		if (!allowed || !proposal) return
		const token = ++sequence.current
		request.current?.abort()
		const abort = new AbortController()
		request.current = abort
		setLoading(key)
		setStored(null)
		const current = () => mounted.current && token === sequence.current && currentKey.current === key
		try {
			const window = await readWindow(selection.date, current)
			if (!current()) return
			attempted.current = JSON.stringify([key, publicationRevision(window)])
			const version = window === null ? null : targetVersion(window, selection)
			if (!version || !window) {
				setStored({ key, result: { state: 'unavailable', inputKey: key, reason: 'external_change' }, window: null })
				return
			}
			const input = googleConflictRequest.parse({
				proposal,
				editedRef: selection.editedRef,
				expectedVersion: version,
				checkThrough: infinite ? (through ?? undefined) : undefined,
			})
			const expectedKey = await conflictInputKey(input, window)
			if (!current()) return
			const response = await apiRequest<unknown>('POST', '/google/conflicts', input, {
				signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]),
			})
			if (!current()) return
			const result = response.ok ? googleConflictResult.safeParse(response.data) : null
			const checked =
				result?.success && (result.data.state !== 'complete' || result.data.inputKey === expectedKey)
					? result.data
					: { state: 'unavailable' as const, inputKey: key, reason: 'provider_unavailable' as const }
			setStored({ key, result: checked, window })
		} catch {
			if (!current()) return
			setStored({ key, result: { state: 'unavailable', inputKey: key, reason: 'provider_unavailable' }, window: null })
		} finally {
			if (current()) setLoading(null)
		}
	}
	const automaticallyCheck = useEffectEvent(() => {
		if (!allowed || loading === key || attempted.current === autoKey) return
		attempted.current = autoKey
		started.current = true
		void check()
	})
	useEffect(() => {
		if (!allowed) return
		const timer = setTimeout(automaticallyCheck, started.current ? 400 : 0)
		return () => clearTimeout(timer)
	}, [allowed, autoKey, loading, stored])

	const view = resultState(stored, key, publication, controller.view.connection, allowed, loading)
	function isCurrent() {
		const connection = store.getSnapshot().connection
		return (
			view.current?.key === currentKey.current &&
			view.current?.result.state === 'complete' &&
			samePublication(view.current.window, latestPublication.current) &&
			sameGrant(view.current.window, connection)
		)
	}
	return {
		result: view.result,
		ready: view.ready,
		canCheck: allowed,
		window: view.window,
		checked: view.window === null ? null : { window: view.window, isCurrent },
		loading: loading === key,
		check,
		infinite,
		through,
		setThrough,
		minimum,
		rangeValid,
		connection: controller.view.connection,
	}
}

type ConflictCheck = ReturnType<typeof useGoogleConflicts>
type CompleteResult = Extract<GoogleConflictResult, { state: 'complete' }>

function slotTime(instant: Date, zone: string, minutes: number | null, year: number) {
	const day = formatDay(instant, zone, year)
	return minutes === null
		? `${day}, ${formatTime(instant, zone)} ${zoneLabel(zone, instant)}`
		: `${day}, ${mainRange(instant, minutes, zone, null)}`
}

function eventTime(event: CalendarEventView, year: number) {
	if (event.when.kind === 'all_day') {
		const last = addDays(event.when.endsBefore, -1)
		const first = formatDate(event.when.startsOn, year)
		return last === event.when.startsOn ? `${first}, all day` : `${first} – ${formatDate(last, year)}, all day`
	}
	const start = new Date(event.when.startsAt)
	const minutes = (Date.parse(event.when.endsAt) - start.getTime()) / 60000
	return slotTime(start, event.when.timeZone, minutes, year)
}

function checkedLine(result: CompleteResult) {
	const range = result.checkedRange
	const at = new Date(result.checkedAt)
	const year = yearInZone(at, range.timeZone)
	const first = scheduleDate(new Date(range.start), range.timeZone)
	const last = scheduleDate(new Date(Date.parse(range.end) - 1), range.timeZone)
	const dates = first === last ? formatDate(first, year) : `${formatDate(first, year)} – ${formatDate(last, year)}`
	return `Checked ${dates} (${zoneLabel(range.timeZone, new Date(range.start))}) · ${formatTime(at, range.timeZone)}`
}

function ConflictRow({
	event,
	result,
	durationMinutes,
}: {
	event: GoogleConflictEvent
	result: CompleteResult
	durationMinutes: number | null
}) {
	const zone = result.checkedRange.timeZone
	const year = yearInZone(new Date(result.checkedAt), zone)
	const slots = event.matchedStartsAt.slice(0, 2)
	const more = event.matchedStartsAt.length - slots.length
	return (
		<div className="flex flex-col gap-1 border-t border-foreground/10 pt-2">
			<p className="text-body font-semibold wrap-anywhere">{event.title || 'Busy'}</p>
			<div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-0.5">
				<span className="text-caption text-muted-foreground">Google event</span>
				<span className="text-caption tabular-nums">{eventTime(event, year)}</span>
				<span className="text-caption text-muted-foreground">Your slots</span>
				<div className="flex flex-col">
					{slots.map((instant) => (
						<p key={instant} className="text-caption tabular-nums">
							{slotTime(new Date(instant), zone, durationMinutes, year)}
						</p>
					))}
					{more > 0 ? <p className="text-caption text-muted-foreground">and {more} more</p> : null}
				</div>
			</div>
		</div>
	)
}

function SeriesCheckRange({ check, pending }: { check: ConflictCheck; pending: boolean }) {
	return (
		<DateField
			nullable
			id="google-check-through"
			label="Check through"
			value={check.through}
			onChange={check.setThrough}
			min={check.minimum}
			disabled={pending}
			helper="Choose the last date to check for overlaps before saving. This does not end the series."
			error={check.through !== null && !check.rangeValid ? 'Choose the first lesson date or a later date.' : undefined}
		/>
	)
}

export function lessonOverlaps(
	events: readonly CalendarEventView[],
	start: Date | null,
	minutes: number | null,
	exclude: string | null = null
): CalendarEventView[] {
	if (start === null || minutes === null || minutes <= 0) return []
	const from = start.getTime()
	const to = from + minutes * 60000
	return events.filter(
		(event) =>
			event.binding.kind === 'lesson' &&
			event.eventKey !== exclude &&
			event.status !== 'cancelled' &&
			event.when.kind === 'timed' &&
			Date.parse(event.when.startsAt) < to &&
			Date.parse(event.when.endsAt) > from
	)
}

function overlapLabel(lessons: readonly CalendarEventView[], google: number) {
	const lessonPart =
		lessons.length === 0
			? null
			: lessons.length > 1
				? `${lessons.length} lessons`
				: google > 0
					? 'a lesson'
					: lessons[0].title || 'a lesson'
	const googlePart = google === 0 ? null : google === 1 ? 'an event' : `${google} events`
	return `Overlaps ${[lessonPart, googlePart].filter(Boolean).join(' and ')}`
}

function LessonRow({ event, zone, year }: { event: CalendarEventView; zone: string; year: number }) {
	const when =
		event.when.kind === 'timed'
			? slotTime(
					new Date(event.when.startsAt),
					zone,
					(Date.parse(event.when.endsAt) - Date.parse(event.when.startsAt)) / 60000,
					year
				)
			: eventTime(event, year)
	return (
		<div className="flex items-baseline justify-between gap-3 border-t border-foreground/10 pt-2">
			<p className="min-w-0 text-body font-semibold wrap-anywhere">{event.title || 'Busy'}</p>
			<p className="shrink-0 text-caption tabular-nums">{when}</p>
		</div>
	)
}

function OverlapDetails({
	lessons,
	result,
	zone,
	durationMinutes,
}: {
	lessons: readonly CalendarEventView[]
	result: CompleteResult | null
	zone: string
	durationMinutes: number | null
}) {
	const [expanded, setExpanded] = useState(false)
	const google = result === null ? [] : result.events.filter((event) => event.binding.kind !== 'lesson')
	const shownGoogle = expanded ? google : google.slice(0, 2)
	const year = yearInZone(new Date(), zone)
	return (
		<div
			data-slot="google-conflicts-details"
			className="scroll-fade flex max-h-[190px] flex-col gap-3 overflow-y-auto [--scroll-fade-size:var(--scroll-fade-size-compact)]"
		>
			<p className="text-caption text-muted-foreground">
				You can still save. Google Calendar must confirm it before it is saved.
			</p>
			{lessons.length > 0 ? (
				<div className="flex flex-col gap-2">
					<p className="text-caption text-muted-foreground">Lessons</p>
					{lessons.map((event) => (
						<LessonRow key={event.eventKey} event={event} zone={zone} year={year} />
					))}
				</div>
			) : null}
			{result !== null && google.length > 0 ? (
				<div className="flex flex-col gap-2">
					<p className="text-caption text-muted-foreground">Google Calendar</p>
					{shownGoogle.map((event) => (
						<ConflictRow key={event.eventKey} event={event} result={result} durationMinutes={durationMinutes} />
					))}
					{google.length > 2 ? (
						<div>
							<Button type="button" variant="ghost" size="compact" onClick={() => setExpanded(!expanded)}>
								{expanded ? 'Show fewer conflicts' : `Show all ${google.length} conflicts`}
							</Button>
						</div>
					) : null}
					<p className="text-caption text-muted-foreground tabular-nums">{checkedLine(result)}</p>
				</div>
			) : null}
		</div>
	)
}

export function GoogleConflicts({ check, pending }: { check: ConflictCheck; pending: boolean }) {
	return check.infinite ? <SeriesCheckRange check={check} pending={pending} /> : null
}

const CONNECT_TIP =
	'Overlaps are not checked until Google Calendar is connected. Keep this tab open: connect in another tab, then return here.'

function Spinner() {
	return <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-muted-foreground" />
}

function OverlapControl({
	label,
	lessons,
	result,
	zone,
	durationMinutes,
	busy,
}: {
	label: string
	lessons: readonly CalendarEventView[]
	result: CompleteResult | null
	zone: string
	durationMinutes: number | null
	busy: boolean
}) {
	const [open, setOpen] = useState(false)
	return (
		<span className="flex min-w-0 items-center gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="compact"
							active={open}
							leadingIcon={TriangleAlert}
							className="min-w-0 [&_svg]:text-warning"
						/>
					}
				>
					{label}
				</PopoverTrigger>
				<PopoverContent
					side="top"
					align="start"
					sideOffset={4}
					role="group"
					aria-label="Overlap details"
					className="w-[440px] max-w-[calc(100vw-32px)] rounded-xl p-3"
				>
					<OverlapDetails lessons={lessons} result={result} zone={zone} durationMinutes={durationMinutes} />
				</PopoverContent>
			</Popover>
			{busy ? <Spinner /> : null}
		</span>
	)
}

export function ConflictStatus({
	check,
	timeZone,
	durationMinutes = null,
	failure = null,
	lessons = [],
}: {
	check: ConflictCheck
	timeZone: string
	durationMinutes?: number | null
	failure?: string | null
	lessons?: readonly CalendarEventView[]
}) {
	const result = check.result
	const state = check.connection?.state
	const busy = check.loading || (check.canCheck && result === null)
	const complete = check.ready && result?.state === 'complete' ? result : null
	const found = complete === null ? lessons : complete.events.filter((event) => event.binding.kind === 'lesson')
	const google = complete === null ? 0 : complete.events.length - found.length
	let content: ReactNode = null
	if (failure !== null)
		content = (
			<span className="flex min-w-0 items-center gap-2 text-caption text-destructive">
				<CircleAlert aria-hidden className="size-4 shrink-0" />
				<span className="line-clamp-2 min-w-0">{failure}</span>
			</span>
		)
	else if (state === 'not_connected' || state === 'reconnect_required' || state === 'permission_required')
		content = (
			<Tooltip content={CONNECT_TIP} className="max-w-[280px]">
				<Button
					variant="ghost"
					size="compact"
					leadingIcon={ExternalLink}
					nativeButton={false}
					render={<a href="/settings?tab=calendar" target="_blank" rel="noopener noreferrer" />}
				>
					{state === 'not_connected' ? 'Connect calendar' : 'Reconnect calendar'}
				</Button>
			</Tooltip>
		)
	else if (found.length > 0 || google > 0)
		content = (
			<OverlapControl
				label={overlapLabel(found, google)}
				lessons={found}
				result={complete}
				zone={complete?.checkedRange.timeZone ?? timeZone}
				durationMinutes={durationMinutes}
				busy={busy}
			/>
		)
	else if (busy)
		content = (
			<span className="flex items-center gap-2 text-caption text-muted-foreground">
				<Spinner />
				Checking…
			</span>
		)
	else if (result?.state === 'unavailable')
		content = (
			<Button
				type="button"
				variant="ghost"
				size="compact"
				leadingIcon={TriangleAlert}
				className="[&_svg]:text-warning"
				disabled={!check.canCheck}
				onClick={() => void check.check()}
			>
				Check failed. Retry
			</Button>
		)
	else if (complete !== null) content = <span className="sr-only">No overlaps.</span>
	return (
		<div
			data-slot="google-conflicts-status"
			aria-live="polite"
			aria-busy={busy}
			className="flex min-h-7 min-w-0 items-center"
		>
			{content}
		</div>
	)
}

export function FormFooter({
	status,
	children,
	className = 'mt-6',
}: {
	status: ReactNode
	children: ReactNode
	className?: string
}) {
	return (
		<div
			data-slot="form-footer"
			className={`${className} flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 pointer-coarse:max-sm:gap-4`}
		>
			<div className="min-w-0 sm:flex-1">{status}</div>
			<div className="flex justify-end gap-2 max-sm:*:flex-1">{children}</div>
		</div>
	)
}
