'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'

import { ExternalLink, Loader2 } from 'lucide-react'
import type { z } from 'zod'

import { calendarVersionFor } from '@/app/(app)/schedule/_components/calendar-overlaps'
import { Banner, BannerTitle, BannerDescription } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
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

import { DISCONNECT_COPY } from './calendar-command-notice'
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
				? firstOnOrAfter(proposal.input.from, proposal.input.weekday)
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
		void check()
	})
	useEffect(() => {
		if (!allowed) return
		const timer = setTimeout(automaticallyCheck, 200)
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
				<span className="text-body tabular-nums">{eventTime(event, year)}</span>
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

function CompleteConflicts({ result, durationMinutes }: { result: CompleteResult; durationMinutes: number | null }) {
	const [expanded, setExpanded] = useState(false)
	const events = result.events
	if (events.length === 0)
		return (
			<Banner status="success">
				<BannerTitle>No Google Calendar overlaps in the checked range.</BannerTitle>
				<BannerDescription className="text-caption text-muted-foreground tabular-nums">
					{checkedLine(result)}
				</BannerDescription>
			</Banner>
		)
	return (
		<div className="flex flex-col gap-2">
			<Banner status="warning">
				<BannerTitle>
					{events.length === 1
						? 'This overlaps a Google Calendar event'
						: `This overlaps ${events.length} Google Calendar events`}
				</BannerTitle>
				<BannerDescription className="text-body text-muted-foreground">
					You can still save this change. Google Calendar must confirm it before it is saved.
				</BannerDescription>
				<div className="col-start-2 row-start-3 mt-1.5 flex min-w-0 flex-col gap-2">
					{(expanded ? events : events.slice(0, 2)).map((event) => (
						<ConflictRow key={event.eventKey} event={event} result={result} durationMinutes={durationMinutes} />
					))}
					<p className="text-caption text-muted-foreground tabular-nums">{checkedLine(result)}</p>
				</div>
			</Banner>
			{events.length > 2 ? (
				<div>
					<Button type="button" variant="ghost" size="compact" onClick={() => setExpanded(!expanded)}>
						{expanded ? 'Show fewer conflicts' : `Show all ${events.length} conflicts`}
					</Button>
				</div>
			) : null}
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

function ConnectionNotice({ state }: { state: GoogleScheduleWindow['connection']['state'] }) {
	const never = state === 'not_connected'
	const lost = state === 'reconnect_required' || state === 'permission_required'
	return (
		<>
			<Banner status="warning">
				<BannerTitle>
					{never
						? 'Connect Google Calendar to view events and make calendar changes.'
						: state === 'disconnecting' || state === 'disconnect_failed'
							? DISCONNECT_COPY[state]
							: 'Reconnect Google Calendar before checking overlaps or saving calendar changes.'}
				</BannerTitle>
			</Banner>
			{never || lost ? (
				<>
					<p className="text-body">
						{never
							? 'Keep this tab open to preserve your unsaved form. Connect in another tab, then return here.'
							: 'Keep this tab open to preserve your unsaved form. Reconnect in another tab, then return here.'}
					</p>
					<div>
						<Button
							variant="secondary"
							leadingIcon={ExternalLink}
							nativeButton={false}
							render={<a href="/settings?tab=calendar" target="_blank" rel="noopener noreferrer" />}
						>
							Open calendar settings
						</Button>
					</div>
				</>
			) : null}
		</>
	)
}

export function GoogleConflicts({
	check,
	pending,
	durationMinutes = null,
}: {
	check: ConflictCheck
	pending: boolean
	durationMinutes?: number | null
}) {
	const result = check.result
	const state = check.connection?.state
	const blocked = state !== undefined && state !== 'connected'
	return (
		<div className="flex flex-col gap-3" data-slot="google-conflicts" aria-live="polite" aria-busy={check.loading}>
			{check.infinite ? <SeriesCheckRange check={check} pending={pending} /> : null}
			<div data-slot="google-conflicts-result" className="h-58 overflow-hidden rounded-xl sm:h-50">
				<div className="scroll-fade flex h-full flex-col gap-3 overflow-y-auto [--scroll-fade-size:var(--scroll-fade-size-compact)]">
					{blocked ? <ConnectionNotice state={state} /> : null}
					{check.loading ? (
						<p className="flex items-center gap-2 text-body text-muted-foreground">
							<Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
							Checking Google Calendar for overlaps…
						</p>
					) : null}
					{result?.state === 'unavailable' ? (
						<Banner status="warning">
							<BannerTitle>Could not check the full calendar range. Check again before saving.</BannerTitle>
						</Banner>
					) : null}
					{check.ready && result?.state === 'complete' ? (
						<CompleteConflicts result={result} durationMinutes={durationMinutes} />
					) : null}
				</div>
			</div>
			<div>
				<Button
					type="button"
					variant="secondary"
					disabled={pending || check.loading || !check.canCheck}
					onClick={() => void check.check()}
				>
					{result?.state === 'unavailable' ? 'Check again' : 'Check overlaps'}
				</Button>
			</div>
		</div>
	)
}
