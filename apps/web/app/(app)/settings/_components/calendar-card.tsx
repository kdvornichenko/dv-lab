'use client'

import { useRef, useState } from 'react'

import { LoaderCircle } from 'lucide-react'

import { CalendarRecovery } from '@/components/app/calendar-command-notice'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { useGoogleConnection } from '@/components/app/google-calendar-state'
import { Panel } from '@/components/app/layout-parts'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import type { GoogleConnectionSnapshot } from '@dv-lab/contracts'

type ConnectionAction = GoogleConnectionSnapshot['allowedActions'][number]
type Confirmation = { action: 'disconnect' | 'confirm_revoked' | 'switch'; generation: number; connected: boolean }

const LABELS: Record<ConnectionAction, string> = {
	connect: 'Connect Google Calendar',
	reconnect: 'Reconnect',
	disconnect: 'Disconnect',
	retry_disconnect: 'Retry disconnect',
	confirm_revoked: 'Confirm access removed',
	switch: 'Connect another Google account',
}
const STATUS: Record<GoogleConnectionSnapshot['state'], string> = {
	not_connected:
		'Connect your primary Google Calendar to view events and manage lessons. Calendar changes require a working Google connection.',
	connected: 'Google Calendar connected',
	reconnect_required:
		'Google access expired or was revoked. Reconnect to use the calendar. The last checked view is read-only.',
	permission_required: 'Access to the connected calendar is unavailable. Reconnect to restore calendar access.',
	disconnecting: 'Disconnecting Google Calendar…',
	disconnect_failed: 'Calendar changes are stopped. Google access removal is not confirmed.',
}
const DISCONNECTED =
	'Google Calendar disconnected. Your local history, Google events and unfinished request records were kept.'
const DISCONNECT_ERROR = 'Could not confirm the disconnect request. Refresh the connection status before trying again.'
const SWITCH_ERROR = 'Could not switch the Google account. Refresh the connection status before trying again.'

function ConnectionSummary({ snapshot }: { snapshot: GoogleConnectionSnapshot }) {
	const disconnected = snapshot.state === 'not_connected' && snapshot.disconnectResolution !== 'none'
	return (
		<div className="flex min-w-0 flex-col gap-2 text-body" role="status">
			<p className="flex items-center gap-2">
				{snapshot.state === 'disconnecting' ? (
					<LoaderCircle size={16} className="shrink-0 animate-spin" aria-hidden />
				) : null}
				{disconnected ? DISCONNECTED : STATUS[snapshot.state]}
			</p>
			{snapshot.disconnectResolution === 'operator_confirmed' && disconnected ? (
				<p>Disconnected after your confirmation that Google access was removed.</p>
			) : null}
			{snapshot.calendar !== null ? (
				<div className="flex min-w-0 flex-col gap-1 break-words text-muted-foreground">
					<p>{snapshot.calendar.label}</p>
					<p>{snapshot.calendar.timeZone}</p>
				</div>
			) : null}
			{snapshot.state === 'disconnecting' ? (
				<p className="text-muted-foreground">
					Calendar changes are stopped. Waiting for Google access to be revoked and live connection credentials to be
					cleared.
				</p>
			) : null}
			{snapshot.allowedActions.includes('confirm_revoked') ? (
				<p className="text-muted-foreground">
					If you removed dv-lab&apos;s access in your Google Account, confirm it here.
				</p>
			) : null}
		</div>
	)
}

function ConnectionSkeleton() {
	return (
		<div className="flex flex-col gap-3" role="status" aria-label="Loading Google Calendar status">
			<Skeleton className="h-3 w-65 max-w-full" />
			<Skeleton className="h-3 w-95 max-w-full" />
			<Skeleton className="h-3 w-37 max-w-full" />
			<div className="mt-1 flex gap-2">
				<Skeleton className="h-9 w-37 max-w-full" />
				<Skeleton className="h-9 w-27 max-w-full" />
			</div>
		</div>
	)
}

function SwitchDialog({
	connected,
	onConfirm,
	onClose,
}: {
	connected: boolean
	onConfirm: () => Promise<boolean>
	onClose: () => void
}) {
	return (
		<ConfirmDialog
			title="Connect another Google account?"
			body={
				connected
					? 'Calendar changes will stop. Google access for the current account will be revoked and live connection credentials cleared. Its events and your local history stay as a read-only archive. Then you sign in with the other account; its calendar starts empty here and lessons are not created in it by themselves.'
					: 'Its events and your local history stay as a read-only archive. Sign in with the other Google account to use its calendar. It starts empty here, and lessons are not created in it by themselves.'
			}
			cancelLabel={connected ? 'Keep connected' : 'Back'}
			confirmLabel={connected ? 'Disconnect and continue' : 'Continue to Google'}
			pendingLabel={connected ? 'Disconnecting…' : 'Opening Google…'}
			tone="primary"
			failureText={SWITCH_ERROR}
			reserveFailure
			onConfirm={onConfirm}
			onClose={onClose}
		/>
	)
}

