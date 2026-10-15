'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { LoaderCircle, RefreshCw } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { Banner, BannerAction, BannerActions } from '@/components/ui/banner'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { apiRequest } from '@/lib/api-client'
import { PUSH_CHANGED, currentState, resync, subscribe, unsubscribe, type PushSnapshot } from '@/lib/push-client'

import {
	NOTIFY_LESSON_MINUTES_MAX,
	NOTIFY_LESSON_MINUTES_MIN,
	updateSettingsRequest,
	type SettingsResponse,
	type TeacherSettings,
} from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'

type NotifyFields = Pick<TeacherSettings, 'notifyLessonSoon' | 'notifyLessonMinutes' | 'notifyPaysSoon'>

const REVERT_DELAY_MS = 2000
const RANGE_ERROR = `Use a whole number from ${NOTIFY_LESSON_MINUTES_MIN} to ${NOTIFY_LESSON_MINUTES_MAX}.`
const TURN_ON_ERROR = 'Could not turn on notifications. Try again.'
const SWITCH_CLASS = 'w-full flex-row-reverse justify-between px-0 py-0'

function parseMinutes(text: string) {
	if (text.trim() === '') return null
	const parsed = updateSettingsRequest.safeParse({ notifyLessonMinutes: Number(text) })
	return parsed.success ? (parsed.data.notifyLessonMinutes ?? null) : null
}

function Row({ icon, text, children }: { icon?: 'spin'; text: string; children?: React.ReactNode }) {
	return (
		<p className="flex items-center gap-2 text-caption text-muted-foreground">
			{icon === 'spin' ? <LoaderCircle size={14} className="shrink-0 animate-spin" aria-hidden /> : null}
			{text}
			{children}
		</p>
	)
}

function useDevice() {
	const [snapshot, setSnapshot] = useState<PushSnapshot | null>(null)
	const [asking, setAsking] = useState<'asking' | 'renewing' | null>(null)
	const [failed, setFailed] = useState(false)
	const [checking, setChecking] = useState(false)
	const mounted = useRef(true)

	const refresh = useCallback(async () => {
		const next = await currentState()
		if (mounted.current) setSnapshot(next)
	}, [])

	useEffect(() => {
		mounted.current = true
		void resync().then(refresh)
		window.addEventListener(PUSH_CHANGED, refresh)
		return () => {
			mounted.current = false
			window.removeEventListener(PUSH_CHANGED, refresh)
		}
	}, [refresh])

	async function checkAgain() {
		setChecking(true)
		setFailed(false)
		await refresh()
		if (mounted.current) setChecking(false)
	}

	async function turnOn(renew: boolean) {
		if (asking !== null) return
		setFailed(false)
		setAsking(renew ? 'renewing' : 'asking')
		const outcome = await subscribe(renew)
		if (!mounted.current) return
		if (outcome === 'failed') setFailed(true)
		await refresh()
		if (mounted.current) setAsking(null)
	}

	async function turnOff() {
		if (asking !== null) return
		setFailed(false)
		await unsubscribe()
		await refresh()
	}

	return { snapshot, asking, failed, checking, checkAgain, turnOn, turnOff }
}

