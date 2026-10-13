'use client'

import { useState } from 'react'

import { RefreshCw, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import type { CalendarEventSuggestion } from '@dv-lab/contracts'

import type { StudentsState } from './use-lesson-students'

export type AssignBusy = { kind: 'assign'; studentId: string } | { kind: 'ignore' } | null
export type AssignFailure = 'assign' | 'ignore' | null

const nameCollator = new Intl.Collator('en', { sensitivity: 'base' })
const ASSIGN_FAILURE = 'Could not assign this event. Try again.'
const IGNORE_FAILURE = 'Could not ignore this suggestion. Try again.'

export function scopeCaption(seriesMember: boolean): string {
	return seriesMember ? 'Applies to this series.' : 'Applies to this event.'
}

export function SuggestionBox({
	name,
	scope,
	busy,
	failure,
	changed,
	onAssign,
	onIgnore,
	onRefresh,
}: {
	name: string
	scope: CalendarEventSuggestion['scope']
	busy: AssignBusy
	failure: AssignFailure
	changed: boolean
	onAssign: () => void
	onIgnore: () => void
	onRefresh: () => void
}) {
	if (changed)
		return (
			<div
				role="group"
				aria-label="Name match"
				data-slot="event-suggestion"
				className="flex items-center gap-3 rounded-lg p-3 ring-1 ring-border ring-inset"
			>
				<p className="min-w-0 flex-1 text-body">
					This event changed in Google Calendar. Refresh before choosing again.
				</p>
				<Button type="button" variant="ghost" size="compact" leadingIcon={RefreshCw} onClick={onRefresh}>
					Refresh
				</Button>
			</div>
		)
	return (
		<div
			role="group"
			aria-label="Name match"
			aria-busy={busy !== null || undefined}
			data-slot="event-suggestion"
			className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-3 ring-1 ring-border ring-inset"
		>
			<div className="flex min-w-48 flex-1 flex-col gap-1">
				<p className="text-body wrap-anywhere">Looks like {name}&apos;s lesson.</p>
				<p className="text-caption text-muted-foreground">{scopeCaption(scope === 'series')}</p>
				{failure !== null ? (
					<p role="alert" className="text-caption text-destructive">
						{failure === 'assign' ? ASSIGN_FAILURE : IGNORE_FAILURE}
					</p>
				) : null}
			</div>
			<div className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:*:flex-1">
				<Button
					type="button"
					variant="secondary"
					size="compact"
					aria-label={busy?.kind === 'assign' ? undefined : `Assign to ${name}`}
					loading={busy?.kind === 'assign'}
					disabled={busy !== null}
					onClick={onAssign}
				>
					{busy?.kind === 'assign' ? 'Assigning…' : 'Assign'}
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="compact"
					loading={busy?.kind === 'ignore'}
					disabled={busy !== null}
					onClick={onIgnore}
				>
					{busy?.kind === 'ignore' ? 'Ignoring…' : 'Ignore'}
				</Button>
			</div>
		</div>
	)
}

export function ManualAssign({
	students,
	seriesMember,
	busy,
	failure,
	disabled,
	onPick,
}: {
	students: StudentsState
	seriesMember: boolean
	busy: AssignBusy
	failure: AssignFailure
	disabled: boolean
	onPick: (studentId: string) => void
}) {
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const needle = query.trim().toLowerCase()
	const rows =
		students.kind === 'ready'
			? students.rows
					.toSorted((left, right) => nameCollator.compare(left.displayName, right.displayName))
					.filter((row) => needle === '' || row.displayName.toLowerCase().includes(needle))
			: []
	const assigning = busy?.kind === 'assign' ? busy.studentId : null
	const empty =
		students.kind === 'loading'
			? 'Loading students…'
			: students.kind === 'error'
				? 'Could not load students.'
				: rows.length === 0
					? 'No students found.'
					: null
	return (
		<div data-slot="event-manual-assign" className="flex items-center gap-3">
			<UserRound size={16} aria-hidden className="shrink-0 text-muted-foreground" />
			<span className="min-w-0 flex-1 text-body text-muted-foreground">Not a lesson</span>
			<Popover
				open={open}
				onOpenChange={(next) => {
					if (assigning === null) setOpen(next)
					if (!next) setQuery('')
				}}
			>
				<PopoverTrigger render={<Button type="button" variant="ghost" size="compact" disabled={disabled} />}>
					Assign…
				</PopoverTrigger>
				<PopoverContent align="end" className="w-[260px] gap-2 p-2">
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search students"
						aria-label="Search students"
						autoComplete="off"
						autoFocus
					/>
					<ul role="listbox" aria-label="Students" className="scroll-fade flex max-h-56 flex-col overflow-y-auto">
						{rows.map((row) => (
							<li key={row.id} role="presentation">
								<button
									type="button"
									role="option"
									aria-selected={assigning === row.id}
									disabled={assigning !== null}
									onClick={() => onPick(row.id)}
									className={cn(
										'flex h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 text-left text-body outline-none',
										'hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring',
										assigning !== null && assigning !== row.id && 'opacity-50'
									)}
								>
									<span className="min-w-0 flex-1 truncate">{row.displayName}</span>
									{assigning === row.id ? <span className="text-caption text-muted-foreground">Assigning…</span> : null}
								</button>
							</li>
						))}
						{empty !== null ? <li className="px-2 py-1 text-caption text-muted-foreground">{empty}</li> : null}
					</ul>
					<p
						role={failure === 'assign' ? 'alert' : undefined}
						className={cn('text-caption', failure === 'assign' ? 'text-destructive' : 'text-muted-foreground')}
					>
						{failure === 'assign' ? ASSIGN_FAILURE : scopeCaption(seriesMember)}
					</p>
				</PopoverContent>
			</Popover>
		</div>
	)
}