function ConnectionDialog({
	confirmation,
	onConfirm,
	onClose,
}: {
	confirmation: Confirmation
	onConfirm: () => Promise<boolean>
	onClose: () => void
}) {
	const manual = confirmation.action === 'confirm_revoked'
	return (
		<ConfirmDialog
			title={manual ? 'Confirm Google access was removed?' : 'Disconnect Google Calendar?'}
			body={
				manual
					? "Confirm only after you have removed dv-lab's access in your Google Account. This records your confirmation and clears stored connection credentials. Your calendar events and local history stay."
					: 'Calendar changes will stop. Google access will be revoked and live connection credentials cleared. Your local history, Google events and unfinished request records will stay. Reconnecting the same calendar checks earlier requests before you can make new changes.'
			}
			cancelLabel={manual ? 'Back' : 'Keep connected'}
			confirmLabel={manual ? 'Confirm access removed' : 'Disconnect'}
			pendingLabel={manual ? 'Recording your confirmation…' : 'Disconnecting…'}
			tone="primary"
			failureText={DISCONNECT_ERROR}
			reserveFailure
			onConfirm={onConfirm}
			onClose={onClose}
		/>
	)
}

function SyncCard({ snapshot }: { snapshot: GoogleConnectionSnapshot }) {
	return (
		<Panel id="settings-calendar-sync" title="Sync" description="Calendar requests and their confirmation status.">
			<div className="flex flex-col gap-2 px-4 pt-1 pb-4 text-body" role="status">
				<p>Unconfirmed changes: {snapshot.pendingCommandCount === 0 ? 'None' : snapshot.pendingCommandCount}</p>
				{snapshot.pendingCommandCount > 0 && snapshot.state !== 'connected' ? (
					<p className="text-muted-foreground">
						Calendar requests are paused. Unconfirmed changes are not shown as saved.
					</p>
				) : null}
				<CalendarRecovery emptyText={PAUSED[snapshot.state]} />
			</div>
		</Panel>
	)
}

const PAUSED: Partial<Record<GoogleConnectionSnapshot['state'], string>> = {
	disconnecting: 'Calendar requests are paused while Google access is being removed.',
	disconnect_failed: 'Calendar requests are paused until the removal of Google access is confirmed.',
}

const never = new Promise<boolean>(() => undefined)

export function CalendarCard({ callbackOutcome }: { callbackOutcome: string | null }) {
	const state = useGoogleConnection(callbackOutcome)
	const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
	const trigger = useRef<HTMLButtonElement | null>(null)
	const refreshButton = useRef<HTMLButtonElement | null>(null)
	const snapshot = state.view.snapshot

	function close() {
		setConfirmation(null)
		requestAnimationFrame(() => {
			const target = trigger.current
			if (target?.isConnected && !target.disabled) target.focus()
			else refreshButton.current?.focus()
		})
	}

	function choose(action: ConnectionAction, button: HTMLButtonElement) {
		if (snapshot === null || state.pending !== null) return
		if (action === 'disconnect' || action === 'confirm_revoked' || action === 'switch') {
			trigger.current = button
			setConfirmation({ action, generation: snapshot.generation, connected: snapshot.state !== 'not_connected' })
		} else void state.act(action, snapshot.generation)
	}

	async function switchAccount(generation: number) {
		const outcome = await state.switchAccount(generation)
		if (outcome === 'navigating') return never
		return outcome === 'connect_failed'
	}

	return (
		<div className="flex max-w-180 flex-col gap-4">
			<Panel id="settings-calendar-connection" title="Connection">
				<div
					className="flex min-h-50 flex-col gap-4 px-4 pt-1 pb-4"
					aria-busy={state.pending !== null || state.view.status === 'loading'}
				>
					{state.view.status === 'loading' ? <ConnectionSkeleton /> : null}
					{state.view.status === 'failed' ? (
						<Banner status="error">
							<BannerTitle>Could not load Google Calendar status.</BannerTitle>
						</Banner>
					) : null}
					{state.notice !== null && state.view.status !== 'failed' ? (
						<Banner status={state.notice.status}>
							<BannerTitle>{state.notice.text}</BannerTitle>
						</Banner>
					) : null}
					{snapshot !== null ? <ConnectionSummary snapshot={snapshot} /> : null}
					{state.view.status !== 'loading' ? (
						<div className="mt-auto flex flex-wrap items-center gap-2">
							{snapshot?.allowedActions.map((action) => (
								<Button
									key={action}
									type="button"
									variant={action === 'connect' || action === 'reconnect' ? 'primary' : 'secondary'}
									disabled={state.pending !== null}
									onClick={(event) => choose(action, event.currentTarget)}
								>
									{LABELS[action]}
								</Button>
							))}
							<Button
								ref={refreshButton}
								type="button"
								variant="ghost"
								disabled={state.pending !== null || snapshot?.state === 'disconnecting'}
								onClick={() => void state.refresh()}
							>
								Refresh status
							</Button>
						</div>
					) : null}
				</div>
			</Panel>
			{snapshot !== null ? <SyncCard snapshot={snapshot} /> : null}
			{confirmation?.action === 'switch' ? (
				<SwitchDialog
					connected={confirmation.connected}
					onClose={close}
					onConfirm={() => switchAccount(confirmation.generation)}
				/>
			) : confirmation !== null ? (
				<ConnectionDialog
					confirmation={confirmation}
					onClose={close}
					onConfirm={() => state.act(confirmation.action, confirmation.generation)}
				/>
			) : null}
		</div>
	)
}