function DeviceCard({ device }: { device: ReturnType<typeof useDevice> }) {
	const { snapshot, asking, failed, checking } = device
	const status = snapshot?.status ?? null
	const label = snapshot?.device ?? ''
	const hint =
		status === 'on'
			? `On for this device (${label}).`
			: status === 'off'
				? `Off on this device (${label}).`
				: status === 'blocked'
					? 'Blocked in this browser.'
					: status === 'not_available'
						? 'Not available in this browser.'
						: status === 'server_off'
							? 'Not set up on the server.'
							: status === 'revoked'
								? `Stopped on this device (${label}).`
								: ''
	const locked = status === null || status === 'blocked' || status === 'not_available' || status === 'server_off'
	const waiting = asking !== null
	const caption = waiting
		? asking === 'renewing'
			? 'Turning notifications on again…'
			: 'Waiting for your answer in the browser…'
		: failed
			? TURN_ON_ERROR
			: 'Saved on this device.'

	return (
		<Panel
			id="settings-notifications-device"
			title="Notifications on this device"
			description="Push notifications reach only the devices where they are turned on. Each browser or phone is turned on by itself."
		>
			<div className="flex flex-col gap-3 px-4 py-3">
				<div className="flex min-w-0 flex-col gap-1">
					<Switch
						label="Push notifications"
						checked={status === 'on'}
						disabled={locked || waiting}
						onToggle={() => void (status === 'on' ? device.turnOff() : device.turnOn(status === 'revoked'))}
						className={SWITCH_CLASS}
					/>
					<p id="settings-notifications-device-hint" className="pr-13 text-caption text-muted-foreground">
						{hint}
					</p>
				</div>
				{status === 'blocked' ? (
					<Banner status="warning" size="compact">
						<p className="col-start-2 row-start-1 min-w-0 text-body">
							Notifications are blocked for this site. Allow them in the browser&apos;s site settings, then check again.
						</p>
						<BannerActions>
							<BannerAction variant="secondary" disabled={checking} onClick={() => void device.checkAgain()}>
								<RefreshCw size={14} aria-hidden />
								Check again
							</BannerAction>
						</BannerActions>
					</Banner>
				) : null}
				{status === 'not_available' ? (
					<Banner status="info" contrast="low" size="compact">
						<p className="col-start-2 row-start-1 min-w-0 text-body">
							This browser cannot show notifications. On iPhone and iPad, add dv-lab to the Home Screen first and open
							it from there.
						</p>
					</Banner>
				) : null}
				{status === 'server_off' ? (
					<Banner status="info" contrast="low" size="compact">
						<p className="col-start-2 row-start-1 min-w-0 text-body">
							Push notifications are not set up on the server. Once they are, turn them on here.
						</p>
						<BannerActions>
							<BannerAction variant="secondary" disabled={checking} onClick={() => void device.checkAgain()}>
								<RefreshCw size={14} aria-hidden />
								Check again
							</BannerAction>
						</BannerActions>
					</Banner>
				) : null}
				{status === 'revoked' ? (
					<Banner status="warning" size="compact">
						<p className="col-start-2 row-start-1 min-w-0 text-body">
							Notifications stopped working on this device. The browser or the system removed the subscription.
						</p>
						<BannerActions>
							<BannerAction variant="secondary" disabled={waiting} onClick={() => void device.turnOn(true)}>
								{asking === 'renewing' ? (
									<>
										<LoaderCircle size={14} className="animate-spin" aria-hidden />
										Turning on…
									</>
								) : (
									'Turn on again'
								)}
							</BannerAction>
						</BannerActions>
					</Banner>
				) : null}
			</div>
			{failed && !waiting ? (
				<p role="alert" className="px-4 pb-4 text-caption text-destructive">
					{caption}
				</p>
			) : (
				<div className="px-4 pb-4">
					<Row icon={waiting ? 'spin' : undefined} text={caption} />
				</div>
			)}
		</Panel>
	)
}

