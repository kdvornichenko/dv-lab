'use client'

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'

import { CircleAlert, Info, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { TimePair } from '@/components/app/time-pair'
import { useGoogleSync } from '@/components/app/use-google-sync'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest, peekApi } from '@/lib/api-client'
import { formatWhen, secondWhen, yearInZone } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import {
	SYNC_WINDOW_WEEKS,
	googleConnectionSnapshot,
	type CalendarIssue,
	type CalendarReadStatus,
	type GoogleConnectionSnapshot,
	type GoogleScheduleWindow,
	type NextLessonRead,
} from '@dv-lab/contracts'

export const LESSON_DONE_LINE = 'This lesson is marked Done, so it stays where it is.'

export const READ_ISSUES: Record<CalendarIssue, string> = {
	connection_required:
		'Connect Google Calendar to use the calendar. Previously saved history is available for viewing.',
	reconnect_required:
		'Google access expired or was revoked. Reconnect to use the calendar. The last checked view is read-only.',
	permission_required: 'Access to the connected calendar is unavailable. Reconnect to restore calendar access.',
	provider_unavailable: 'Google Calendar is unavailable. Showing the last checked view. Calendar changes are disabled.',
	command_pending: 'Earlier calendar requests need recovery before you can make new changes.',
	external_change:
		'This event changed in Google Calendar. Your change is not confirmed. Refresh the calendar before trying again.',
	disconnect_failed: 'Calendar changes are stopped. Google access removal is not confirmed.',
	invalid_provider_data: 'Could not read a complete calendar view from Google.',
	history_only: 'This record is local history. Calendar changes are unavailable.',
	outside_sync_window: `This week is outside the synced range, from ${SYNC_WINDOW_WEEKS.back} weeks back to ${SYNC_WINDOW_WEEKS.ahead} weeks ahead. Calendar changes are unavailable.`,
	unsupported_recurrence: "This repeat rule can't be edited here. Change it in Google Calendar.",
	read_only_event: "This event can't be edited here. Change it in Google Calendar.",
}

const FULL_CHECK_RUNNING = 'A full check is running.'
const NO_CHECKED_VIEW = 'No checked calendar view is available for these dates.'

function checkedAt(read: Exclude<CalendarReadStatus, { state: 'unavailable' }>, timeZone: string) {
	const at = new Date(read.fetchedAt)
	return `Last checked: ${formatWhen(at, timeZone, yearInZone(at, timeZone))} (${zoneLabel(timeZone, at)})`
}

export function CalendarReadNotice({
	read,
	write,
	timeZone,
	onRefresh,
}: {
	read: CalendarReadStatus
	write: GoogleScheduleWindow['write']
	timeZone: string
	onRefresh: () => Promise<void>
}) {
	const [refreshing, setRefreshing] = useState(false)
	const running = useGoogleSync()?.state === 'running'
	const issue = write.state === 'blocked' ? write.reason : read.state === 'fresh' ? null : read.reason
	const connection =
		issue === 'connection_required' || issue === 'reconnect_required' || issue === 'permission_required'
	async function refresh() {
		setRefreshing(true)
		try {
			await onRefresh()
		} finally {
			setRefreshing(false)
		}
	}
	return (
		<div className="flex flex-wrap items-center gap-3 text-body" data-slot="calendar-read-status">
			<div className="min-w-0 flex-1 space-y-1" role="status">
				{read.state === 'unavailable' ? (
					<p>{NO_CHECKED_VIEW}</p>
				) : (
					<p className="text-muted-foreground">{checkedAt(read, timeZone)}</p>
				)}
				{running ? <p className="text-muted-foreground">{FULL_CHECK_RUNNING}</p> : null}
				{issue !== null && !(read.state === 'unavailable' && issue === 'provider_unavailable') ? (
					<p className="text-muted-foreground">{READ_ISSUES[issue]}</p>
				) : null}
				{write.state === 'blocked' || read.state !== 'fresh' ? (
					<p className="text-muted-foreground">Read-only</p>
				) : null}
			</div>
			<div className="flex shrink-0 flex-wrap gap-2">
				{connection ? (
					<Button
						variant="secondary"
						size="compact"
						nativeButton={false}
						render={<Link href="/settings?tab=calendar" />}
					>
						{issue === 'connection_required' ? 'Connect Google Calendar' : 'Reconnect'}
					</Button>
				) : null}
				<Button variant="secondary" size="compact" loading={refreshing || running} onClick={() => void refresh()}>
					Refresh
				</Button>
			</div>
		</div>
	)
}

type NoticeTone = 'warning' | 'info' | 'error'

