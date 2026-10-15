'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

import { CircleAlert, LoaderCircle } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { apiRequest } from '@/lib/api-client'
import { cn } from '@/lib/utils'

import {
	googleCalendarList,
	type ChooseGoogleCalendarRequest,
	type GoogleCalendarList,
	type GoogleConnectionSnapshot,
} from '@dv-lab/contracts'

type Entry = GoogleCalendarList['calendars'][number]
type ListView = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; calendars: Entry[] }
type Choice = { id: string; label: string }

const FIELD_ID = 'settings-calendar-choice'
const HELPER = 'Events are added to this calendar.'
const SWITCH_ERROR = 'Could not switch the calendar. Refresh the connection status before trying again.'

function Spinner({ size, className }: { size?: number; className?: string }) {
	return <LoaderCircle size={size ?? 16} className={cn('animate-spin', className)} aria-hidden />
}

function useCalendars(active: boolean, generation: number) {
	const [loaded, setLoaded] = useState<{ key: string; view: ListView } | null>(null)
	const [attempt, setAttempt] = useState(0)
	const key = `${generation}:${attempt}`
	useEffect(() => {
		if (!active) return
		let live = true
		void apiRequest<unknown>('GET', '/google/calendars').then((result) => {
			if (!live) return
			const parsed = result.ok ? googleCalendarList.safeParse(result.data) : null
			setLoaded({
				key,
				view: parsed?.success ? { kind: 'ready', calendars: parsed.data.calendars } : { kind: 'failed' },
			})
		})
		return () => {
			live = false
		}
	}, [active, key])
	const retry = useCallback(() => setAttempt((value) => value + 1), [])
	const view: ListView = loaded !== null && loaded.key === key ? loaded.view : { kind: 'loading' }
	return { view, retry }
}

function Field({ children }: { children: ReactNode }) {
	return (
		<div data-slot="calendar-choice" className="flex min-w-0 flex-col gap-1">
			{children}
		</div>
	)
}

function Label({ muted }: { muted: boolean }) {
	return (
		<label htmlFor={FIELD_ID} className={cn('text-body text-muted-foreground', muted && 'opacity-50')}>
			Calendar
		</label>
	)
}

function Helper({ muted }: { muted: boolean }) {
	return <p className={cn('text-caption text-muted-foreground', muted && 'opacity-50')}>{HELPER}</p>
}

const TRIGGER = 'w-full max-w-90 min-w-0 pointer-coarse:text-[16px]'

export function CalendarChoice({
	snapshot,
	busy,
	onChanged,
}: {
	snapshot: GoogleConnectionSnapshot
	busy: boolean
	onChanged: () => Promise<unknown>
}) {
	const calendar = snapshot.calendar
	const connected = snapshot.state === 'connected'
	const { view, retry } = useCalendars(connected && calendar !== null, snapshot.generation)
	const [choice, setChoice] = useState<Choice | null>(null)
	if (calendar === null) return null

	if (!connected) {
		return (
			<Field>
				<Label muted />
				<Select value="current" disabled>
					<SelectTrigger id={FIELD_ID} className={TRIGGER} placeholder={calendar.label} />
					<SelectContent>
						<SelectItem index={0} value="current">
							{calendar.label}
						</SelectItem>
					</SelectContent>
				</Select>
				<Helper muted />
			</Field>
		)
	}

	if (view.kind === 'loading') {
		return (
			<Field>
				<Label muted={false} />
				<Select value="" disabled>
					<SelectTrigger
						id={FIELD_ID}
						className={TRIGGER}
						icon={Spinner}
						placeholder="Loading calendars…"
						aria-busy="true"
					/>
				</Select>
			</Field>
		)
	}

	if (view.kind === 'failed') {
		return (
			<Field>
				<Label muted={false} />
				<div id={FIELD_ID} className="flex min-h-9 flex-wrap items-center gap-2">
					<span role="alert" className="flex items-center gap-2 text-body text-destructive">
						<CircleAlert size={16} className="shrink-0" aria-hidden />
						Could not load calendars.
					</span>
					<Button type="button" variant="secondary" size="compact" onClick={retry}>
						Retry
					</Button>
				</div>
			</Field>
		)
	}

	const calendars = view.calendars
	if (calendars.length === 0) {
		return (
			<Field>
				<Label muted={false} />
				<p id={FIELD_ID} className="flex min-h-9 items-center text-body text-muted-foreground">
					No calendar in this account can be changed.
				</p>
			</Field>
		)
	}

	if (calendars.length === 1) {
		return (
			<Field>
				<Label muted={false} />
				<p id={FIELD_ID} className="flex min-h-9 items-center text-body">
					{calendars[0]!.label}
				</p>
				<Helper muted={false} />
			</Field>
		)
	}

	const current = calendars.find((entry) => entry.current) ?? null

	async function change(next: Choice, generation: number): Promise<boolean> {
		const body: ChooseGoogleCalendarRequest = {
			requestId: crypto.randomUUID(),
			calendarId: next.id,
			expectedGeneration: generation,
		}
		const result = await apiRequest<unknown>('POST', '/google/calendar', body)
		if (!result.ok) return false
		await onChanged()
		return true
	}

	return (
		<Field>
			<Label muted={false} />
			<Select
				value={current?.id ?? ''}
				disabled={busy}
				onValueChange={(id) => {
					const picked = calendars.find((entry) => entry.id === id)
					if (picked !== undefined && !picked.current) setChoice({ id: picked.id, label: picked.label })
				}}
			>
				<SelectTrigger id={FIELD_ID} className={TRIGGER} placeholder={calendar.label} />
				<SelectContent>
					{calendars.map((entry, index) => (
						<SelectItem key={entry.id} index={index} value={entry.id}>
							{entry.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Helper muted={false} />
			{choice !== null ? (
				<ConfirmDialog
					title="Use another calendar?"
					body={`New and changed events go to ${choice.label}. Events already in the schedule from the previous calendar stay as read-only history. Lessons are not copied to ${choice.label}.`}
					cancelLabel={`Keep ${current?.label ?? calendar.label}`}
					confirmLabel={`Use ${choice.label}`}
					pendingLabel="Switching…"
					tone="primary"
					failureText={SWITCH_ERROR}
					failureLine
					onConfirm={() => change(choice, snapshot.generation)}
					onClose={() => setChoice(null)}
				/>
			) : null}
		</Field>
	)
}
