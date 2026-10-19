'use client'

import { RefreshCw, UserRound } from 'lucide-react'

import { SearchSelect } from '@/components/app/search-select'
import { Button } from '@/components/ui/button'
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
				<Button type="button" variant="secondary" size="compact" leadingIcon={RefreshCw} onClick={onRefresh}>
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
			<div className="flex shrink-0 items-center gap-2 max-sm:ml-auto">
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
					variant="secondary"
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
	const options =
		students.kind === 'ready'
			? students.rows
					.toSorted((left, right) => nameCollator.compare(left.displayName, right.displayName))
					.map((row) => ({ value: row.id, label: row.displayName }))
			: []
	const assigning = busy?.kind === 'assign' ? busy.studentId : null
	const placeholder =
		assigning !== null
			? 'Assigning…'
			: students.kind === 'loading'
				? 'Loading students…'
				: students.kind === 'error'
					? 'Could not load students.'
					: 'Assign to a student'
	return (
		<div data-slot="event-manual-assign" className="flex flex-col gap-2">
			<div className="flex items-center gap-3">
				<UserRound size={16} aria-hidden className="shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 text-body text-muted-foreground">Not a lesson</span>
				<div className="w-[220px] max-w-[60%]">
					<SearchSelect
						id="event-assign-student"
						options={options}
						value=""
						onChange={(value) => {
							if (value !== '') onPick(value)
						}}
						placeholder={placeholder}
						emptyTitle="No students found"
						emptyHint="Try a part of the name."
						disabled={disabled || assigning !== null || students.kind !== 'ready'}
					/>
				</div>
			</div>
			<p
				role={failure === 'assign' ? 'alert' : undefined}
				className={cn('pl-7 text-caption', failure === 'assign' ? 'text-destructive' : 'text-muted-foreground')}
			>
				{failure === 'assign' ? ASSIGN_FAILURE : scopeCaption(seriesMember)}
			</p>
		</div>
	)
}
