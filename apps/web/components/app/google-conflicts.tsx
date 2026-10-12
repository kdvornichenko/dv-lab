'use client'

import { useEffect, useRef, useState } from 'react'

import type { z } from 'zod'

import { calendarVersionFor } from '@/app/(app)/schedule/_components/calendar-overlaps'
import { Banner, BannerTitle, BannerDescription } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api-client'

import {
	googleConflictRequest,
	googleConflictResult,
	type GoogleConflictResult,
	type GoogleScheduleWindow,
	type CalendarSeriesContext,
	type CalendarEventView,
} from '@dv-lab/contracts'
import { firstOnOrAfter } from '@dv-lab/core'

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

function selectionRange(selection: Selection, through: string | null) {
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
	return { infinite, minimum, rangeValid: !infinite || (through !== null && through >= minimum) }
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
	const [through, setThrough] = useState<string | null>(null)
	const [stored, setStored] = useState<Check>(null)
	const [loading, setLoading] = useState<string | null>(null)
	const [publication, setPublication] = useState<GoogleScheduleWindow | null>(null)
	const sequence = useRef(0)
	const request = useRef<AbortController | null>(null)
	const mounted = useRef(false)
	const latestPublication = useRef<GoogleScheduleWindow | null>(null)
	const proposal = selection.proposal
	const { infinite, minimum, rangeValid } = selectionRange(selection, through)
	const key = JSON.stringify([
		proposal,
		selection.editedRef,
		selection.series,
		selection.available,
		through,
		controller.view.connection,
		controller.blocked,
	])
	const currentKey = useRef(key)
	const allowed = selection.available && !controller.blocked && proposal !== null && rangeValid
	if (stored !== null && stored.key !== key) setStored(null)
	if (loading !== null && loading !== key) setLoading(null)

	useEffect(() => {
		currentKey.current = key
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
			setStored(null)
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
		const window = await readWindow(selection.date, current)
		if (!current()) return
		const version = window === null ? null : targetVersion(window, selection)
		if (!version || !window) {
			setStored({ key, result: { state: 'unavailable', inputKey: key, reason: 'external_change' }, window: null })
			setLoading(null)
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
		setLoading(null)
	}

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

function eventTime(event: CalendarEventView) {
	return event.when.kind === 'timed'
		? `${event.when.startsAt}–${event.when.endsAt} (${event.when.timeZone})`
		: `${event.when.startsOn}–before ${event.when.endsBefore} (${event.when.timeZone})`
}

function CompleteConflicts({ result }: { result: Extract<GoogleConflictResult, { state: 'complete' }> }) {
	const [expanded, setExpanded] = useState(false)
	const events = result.events
	return (
		<Banner status={events.length ? 'warning' : 'success'}>
			<BannerTitle>
				{events.length === 0
					? 'No Google Calendar overlaps in the checked range.'
					: events.length === 1
						? 'This overlaps a Google Calendar event'
						: `This overlaps ${events.length} Google Calendar events`}
			</BannerTitle>
			<BannerDescription>
				Checked range: {result.checkedRange.start}–{result.checkedRange.end} ({result.checkedRange.timeZone}).
			</BannerDescription>
			<BannerDescription>{result.checkedAt}</BannerDescription>
			{events.length ? (
				<BannerDescription>
					You can still save this change. Google Calendar must confirm it before it is saved.
				</BannerDescription>
			) : null}
			{(expanded ? events : events.slice(0, 2)).map((event) => (
				<div key={event.eventKey} className="text-body">
					<p>
						{event.title || 'Busy'} · {eventTime(event)}
					</p>
					<p className="text-caption">{event.matchedStartsAt.join(', ')}</p>
				</div>
			))}
			{events.length > 2 ? (
				<Button type="button" variant="ghost" size="compact" onClick={() => setExpanded(!expanded)}>
					{expanded ? 'Show fewer conflicts' : `Show all ${events.length} conflicts`}
				</Button>
			) : null}
		</Banner>
	)
}

export function GoogleConflicts({ check, pending }: { check: ConflictCheck; pending: boolean }) {
	const result = check.result
	const blocked = check.connection !== null && check.connection.state !== 'connected'
	return (
		<div className="flex flex-col gap-3" data-slot="google-conflicts" aria-live="polite" aria-busy={check.loading}>
			{check.infinite ? (
				<DateField
					nullable
					id="google-check-through"
					label="Check through"
					value={check.through}
					onChange={check.setThrough}
					min={check.minimum}
					disabled={pending}
					helper="Choose the last date to check for overlaps before saving. This does not end the series."
					error={
						check.through !== null && !check.rangeValid ? 'Choose the first lesson date or a later date.' : undefined
					}
				/>
			) : null}
			{blocked ? (
				<Banner status="warning">
					<BannerTitle>
						{check.connection?.state === 'not_connected'
							? 'Connect Google Calendar to view events and make calendar changes.'
							: 'Reconnect Google Calendar before checking overlaps or saving calendar changes.'}
					</BannerTitle>
				</Banner>
			) : null}
			{check.loading ? <p className="text-body">Checking Google Calendar for overlaps…</p> : null}
			{result?.state === 'unavailable' ? (
				<Banner status="warning">
					<BannerTitle>Could not check the full calendar range. Check again before saving.</BannerTitle>
				</Banner>
			) : null}
			{check.ready && result?.state === 'complete' ? <CompleteConflicts result={result} /> : null}
			<Button
				type="button"
				variant="secondary"
				disabled={pending || check.loading || !check.canCheck}
				onClick={() => void check.check()}
			>
				{result?.state === 'unavailable' ? 'Check again' : 'Check overlaps'}
			</Button>
			<p className="text-caption text-muted-foreground">
				Keep this tab open to preserve your unsaved form. Reconnect in another tab, then return here.
			</p>
			<a href="/settings?tab=calendar" target="_blank" rel="noopener noreferrer" className="text-body underline">
				Open calendar settings
			</a>
		</div>
	)
}
