'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { commandUnconfirmed } from '@/components/app/calendar-command-notice'
import { useCalendarCommands } from '@/components/app/calendar-command-provider'
import { formatWhen, yearInZone } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'

import type { CalendarEventView, ErrorCode } from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'
import type { CalendarMutationResult, CalendarSend } from './schedule-mutations'

export type BlockMark = 'syncing' | 'unconfirmed'

export type OptimisticWrite = {
	title: string
	back: string
	hidden: readonly string[]
	shown: readonly CalendarEventView[]
	redo?: () => void
}

export type WriteRunner = (write: OptimisticWrite, send: CalendarSend) => void

type Active = OptimisticWrite & { token: number; requestId: string | null }

export const SYNCING_LINE = 'Syncing with Google Calendar…'
const NOT_CONFIRMED_LINE = 'This change has not been confirmed. Check its status before trying again.'
const ACCESS_CODES: readonly ErrorCode[] = ['connection_required', 'reconnect_required', 'permission_required']

function refusal(result: CalendarMutationResult): string {
	if (result.kind === 'stale') return 'It was changed in Google Calendar meanwhile. The schedule has been refreshed.'
	if (result.kind === 'failed' && result.code !== null && ACCESS_CODES.includes(result.code))
		return 'Google Calendar access is unavailable. Reconnect it in Settings.'
	return 'Google Calendar did not accept the change.'
}

export function backAt(event: CalendarEventView, mainTimeZone: string): string {
	if (event.when.kind !== 'timed') return 'It is back as it was.'
	const start = new Date(event.when.startsAt)
	const year = yearInZone(new Date(), mainTimeZone)
	return `It is back at ${formatWhen(start, mainTimeZone, year)} ${zoneLabel(mainTimeZone, start)}.`
}

export function placedEvent(event: CalendarEventView, start: Date, minutes: number): CalendarEventView {
	if (event.when.kind !== 'timed') return event
	return {
		...event,
		when: {
			...event.when,
			startsAt: start.toISOString(),
			endsAt: new Date(start.getTime() + minutes * 60000).toISOString(),
		},
	}
}

export function useOptimisticWrites(onRefused: () => void) {
	const commands = useCalendarCommands()
	const toast = useToast()
	const [active, setActive] = useState<Active | null>(null)
	const busy = useRef(false)
	const alive = useRef(true)
	const counter = useRef(0)
	const warned = useRef<{ requestId: string; toast: number } | null>(null)
	const requestId = active?.requestId ?? null
	const entry = requestId === null ? null : (commands.view.entries.find((item) => item.requestId === requestId) ?? null)
	const unconfirmed = commandUnconfirmed(entry)
	const commandId = entry?.commandId ?? null

	useEffect(() => {
		alive.current = true
		return () => {
			alive.current = false
		}
	}, [])

	useEffect(() => {
		if (!unconfirmed || requestId === null || warned.current?.requestId === requestId) return
		const id = toast.show({
			status: 'warning',
			sticky: true,
			title: 'Change not confirmed',
			description: NOT_CONFIRMED_LINE,
			action: { label: 'Check status', href: '/settings?tab=calendar' },
		})
		warned.current = { requestId, toast: id }
	}, [unconfirmed, requestId, toast])

	const run = useCallback<WriteRunner>(
		(write, send) => {
			if (busy.current) return
			busy.current = true
			const token = ++counter.current
			setActive({ ...write, token, requestId: null })
			void send((id) => {
				if (alive.current) setActive((current) => (current?.token === token ? { ...current, requestId: id } : current))
			})
				.catch((): CalendarMutationResult => ({ kind: 'failed', code: null }))
				.then((result) => {
					busy.current = false
					if (!alive.current) return
					setActive((current) => (current?.token === token ? null : current))
					if (warned.current !== null) {
						toast.dismiss(warned.current.toast)
						warned.current = null
					}
					if (result.kind === 'ok' || result.kind === 'detached') return
					toast.show({
						status: 'error',
						sticky: true,
						title: write.title,
						description: `${refusal(result)} ${write.back}`,
						action: write.redo ? { label: 'Edit again', onClick: write.redo } : undefined,
					})
					onRefused()
				})
		},
		[toast, onRefused]
	)

	function apply(events: readonly CalendarEventView[]): readonly CalendarEventView[] {
		if (active === null) return events
		const hidden = new Set([...active.hidden, ...active.shown.map((event) => event.eventKey)])
		const kept = events.filter(
			(event) =>
				!hidden.has(event.eventKey) &&
				!(commandId !== null && event.binding.kind === 'transition' && event.binding.commandId === commandId)
		)
		return [...kept, ...active.shown]
	}

	function mark(event: CalendarEventView): BlockMark | null {
		if (active === null || !active.shown.some((shown) => shown.eventKey === event.eventKey)) return null
		return unconfirmed ? 'unconfirmed' : 'syncing'
	}

	return { run, apply, mark, writing: active !== null }
}