const ISSUE_TONES: Record<CalendarIssue, NoticeTone> = {
	connection_required: 'info',
	reconnect_required: 'warning',
	permission_required: 'warning',
	provider_unavailable: 'warning',
	command_pending: 'info',
	external_change: 'warning',
	disconnect_failed: 'error',
	invalid_provider_data: 'warning',
	history_only: 'info',
	outside_sync_window: 'info',
	unsupported_recurrence: 'info',
	read_only_event: 'info',
}

const TONE_STYLE: Record<NoticeTone, { icon: typeof Info; button: string; dot: string | null }> = {
	warning: { icon: TriangleAlert, button: 'bg-warning/12 text-warning hover:text-warning', dot: 'bg-warning' },
	info: { icon: Info, button: 'bg-info/12 text-info hover:text-info', dot: null },
	error: {
		icon: CircleAlert,
		button: 'bg-destructive/12 text-destructive hover:text-destructive',
		dot: 'bg-destructive',
	},
}

function readOnlyLabel(issue: CalendarIssue | null): string {
	if (issue === 'outside_sync_window') return 'Read-only. Outside the synced weeks'
	if (issue === 'connection_required') return 'Read-only. Connect Google Calendar'
	if (issue === 'reconnect_required' || issue === 'permission_required') return 'Read-only. Reconnect Google Calendar'
	return 'Read-only'
}

export function CalendarReadStatusButton({
	read,
	write,
	timeZone,
	onRefresh,
	pendingRecovery,
	recovery,
}: {
	read: CalendarReadStatus
	write: GoogleScheduleWindow['write']
	timeZone: string
	onRefresh: () => Promise<void>
	pendingRecovery: boolean
	recovery: ReactNode
}) {
	const [refreshing, setRefreshing] = useState(false)
	const running = useGoogleSync()?.state === 'running'
	const blocked = write.state === 'blocked' || read.state !== 'fresh'
	const issue =
		write.state === 'blocked'
			? write.reason
			: read.state !== 'fresh'
				? read.reason
				: pendingRecovery
					? 'command_pending'
					: null
	async function refresh() {
		setRefreshing(true)
		try {
			await onRefresh()
		} finally {
			setRefreshing(false)
		}
	}
	if (running) {
		const label = 'Checking Google Calendar…'
		return (
			<span className="relative inline-flex" data-slot="calendar-read-status-button" data-tone="running">
				<span role="status" className="sr-only">
					{label}
				</span>
				<Popover>
					<Tooltip side="bottom" content={label}>
						<PopoverTrigger
							render={
								<Button variant="tertiary" size="icon-compact" aria-label={label}>
									<LoaderCircle className="animate-spin" />
								</Button>
							}
						/>
					</Tooltip>
					<PopoverContent align="end" className="w-90 max-w-[calc(100vw-2rem)] gap-3 p-4">
						<div className="flex min-w-0 flex-col gap-1 text-body" data-slot="calendar-read-status">
							<p>{FULL_CHECK_RUNNING}</p>
							<p className="text-muted-foreground">
								{read.state === 'unavailable' ? NO_CHECKED_VIEW : checkedAt(read, timeZone)}
							</p>
						</div>
						{recovery}
					</PopoverContent>
				</Popover>
			</span>
		)
	}
	if (issue === null && read.state === 'fresh') {
		const label = `${checkedAt(read, timeZone)}. Refresh`
		return (
			<span className="relative inline-flex" data-slot="calendar-read-status-button">
				<span role="status" className="sr-only">
					{checkedAt(read, timeZone)}
				</span>
				<Tooltip side="bottom" content={label}>
					<Button
						variant="tertiary"
						size="icon-compact"
						aria-label={label}
						loading={refreshing}
						onClick={() => void refresh()}
					>
						<RefreshCw />
					</Button>
				</Tooltip>
			</span>
		)
	}
	const tone = TONE_STYLE[issue === null ? 'warning' : ISSUE_TONES[issue]]
	const Icon = tone.icon
	const label = blocked ? readOnlyLabel(issue) : 'Calendar requests need recovery'
	return (
		<span
			className="relative inline-flex"
			data-slot="calendar-read-status-button"
			data-tone={issue === null ? 'warning' : ISSUE_TONES[issue]}
		>
			<span role="status" className="sr-only">
				{label}
			</span>
			<Popover>
				<Tooltip side="bottom" content={label}>
					<PopoverTrigger
						render={
							<Button variant="tertiary" size="icon-compact" aria-label={label} className={tone.button}>
								<Icon />
							</Button>
						}
					/>
				</Tooltip>
				<PopoverContent align="end" className="w-90 max-w-[calc(100vw-2rem)] gap-3 p-4">
					<CalendarReadNotice read={read} write={write} timeZone={timeZone} onRefresh={onRefresh} />
					{recovery}
				</PopoverContent>
			</Popover>
			{tone.dot ? (
				<span
					aria-hidden
					className={cn(
						'pointer-events-none absolute -top-0.5 -right-0.5 size-2 rounded-full ring-1 ring-surface-2',
						tone.dot
					)}
				/>
			) : null}
		</span>
	)
}