function EventsCard({
	settings,
	deviceOn,
	deviceKnown,
	onSaved,
}: {
	settings: TeacherSettings | null
	deviceOn: boolean
	deviceKnown: boolean
	onSaved: (fields: Partial<NotifyFields>) => void
}) {
	const toast = useToast()
	const ready = settings !== null
	const [draft, setDraft] = useState<string | null>(null)
	const text = draft ?? (settings === null ? '' : String(settings.notifyLessonMinutes))
	const [error, setError] = useState<string | null>(null)
	const [saveFailed, setSaveFailed] = useState(false)
	const [saving, setSaving] = useState(false)
	const inflight = useRef(false)
	const revert = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (revert.current) clearTimeout(revert.current)
		}
	}, [])

	function cancelRevert() {
		if (revert.current) clearTimeout(revert.current)
		revert.current = null
	}

	function putBack() {
		setDraft(null)
		setError(null)
	}

	async function save(fields: Partial<NotifyFields>): Promise<boolean> {
		if (inflight.current) return false
		inflight.current = true
		setSaving(true)
		setSaveFailed(false)
		try {
			const result = await apiRequest<SettingsResponse>('PATCH', '/settings', fields)
			if (!result.ok) {
				setSaveFailed(true)
				return false
			}
			const { notifyLessonSoon, notifyLessonMinutes, notifyPaysSoon } = result.data.settings
			onSaved({ notifyLessonSoon, notifyLessonMinutes, notifyPaysSoon })
			return true
		} finally {
			inflight.current = false
			setSaving(false)
		}
	}

	async function commit(leaving: boolean) {
		if (settings === null || inflight.current) return
		const minutes = parseMinutes(text)
		if (minutes === null) {
			setError(RANGE_ERROR)
			if (leaving) {
				cancelRevert()
				revert.current = setTimeout(putBack, REVERT_DELAY_MS)
			}
			return
		}
		setError(null)
		if (minutes === settings.notifyLessonMinutes) {
			setDraft(null)
			return
		}
		if (await save({ notifyLessonMinutes: minutes })) {
			setDraft(null)
			toast.show({ title: 'Saved', description: `Lesson reminder: ${minutes} minutes before.` })
		} else putBack()
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key !== 'Enter') return
		event.preventDefault()
		void commit(false)
	}

	return (
		<Panel
			id="settings-notifications-events"
			title="What to notify about"
			description="Two kinds of notification. The choice is kept for every device."
		>
			{saveFailed ? (
				<div className="px-4 pt-2">
					<Banner status="error" size="compact">
						<p className="col-start-2 row-start-1 min-w-0 text-body">Could not save the setting. Try again.</p>
					</Banner>
				</div>
			) : null}
			<div className="flex flex-col gap-4 px-4 py-3">
				{deviceKnown && !deviceOn ? (
					<Banner status="default" contrast="low" size="compact">
						<p className="col-start-2 row-start-1 min-w-0 text-body">
							Turn on notifications on this device to receive these.
						</p>
					</Banner>
				) : null}
				<div className="flex min-w-0 flex-col gap-1">
					<Switch
						label="A lesson starts soon"
						checked={settings?.notifyLessonSoon ?? false}
						disabled={!ready || saving}
						onToggle={() => void (settings && save({ notifyLessonSoon: !settings.notifyLessonSoon }))}
						className={SWITCH_CLASS}
					/>
					<p className="pr-13 text-caption text-muted-foreground">
						A reminder before each lesson, in the main time zone. A cancelled or moved lesson is not reminded.
					</p>
				</div>
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
					<div className="flex min-w-0 flex-col gap-1">
						<label htmlFor="settings-notify-minutes" className="text-body text-foreground">
							Minutes before the lesson
						</label>
						<p id="settings-notify-minutes-hint" className="text-caption text-muted-foreground">
							Whole number from {NOTIFY_LESSON_MINUTES_MIN} to {NOTIFY_LESSON_MINUTES_MAX}. New accounts start at 30.
						</p>
					</div>
					<span className="inline-flex shrink-0 items-center gap-2">
						<Input
							id="settings-notify-minutes"
							inputMode="numeric"
							autoComplete="off"
							value={text}
							disabled={!ready || saving}
							aria-busy={saving}
							aria-invalid={error ? true : undefined}
							aria-describedby={error ? 'settings-notify-minutes-error' : 'settings-notify-minutes-hint'}
							className="w-24 shrink-0 text-right tabular-nums"
							onChange={(event) => {
								cancelRevert()
								setError(null)
								setDraft(event.target.value)
							}}
							onFocus={cancelRevert}
							onBlur={() => void commit(true)}
							onKeyDown={onKeyDown}
						/>
						<span className="text-body text-muted-foreground">min</span>
					</span>
				</div>
				{error ? (
					<p id="settings-notify-minutes-error" role="alert" className="-mt-2 text-caption text-destructive">
						{error}
					</p>
				) : null}
				<div className="flex min-w-0 flex-col gap-1">
					<Switch
						label="A student is about to pay"
						checked={settings?.notifyPaysSoon ?? false}
						disabled={!ready || saving}
						onToggle={() => void (settings && save({ notifyPaysSoon: !settings.notifyPaysSoon }))}
						className={SWITCH_CLASS}
					/>
					<p className="pr-13 text-caption text-muted-foreground">
						Once, when a student reaches the Pays soon threshold
						{settings
							? ` (${settings.paysSoonLessons} ${settings.paysSoonLessons === 1 ? 'lesson' : 'lessons'} left or fewer now, see Payments above)`
							: ''}
						. Not again until the balance has changed.
					</p>
				</div>
			</div>
			<p className="px-4 pb-4 text-caption text-muted-foreground">Saved to your account.</p>
		</Panel>
	)
}

export function NotificationsCards({
	settings,
	onSaved,
}: {
	settings: TeacherSettings | null
	onSaved: (fields: Partial<NotifyFields>) => void
}) {
	const device = useDevice()
	return (
		<>
			<DeviceCard device={device} />
			<EventsCard
				settings={settings}
				deviceOn={device.snapshot?.status === 'on'}
				deviceKnown={device.snapshot !== null}
				onSaved={onSaved}
			/>
		</>
	)
}
