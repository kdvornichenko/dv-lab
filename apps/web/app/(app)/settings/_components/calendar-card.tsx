'use client'

import { useRef, useState } from 'react'

import { LoaderCircle } from 'lucide-react'

import { CalendarRecovery } from '@/components/app/calendar-command-notice'
import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { useGoogleConnection } from '@/components/app/google-calendar-state'
import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'

import type { GoogleConnectionSnapshot } from '@dv-lab/contracts'

type ConnectionAction = GoogleConnectionSnapshot['allowedActions'][number]
type Confirmation = { action: 'disconnect' | 'confirm_revoked'; generation: number }

const LABELS: Record<ConnectionAction, string> = {
	connect: 'Connect Google Calendar',
	reconnect: 'Reconnect',
	disconnect: 'Disconnect',
	retry_disconnect: 'Retry disconnect',
	confirm_revoked: 'Confirm access removed',
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

function ConnectionSummary({ snapshot }: { snapshot: GoogleConnectionSnapshot }) {
	const disconnected = snapshot.state === 'not_connected' && snapshot.disconnectResolution !== 'none'
	return (
		<div className="flex min-w-0 flex-col gap-2 text-body" role="status">
			<p>{disconnected ? DISCONNECTED : STATUS[snapshot.state]}</p>
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
				<CalendarRecovery />
			</div>
		</Panel>
	)
}

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
		if (action === 'disconnect' || action === 'confirm_revoked') {
			trigger.current = button
			setConfirmation({ action, generation: snapshot.generation })
		} else void state.act(action, snapshot.generation)
	}

	return (
		<div className="flex max-w-180 flex-col gap-4">
			<Panel id="settings-calendar-connection" title="Connection">
				<div
					className="flex flex-col gap-4 px-4 pt-1 pb-4"
					aria-busy={state.pending !== null || state.view.status === 'loading'}
				>
					{state.view.status === 'loading' ? (
						<p role="status" className="flex items-center gap-2 text-body text-muted-foreground">
							<LoaderCircle size={16} className="animate-spin" aria-hidden />
							Loading Google Calendar status…
						</p>
					) : null}
					{state.view.status === 'failed' ? (
						<p role="alert" className="text-body text-destructive">
							Could not load Google Calendar status.
						</p>
					) : null}
					{snapshot !== null ? <ConnectionSummary snapshot={snapshot} /> : null}
					{state.notice !== null ? (
						<p role="alert" className="text-body text-destructive">
							{state.notice}
						</p>
					) : null}
					<div className="flex flex-wrap items-center gap-2">
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
							disabled={state.pending !== null || state.view.status === 'loading'}
							onClick={() => void state.refresh()}
						>
							Refresh status
						</Button>
					</div>
				</div>
			</Panel>
			{snapshot !== null ? <SyncCard snapshot={snapshot} /> : null}
			{confirmation !== null ? (
				<ConnectionDialog
					confirmation={confirmation}
					onClose={close}
					onConfirm={() => state.act(confirmation.action, confirmation.generation)}
				/>
			) : null}
		</div>
	)
}