export function NextLessonTime({
	next,
	timeZone,
	secondZone,
	currentYear,
}: {
	next: NextLessonRead
	timeZone: string
	secondZone: string | null
	currentYear: number
}) {
	const stale = next.status.state === 'last_known'
	let content: ReactElement
	if (next.result === 'unknown' || next.status.state === 'unavailable') {
		content = <span>Next lesson could not be determined.</span>
	} else if (next.result === 'none') {
		content = <span>{stale ? 'No next lesson at the last check' : 'No next lesson'}</span>
	} else {
		const at = new Date(next.startsAt)
		content = (
			<TimePair
				main={
					stale
						? `Last known next lesson: ${formatWhen(at, timeZone, currentYear)} (${zoneLabel(timeZone, at)})`
						: formatWhen(at, timeZone, currentYear)
				}
				second={secondWhen(at, timeZone, secondZone)}
			/>
		)
	}
	return (
		<span className="flex flex-col gap-1">
			{content}
			{next.status.state === 'last_known' ? (
				<span className="text-caption text-muted-foreground">{checkedAt(next.status, timeZone)}</span>
			) : null}
		</span>
	)
}

type ConnectionAction = GoogleConnectionSnapshot['allowedActions'][number]
type ConnectionView =
	{ status: 'loading' | 'failed'; snapshot: null } | { status: 'ready'; snapshot: GoogleConnectionSnapshot }

const CONNECT_ERROR = 'Could not connect Google Calendar. Try again from Settings.'
const DISCONNECT_ERROR = 'Could not confirm the disconnect request. Refresh the connection status before trying again.'

type ConnectionNotice = { status: 'warning' | 'error'; text: string }
type SwitchOutcome = 'navigating' | 'connect_failed' | 'failed'

const failure = (text: string): ConnectionNotice => ({ status: 'error', text })

function callbackMessage(reason: string | null): ConnectionNotice | null {
	switch (reason) {
		case null:
		case 'connected':
			return null
		case 'denied':
			return { status: 'warning', text: 'Google Calendar was not connected. You can try again when you are ready.' }
		case 'permission_required':
			return {
				status: 'warning',
				text: 'Calendar access was not granted. Allow the requested calendar permissions to connect.',
			}
		case 'invalid_state':
			return failure('This connection request could not be verified. Start again from Settings.')
		case 'wrong_primary':
			return failure(
				'This Google account does not match the connected calendar. Reconnect with the original account, or use Connect another Google account.'
			)
		case 'command_pending':
			return failure(
				'Earlier calendar requests are not confirmed yet. Reconnect the original account to resolve them before connecting another Google account.'
			)
		default:
			return failure(CONNECT_ERROR)
	}
}

function authorizationUrl(value: unknown): string | null {
	if (typeof value !== 'object' || value === null || !('url' in value) || typeof value.url !== 'string') return null
	try {
		const url = new URL(value.url)
		if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth') return null
		if (url.username || url.password || url.hash) return null
		if (['access_token', 'refresh_token', 'id_token'].some((key) => url.searchParams.has(key))) return null
		return url.href
	} catch {
		return null
	}
}

function disconnectObserved(action: ConnectionAction, snapshot: GoogleConnectionSnapshot): boolean {
	if (action === 'confirm_revoked')
		return snapshot.state === 'not_connected' && snapshot.disconnectResolution === 'operator_confirmed'
	return (
		snapshot.state === 'disconnecting' ||
		snapshot.state === 'disconnect_failed' ||
		(snapshot.state === 'not_connected' && snapshot.disconnectResolution !== 'none')
	)
}

