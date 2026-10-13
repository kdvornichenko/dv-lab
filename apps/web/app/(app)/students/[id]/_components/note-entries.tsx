'use client'

import { useState } from 'react'

import { CircleAlert, Info, RefreshCw, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { MarkdownView } from '@/components/app/markdown-view'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { formatDay, formatDayMonth, yearInZone } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type { SectionKind, StudentNote, StudentNoteResponse } from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'

export type NotesState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; notes: StudentNote[] }

interface NoteEntriesProps {
	studentId: string
	studentName: string
	sectionKind: SectionKind
	sectionTitle: string
	state: NotesState
	timeZone: string
	now: Date
	onReload: () => Promise<void>
	onRemoved: (note: StudentNote) => void
	onFocusSection: () => void
}

function NotesLoading() {
	return (
		<div role="status" aria-label="Loading added notes" className="flex flex-col gap-2 pt-3">
			<Skeleton className="h-3.5 w-[70%]" />
			<Skeleton className="h-3.5 w-[48%]" />
		</div>
	)
}

function NotesReadError({ onReload }: { onReload: () => Promise<void> }) {
	const [pending, setPending] = useState(false)
	async function refresh() {
		setPending(true)
		try {
			await onReload()
		} finally {
			setPending(false)
		}
	}
	return (
		<div className="flex items-center gap-2 pt-2">
			<CircleAlert size={16} strokeWidth={1.5} aria-hidden className="shrink-0 text-destructive" />
			<p role="status" className="min-w-0 flex-1 text-caption text-foreground">
				Could not load the added notes.
			</p>
			<Button
				variant="secondary"
				size="compact"
				leadingIcon={RefreshCw}
				loading={pending}
				onClick={() => void refresh()}
			>
				Refresh
			</Button>
		</div>
	)
}

interface EntryRowProps {
	note: StudentNote
	timeZone: string
	now: Date
	removing: boolean
	onRemove: (note: StudentNote) => void
}

function EntryRow({ note, timeZone, now, removing, onRemove }: EntryRowProps) {
	const created = new Date(note.createdAt)
	const date = formatDay(created, timeZone, yearInZone(now, timeZone))
	return (
		<li
			className={cn(
				'group/entry flex flex-col gap-1.5 border-t border-border py-2.5 first:border-t-0 md:flex-row md:items-start md:gap-3',
				removing && 'opacity-50'
			)}
		>
			<div className="md:w-28 md:shrink-0">
				<p className="text-caption text-muted-foreground tabular-nums">
					{date}
					<span className="text-micro md:hidden"> · Added in chat</span>
				</p>
				<p className="hidden text-micro text-muted-foreground md:block">Added in chat</p>
			</div>
			<div className="w-0 min-w-full md:min-w-0 md:flex-1">
				<MarkdownView body={note.body} />
			</div>
			<div className="-ml-2 self-start md:ml-0 md:shrink-0">
				{removing ? (
					<span role="status" className="px-2 text-caption text-muted-foreground">
						Removing…
					</span>
				) : (
					<Button
						variant="ghost"
						size="compact"
						leadingIcon={Trash2}
						data-note-remove={note.id}
						aria-label={`Remove note from ${formatDayMonth(created, timeZone)}`}
						className="max-md:opacity-100 md:opacity-0 md:group-focus-within/entry:opacity-100 md:group-hover/entry:opacity-100 pointer-coarse:opacity-100"
						onClick={() => onRemove(note)}
					>
						Remove
					</Button>
				)}
			</div>
		</li>
	)
}

export function NoteEntries({
	studentId,
	studentName,
	sectionKind,
	sectionTitle,
	state,
	timeZone,
	now,
	onReload,
	onRemoved,
	onFocusSection,
}: NoteEntriesProps) {
	const toast = useToast()
	const [confirming, setConfirming] = useState<StudentNote | null>(null)
	const [removingId, setRemovingId] = useState<string | null>(null)
	const [conflict, setConflict] = useState(false)
	const entries = state.kind === 'ready' ? state.notes.filter((note) => note.sectionKind === sectionKind).reverse() : []

	async function remove(note: StudentNote): Promise<boolean> {
		const index = entries.findIndex((item) => item.id === note.id)
		const next = entries[index + 1] ?? entries[index - 1]
		setConflict(false)
		setRemovingId(note.id)
		const result = await apiRequest<StudentNoteResponse>('POST', `/students/${studentId}/notes/${note.id}/retract`, {
			expectedRevision: note.revision,
		})
		if (result.ok) {
			setRemovingId(null)
			onRemoved(note)
			toast.show({ title: 'Note removed', description: `${sectionTitle} on ${studentName}'s card.` })
			requestAnimationFrame(() => {
				const target = next ? document.querySelector<HTMLElement>(`[data-note-remove="${next.id}"]`) : null
				if (target) target.focus()
				else onFocusSection()
			})
			return true
		}
		if (result.status === 409 || result.status === 404) {
			await onReload()
			setRemovingId(null)
			setConflict(true)
			return true
		}
		setRemovingId(null)
		return false
	}

	return (
		<>
			{state.kind === 'loading' ? <NotesLoading /> : null}
			{state.kind === 'error' ? <NotesReadError onReload={onReload} /> : null}
			{entries.length > 0 ? (
				<div className="flex flex-col">
					<p className="pt-1 text-caption text-muted-foreground">Added notes</p>
					<ul role="list" className="flex flex-col">
						{entries.map((note) => (
							<EntryRow
								key={note.id}
								note={note}
								timeZone={timeZone}
								now={now}
								removing={removingId === note.id}
								onRemove={setConfirming}
							/>
						))}
					</ul>
				</div>
			) : null}
			{conflict ? (
				<div role="status" className="flex items-start gap-2 pt-1">
					<Info size={16} strokeWidth={1.5} aria-hidden className="mt-px shrink-0 text-info" />
					<p className="min-w-0 flex-1 text-caption text-muted-foreground">
						This note changed after it was added. The list is updated.
					</p>
				</div>
			) : null}
			{confirming ? (
				<ConfirmDialog
					key={confirming.id}
					title="Remove this note?"
					body="The note is deleted from the student's notes. The text of the section is not changed."
					cancelLabel="Keep note"
					confirmLabel="Remove note"
					pendingLabel="Removing…"
					tone="destructive"
					failureText="Could not remove the note. Try again."
					failureLine
					onConfirm={() => remove(confirming)}
					onClose={() => setConfirming(null)}
				/>
			) : null}
		</>
	)
}
