'use client'

import { useCallback, useEffect, useRef, useState, type Ref } from 'react'

import { NotebookPen, Pencil, Plus } from 'lucide-react'

import { EmptyState } from '@/components/app/empty-state'
import { RecordsUnread } from '@/components/app/records-unread'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'

import {
	studentBlocksResponse,
	type NoteBlock,
	type StudentDetail,
	type StudentNote,
	type StudentNotesResponse,
} from '@dv-lab/contracts'

import { NewBlockPanel, NoteBlockPanel } from './note-block'
import { NoteBlocksOrder } from './note-blocks-order'
import { type NotesState } from './note-entries'
import type { ProfileMark } from './profile-arrival'
import { ReviewStamp, ReviewStampLoading } from './review-stamp'
import { useNotesArrival } from './use-notes-arrival'

export type SectionDrafts = Partial<Record<string, string>>

type ReadState =
	{ kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; blocks: NoteBlock[]; reviewedAt: string | null }

function byPosition(blocks: NoteBlock[]): NoteBlock[] {
	return [...blocks].sort((left, right) => left.position - right.position)
}

async function readBlocks(studentId: string): Promise<ReadState> {
	const result = await apiRequest<unknown>('GET', `/students/${studentId}/blocks`)
	if (!result.ok) return { kind: 'error' }
	const parsed = studentBlocksResponse.safeParse(result.data)
	return parsed.success
		? { kind: 'ready', blocks: byPosition(parsed.data.blocks), reviewedAt: parsed.data.reviewedAt }
		: { kind: 'error' }
}

async function readNotes(studentId: string): Promise<NotesState> {
	const result = await apiRequest<StudentNotesResponse>('GET', `/students/${studentId}/notes`)
	return result.ok ? { kind: 'ready', notes: result.data.notes } : { kind: 'error' }
}

function AddBlockButton({
	disabled,
	buttonRef,
	onClick,
}: {
	disabled: boolean
	buttonRef?: Ref<HTMLButtonElement>
	onClick?: () => void
}) {
	return (
		<Button ref={buttonRef} variant="secondary" leadingIcon={Plus} disabled={disabled} onClick={onClick}>
			Add block
		</Button>
	)
}

function LoadingBlocks() {
	return (
		<div className="flex max-w-190 flex-col gap-3" data-slot="notes-loading">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<ReviewStampLoading />
				<AddBlockButton disabled />
			</div>
			{[0, 1, 2].map((item) => (
				<Elevated key={item} offset={1} shadowLevel={2} className="flex flex-col gap-2 rounded-2xl px-4 pt-3 pb-4">
					<div className="flex min-h-8 items-center gap-2">
						<Skeleton className="h-4 w-40" />
						<span className="flex-1" />
						<Button variant="ghost" size="compact" leadingIcon={Pencil} disabled>
							Edit
						</Button>
					</div>
					<Skeleton className="h-3 w-full" />
					<Skeleton className="h-3 w-3/5" />
				</Elevated>
			))}
		</div>
	)
}

interface NotesTabProps {
	student: StudentDetail
	drafts: SectionDrafts
	timeZone: string
	asOf: string
	onDraftChange(key: string, value: string | undefined): void
	mark: ProfileMark | null
	onMarkDone: () => void
}