export function useGoogleConnection(callbackOutcome: string | null = null) {
	const router = useRouter()
	const [view, setView] = useState<ConnectionView>(() => {
		const cached = peekApi<unknown>('/google/connection')
		const parsed = cached !== null && cached.ok ? googleConnectionSnapshot.safeParse(cached.data) : null
		return parsed?.success ? { status: 'ready', snapshot: parsed.data } : { status: 'loading', snapshot: null }
	})
	const [pending, setPending] = useState<ConnectionAction | null>(null)
	const [notice, setNotice] = useState(() => callbackMessage(callbackOutcome))
	const initialCallback = useRef(callbackOutcome)
	const mounted = useRef(false)
	const sequence = useRef(0)
	const inflight = useRef(false)

	const denied = useCallback(
		(status: number) => {
			if (status !== 401 && status !== 403) return false
			setView({ status: 'failed', snapshot: null })
			router.replace(status === 401 ? '/login?reason=expired' : '/')
			return true
		},
		[router]
	)

	const read = useCallback((): Promise<GoogleConnectionSnapshot | null> => {
		const request = ++sequence.current
		return apiRequest<unknown>('GET', '/google/connection').then((result) => {
			if (!mounted.current || request !== sequence.current) return null
			if (!result.ok) {
				denied(result.status)
				setView({ status: 'failed', snapshot: null })
				return null
			}
			const parsed = googleConnectionSnapshot.safeParse(result.data)
			if (!parsed.success) {
				setView({ status: 'failed', snapshot: null })
				return null
			}
			setView({ status: 'ready', snapshot: parsed.data })
			setNotice((current) => (current?.text === DISCONNECT_ERROR ? null : current))
			return parsed.data
		})
	}, [denied])

	const refresh = useCallback(() => {
		setView({ status: 'loading', snapshot: null })
		return read()
	}, [read])

	useEffect(() => {
		mounted.current = true
		void read()
		if (initialCallback.current !== null) router.replace('/settings?tab=calendar', { scroll: false })
		function returned() {
			if (!inflight.current && document.visibilityState === 'visible') void read()
		}
		window.addEventListener('focus', returned)
		document.addEventListener('visibilitychange', returned)
		return () => {
			mounted.current = false
			sequence.current += 1
			window.removeEventListener('focus', returned)
			document.removeEventListener('visibilitychange', returned)
		}
	}, [read, router])

	useEffect(() => {
		if (view.snapshot?.state !== 'disconnecting') return
		const timer = window.setTimeout(() => {
			if (!inflight.current && document.visibilityState === 'visible') void read()
		}, 2000)
		return () => window.clearTimeout(timer)
	}, [view, read])

	async function connect() {
		const result = await apiRequest<unknown>('POST', '/google/connect', {})
		if (!mounted.current) return false
		if (!result.ok) {
			if (denied(result.status)) return false
			setNotice(failure(CONNECT_ERROR))
			await refresh()
			return false
		}
		const url = authorizationUrl(result.data)
		if (!url) {
			setNotice(failure(CONNECT_ERROR))
			return false
		}
		window.location.assign(url)
		return true
	}

	async function disconnect(action: ConnectionAction) {
		const confirmation = action === 'confirm_revoked'
		const result = await apiRequest<unknown>(
			'POST',
			confirmation ? '/google/disconnect/confirm-revoked' : '/google/disconnect',
			confirmation ? { confirmed: true } : {}
		)
		if (!mounted.current) return false
		if (!result.ok && denied(result.status)) return false
		const current = await refresh()
		if (!mounted.current) return false
		if (current && disconnectObserved(action, current)) return true
		setNotice(failure(DISCONNECT_ERROR))
		return false
	}

	async function disconnected(): Promise<boolean> {
		for (let attempt = 0; attempt < 30; attempt += 1) {
			const current = await read()
			if (!mounted.current || current === null) return false
			if (current.state === 'not_connected') return true
			if (current.state !== 'disconnecting') return false
			await new Promise((resolve) => window.setTimeout(resolve, 1000))
		}
		return false
	}

	async function switchAccount(generation: number): Promise<SwitchOutcome> {
		if (inflight.current) return 'failed'
		inflight.current = true
		setPending('switch')
		setNotice(null)
		try {
			const fresh = await refresh()
			if (!fresh || fresh.generation !== generation || !fresh.allowedActions.includes('switch')) return 'failed'
			if (fresh.state !== 'not_connected') {
				const result = await apiRequest<unknown>('POST', '/google/disconnect', {})
				if (!mounted.current) return 'failed'
				if (!result.ok && denied(result.status)) return 'failed'
				if (!(await disconnected())) return 'failed'
			}
			return (await connect()) ? 'navigating' : 'connect_failed'
		} finally {
			inflight.current = false
			if (mounted.current) setPending(null)
		}
	}

	async function act(action: ConnectionAction, generation: number): Promise<boolean> {
		if (inflight.current) return false
		inflight.current = true
		setPending(action)
		setNotice(null)
		try {
			const fresh = await refresh()
			if (!fresh || fresh.generation !== generation || !fresh.allowedActions.includes(action)) return false
			if (action === 'switch') return false
			return action === 'connect' || action === 'reconnect' ? await connect() : await disconnect(action)
		} finally {
			inflight.current = false
			if (mounted.current) setPending(null)
		}
	}

	return { view, pending, notice, refresh, act, switchAccount }
}
