'use client'

import { useState } from 'react'

import Link from 'next/link'

import { Button } from '@/components/ui/button'

import type { CalendarCommandSnapshot } from '@dv-lab/contracts'

import { useCalendarCommands } from './calendar-command-provider'
import type { CommandEntry } from './calendar-command-store'

const OPERATIONS: Record<CalendarCommandSnapshot['operation'], string> = {
	create: 'Create lesson',
	move: 'Move lesson',
	cancel: 'Cancel lesson',
	restore: 'Restore lesson',
	move_series: 'Move series',
	end_series: 'End series',
	event_create: 'Create event',
	event_update: 'Change event',
	event_delete: 'Delete event',
	assign: 'Assign lesson',
}

function commandCopy(entry: CommandEntry): string {
	if (entry.status === 'missing')
		return 'This request has not been found yet. Check again before sending another change.'
	const command = entry.command
	if (command?.state === 'applied' || command?.state === 'projection_pending')
		return 'Google Calendar confirmed the change. Updating the displayed calendar…'
	if (entry.status === 'unavailable') return 'Could not load Google Calendar status.'
	if (command === null || command.state === 'pending' || command.state === 'dispatching')
		return 'Waiting for Google Calendar to confirm this change…'
	if (command.state === 'outcome_unknown')
		return 'Google Calendar may have received this change. Its result is not confirmed. Check the status before making another change.'
	if (command.state === 'failed') return 'This change was not applied. Refresh the calendar before trying again.'
	if (command.effect === 'partial')
		return command.nextAction === 'resume_recovery' && entry.settling !== true
			? 'Only part of this calendar change is confirmed. Resume recovery to check the remaining steps.'
			: 'Only part of this calendar change is confirmed. Checking the remaining steps…'
	return command.nextAction === 'resume_recovery'
		? 'Earlier calendar requests need recovery before you can make new changes.'
		: 'Checking earlier calendar requests before allowing new changes…'
}

export function CalendarCommandNotice({ entry, onViewSchedule }: { entry: CommandEntry; onViewSchedule?: () => void }) {
	const { store } = useCalendarCommands()
	const [busy, setBusy] = useState(false)
	const command = entry.command
	const resume =
		entry.settling !== true &&
		command?.nextAction === 'resume_recovery' &&
		(command.state === 'partial_recovery' || command.state === 'recovery_required')
	const terminal = command?.state === 'failed'
	async function check() {
		if (busy) return
		setBusy(true)
		try {
			await store.retryStatus(entry.requestId)
		} finally {
			setBusy(false)
		}
	}
	async function recover() {
		if (busy) return
		setBusy(true)
		try {
			await store.resume(entry.requestId)
		} finally {
			setBusy(false)
		}
	}
	return (
		<div
			className="flex flex-col gap-2 rounded-xl bg-hover p-4 text-body"
			data-slot="calendar-command"
			data-command-id={entry.commandId ?? undefined}
		>
			<p role="status">{commandCopy(entry)}</p>
			{!terminal ? (
				<div className="flex flex-wrap gap-2">
					{resume ? (
						<Button variant="secondary" size="compact" loading={busy} onClick={() => void recover()}>
							{busy ? 'Checking this calendar request…' : 'Resume recovery'}
						</Button>
					) : (
						<Button variant="secondary" size="compact" loading={busy} onClick={() => void check()}>
							{entry.status === 'unavailable' ? 'Refresh status' : 'Check status'}
						</Button>
					)}
					{onViewSchedule ? (
						<Button variant="ghost" size="compact" onClick={onViewSchedule}>
							View schedule
						</Button>
					) : null}
				</div>
			) : null}
		</div>
	)
}

export function CalendarRecovery({
	showEmpty = true,
	emptyText = 'No unresolved calendar requests.',
}: {
	showEmpty?: boolean
	emptyText?: string
}) {
	const { view, store } = useCalendarCommands()
	const entries = view.entries.filter((entry) => entry.command?.state !== 'failed')
	const empty = view.status === 'ready' && entries.length === 0 && view.connection?.pendingCommandCount === 0
	if (empty && !showEmpty) return null
	return (
		<section
			className="flex flex-col gap-3 text-body"
			data-slot="calendar-recovery"
			aria-label="Unresolved calendar requests"
		>
			{view.status !== 'ready' ? (
				<div className="flex flex-wrap items-center gap-2">
					<p role="status">
						{view.status === 'loading' ? 'Loading calendar requests…' : 'Could not load calendar requests.'}
					</p>
					<Button variant="secondary" size="compact" onClick={() => void store.refresh()}>
						Refresh status
					</Button>
				</div>
			) : null}
			{empty ? <p className="text-muted-foreground">{emptyText}</p> : null}
			{entries.map((entry) => (
				<div key={entry.requestId} className="space-y-2">
					{entry.command ? <h3 className="text-body font-semibold">{OPERATIONS[entry.command.operation]}</h3> : null}
					<CalendarCommandNotice entry={entry} />
				</div>
			))}
		</section>
	)
}

export const DISCONNECT_COPY = {
	disconnecting: 'Google Calendar is disconnecting. Calendar changes are paused until it finishes.',
	disconnect_failed:
		'Google Calendar was not fully disconnected. Finish it in calendar settings to make calendar changes.',
} as const

export function CalendarReconnectLink({ text }: { text?: string }) {
	return (
		<div className="space-y-2 text-body">
			<p>{text ?? 'Keep this tab open to preserve your unsaved form. Reconnect in another tab, then return here.'}</p>
			<Button
				variant="secondary"
				nativeButton={false}
				render={<Link href="/settings?tab=calendar" target="_blank" rel="noopener noreferrer" />}
			>
				Open calendar settings
			</Button>
		</div>
	)
}

export function commandUnconfirmed(entry: CommandEntry | null): boolean {
	const command = entry?.command ?? null
	if (entry === null || command?.state === 'failed') return false
	if (command?.state === 'applied' || command?.state === 'projection_pending') return false
	if (entry.status === 'missing' || entry.status === 'unavailable') return true
	if (command === null || entry.settling === true) return false
	return command.state === 'outcome_unknown' || command.nextAction === 'resume_recovery'
}

export function CalendarFormStatus({
	entry,
	blocked,
	connectionShown = false,
	onViewSchedule,
}: {
	entry: CommandEntry | null
	blocked: boolean
	connectionShown?: boolean
	onViewSchedule: () => void
}) {
	const { view } = useCalendarCommands()
	if (entry !== null) return <CalendarCommandNotice entry={entry} onViewSchedule={onViewSchedule} />
	if (!blocked) return null
	const state = view.connection?.state
	if (state === 'disconnecting' || state === 'disconnect_failed')
		return <CalendarReconnectLink text={DISCONNECT_COPY[state]} />
	if (view.connection?.allowedActions.some((action) => action === 'connect' || action === 'reconnect'))
		return connectionShown ? null : <CalendarReconnectLink />
	return <CalendarRecovery />
}