export function NotesTab({ student, drafts, timeZone, asOf, onDraftChange, mark, onMarkDone }: NotesTabProps) {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [notes, setNotes] = useState<NotesState>({ kind: 'loading' })
	const [adding, setAdding] = useState(false)
	const addButton = useRef<HTMLButtonElement>(null)
	const studentId = student.id
	const now = new Date(asOf)
	useNotesArrival(mark, state.kind !== 'loading' && notes.kind !== 'loading', onMarkDone)

	const reloadNotes = useCallback(async () => {
		setNotes(await readNotes(studentId))
	}, [studentId])

	const load = useCallback(async () => {
		setState(await readBlocks(studentId))
	}, [studentId])

	useEffect(() => {
		let current = true
		void readBlocks(studentId).then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [studentId])

	useEffect(() => {
		let current = true
		void readNotes(studentId).then((next) => {
			if (current) setNotes(next)
		})
		return () => {
			current = false
		}
	}, [studentId])

	function setBlocks(blocks: NoteBlock[]) {
		setState((previous) => (previous.kind === 'ready' ? { ...previous, blocks: byPosition(blocks) } : previous))
	}

	function noteRemoved(note: StudentNote) {
		setNotes((previous) =>
			previous.kind === 'ready'
				? { kind: 'ready', notes: previous.notes.filter((item) => item.id !== note.id) }
				: previous
		)
	}

	const reloadBlocks = useCallback(async (): Promise<NoteBlock[] | null> => {
		const next = await readBlocks(studentId)
		if (next.kind !== 'ready') return null
		setState(next)
		return next.blocks
	}, [studentId])

	async function reloadBlock(id: string): Promise<NoteBlock | null> {
		const blocks = await reloadBlocks()
		return blocks?.find((block) => block.id === id) ?? null
	}

	function changed(block: NoteBlock) {
		setState((previous) =>
			previous.kind === 'ready'
				? { ...previous, blocks: previous.blocks.map((item) => (item.id === block.id ? block : item)) }
				: previous
		)
	}

	function created(block: NoteBlock) {
		setAdding(false)
		setState((previous) =>
			previous.kind === 'ready' ? { ...previous, blocks: byPosition([...previous.blocks, block]) } : previous
		)
		requestAnimationFrame(() => {
			document.querySelector<HTMLElement>(`[data-block-id="${block.id}"] [data-block-edit]`)?.focus()
		})
	}

	function deleted(block: NoteBlock) {
		if (state.kind !== 'ready') return
		const index = state.blocks.findIndex((item) => item.id === block.id)
		const neighbour = state.blocks[index + 1] ?? state.blocks[index - 1]
		setState({ ...state, blocks: state.blocks.filter((item) => item.id !== block.id) })
		requestAnimationFrame(() => {
			const target = neighbour
				? document.querySelector<HTMLElement>(`[data-block-id="${neighbour.id}"] [data-block-edit]`)
				: null
			;(target ?? addButton.current)?.focus()
		})
	}

	if (state.kind === 'loading') return <LoadingBlocks />
	if (state.kind === 'error') return <RecordsUnread slot="notes-unread" onRefresh={load} />

	const blocks = state.blocks

	return (
		<div className="flex max-w-190 flex-col gap-3" data-slot="notes-ready">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<ReviewStamp reviewedAt={state.reviewedAt} timeZone={timeZone} now={now} />
				<AddBlockButton buttonRef={addButton} disabled={adding} onClick={() => setAdding(true)} />
			</div>
			{blocks.length === 0 ? (
				adding ? null : (
					<EmptyState
						icon={NotebookPen}
						title="No notes yet"
						description="Add a block, or ask the assistant in the chat to note something down: it creates the block itself."
						action={
							<Button variant="secondary" leadingIcon={Plus} onClick={() => setAdding(true)}>
								Add block
							</Button>
						}
					/>
				)
			) : (
				<NoteBlocksOrder
					studentId={studentId}
					blocks={blocks}
					onBlocks={setBlocks}
					onReloadBlocks={reloadBlocks}
					renderBlock={(block, slot) => (
						<NoteBlockPanel
							student={student}
							block={block}
							index={slot.index}
							count={slot.count}
							lifted={slot.lifted}
							ordering={slot.ordering}
							handle={slot.handle}
							draft={drafts[block.key]}
							onDraft={onDraftChange}
							onChanged={changed}
							onDeleted={deleted}
							onReloadBlock={reloadBlock}
							onMove={slot.moveBy}
							notes={notes}
							timeZone={timeZone}
							now={now}
							onReloadNotes={reloadNotes}
							onNoteRemoved={noteRemoved}
						/>
					)}
				/>
			)}
			{adding ? (
				<NewBlockPanel
					student={student}
					onCreated={created}
					onCancel={() => {
						setAdding(false)
						requestAnimationFrame(() => addButton.current?.focus())
					}}
				/>
			) : null}
		</div>
	)
}
