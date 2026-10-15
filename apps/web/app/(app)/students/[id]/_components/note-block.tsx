'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { MarkdownView } from '@/components/app/markdown-view'
import { ReloadNotice } from '@/components/app/reload-notice'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { DropdownContent, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { Input } from '@/components/ui/input'
import { MenuItem } from '@/components/ui/menu-item'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'
import { cn } from '@/lib/utils'

import {
	BLOCK_NAME_MAX_LENGTH,
	SECTION_BODY_MAX_LENGTH,
	studentBlockResponse,
	type NoteBlock,
	type StudentDetail,
	type StudentNote,
} from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'
import { NoteEntries, type NotesState } from './note-entries'

const NAME_REQUIRED = 'Enter a name.'
const NAME_TAKEN = 'A block with this name already exists.'
const NAME_CHANGED = 'This block changed elsewhere. Try again.'
const BODY_TOO_LONG = 'Use 20,000 characters or fewer.'
const NO_TEXT = 'No text yet.'

function parseBlock(data: unknown): NoteBlock | null {
	const parsed = studentBlockResponse.safeParse(data)
	return parsed.success ? parsed.data.block : null
}

function tooLong(value: string): boolean {
	return Array.from(value).length > SECTION_BODY_MAX_LENGTH
}

function MarkdownLine({ children }: { children: ReactNode }) {
	return <p className="text-caption text-muted-foreground">{children}</p>
}

function EditorFooter({
	pending,
	canSave,
	onCancel,
	onSave,
}: {
	pending: boolean
	canSave: boolean
	onCancel: () => void
	onSave: () => void
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<MarkdownLine>Markdown is supported.</MarkdownLine>
			<div className="flex gap-2">
				<Button type="button" variant="ghost" size="compact" onClick={onCancel} disabled={pending}>
					Cancel
				</Button>
				<Button type="button" size="compact" loading={pending} disabled={!canSave} onClick={onSave}>
					{pending ? 'Saving…' : 'Save'}
				</Button>
			</div>
		</div>
	)
}

interface NoteBlockPanelProps {
	student: StudentDetail
	block: NoteBlock
	index: number
	count: number
	lifted: boolean
	ordering: boolean
	handle: ReactNode
	draft: string | undefined
	onDraft: (key: string, value: string | undefined) => void
	onChanged: (block: NoteBlock) => void
	onDeleted: (block: NoteBlock) => void
	onReloadBlock: (id: string) => Promise<NoteBlock | null>
	onMove: (delta: -1 | 1) => void
	notes: NotesState
	timeZone: string
	now: Date
	onReloadNotes: () => Promise<void>
	onNoteRemoved: (note: StudentNote) => void
}

export function NoteBlockPanel({
	student,
	block,
	index,
	count,
	lifted,
	ordering,
	handle,
	draft,
	onDraft,
	onChanged,
	onDeleted,
	onReloadBlock,
	onMove,
	notes,
	timeZone,
	now,
	onReloadNotes,
	onNoteRemoved,
}: NoteBlockPanelProps) {
	const toast = useToast()
	const [pending, setPending] = useState(false)
	const [failed, setFailed] = useState(false)
	const [conflict, setConflict] = useState(false)
	const [reloading, setReloading] = useState(false)
	const [showError, setShowError] = useState(false)
	const [renaming, setRenaming] = useState(false)
	const [name, setName] = useState(block.name)
	const [nameError, setNameError] = useState<string | null>(null)
	const [renamePending, setRenamePending] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const editButton = useRef<HTMLButtonElement>(null)
	const menuButton = useRef<HTMLButtonElement>(null)
	const textarea = useRef<HTMLTextAreaElement>(null)
	const nameInput = useRef<HTMLInputElement>(null)
	const renameBusy = useRef(false)
	const editing = draft !== undefined
	const long = editing && tooLong(draft)
	const bodyError = showError && long ? BODY_TOO_LONG : undefined
	const errorId = `block-${block.key}-error`
	const headingId = `section-${block.key}`

	useEffect(() => {
		if (!renaming) return
		nameInput.current?.focus()
		nameInput.current?.select()
	}, [renaming])

	function startEdit() {
		onDraft(block.key, block.body)
		requestAnimationFrame(() => textarea.current?.focus())
	}

	function cancelEdit() {
		if (pending) return
		onDraft(block.key, undefined)
		setFailed(false)
		setConflict(false)
		setShowError(false)
		requestAnimationFrame(() => editButton.current?.focus())
	}

	async function save() {
		if (pending || draft === undefined || conflict) return
		setShowError(true)
		setFailed(false)
		if (long) {
			textarea.current?.focus()
			return
		}
		if (draft === block.body) {
			cancelEdit()
			return
		}
		setPending(true)
		const result = await apiRequest<unknown>('PUT', `/students/${student.id}/blocks/${block.id}`, {
			body: draft,
			expectedRevision: block.revision,
		})
		setPending(false)
		if (!result.ok) {
			if (result.error?.code === 'precondition_failed') setConflict(true)
			else setFailed(true)
			return
		}
		const saved = parseBlock(result.data)
		if (saved === null) {
			setFailed(true)
			return
		}
		setShowError(false)
		onChanged(saved)
		onDraft(block.key, undefined)
		requestAnimationFrame(() => editButton.current?.focus())
	}

	async function reload() {
		setReloading(true)
		const fresh = await onReloadBlock(block.id)
		setReloading(false)
		setConflict(false)
		if (fresh !== null) onDraft(block.key, fresh.body)
	}

	function startRename() {
		setName(block.name)
		setNameError(null)
		setRenaming(true)
	}

	function endRename() {
		setRenaming(false)
		setNameError(null)
		requestAnimationFrame(() => menuButton.current?.focus())
	}

	async function commitRename() {
		if (renameBusy.current) return
		const next = name.trim()
		if (next === '') {
			setNameError(NAME_REQUIRED)
			nameInput.current?.focus()
			return
		}
		if (next === block.name) {
			endRename()
			return
		}
		renameBusy.current = true
		setRenamePending(true)
		const result = await apiRequest<unknown>('PATCH', `/students/${student.id}/blocks/${block.id}`, {
			name: next,
			expectedRevision: block.revision,
		})
		renameBusy.current = false
		setRenamePending(false)
		if (!result.ok) {
			const code = result.error?.code
			if (code === 'block_name_taken') setNameError(NAME_TAKEN)
			else if (code === 'precondition_failed') {
				await onReloadBlock(block.id)
				setNameError(NAME_CHANGED)
			} else setNameError('Could not rename the block. Try again.')
			requestAnimationFrame(() => nameInput.current?.focus())
			return
		}
		const renamed = parseBlock(result.data)
		if (renamed === null) {
			setNameError('Could not rename the block. Try again.')
			return
		}
		onChanged(renamed)
		endRename()
	}

	function onNameKey(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter') {
			event.preventDefault()
			void commitRename()
		} else if (event.key === 'Escape') {
			event.preventDefault()
			endRename()
		}
	}

	async function remove(): Promise<boolean> {
		const result = await apiRequest<unknown>('DELETE', `/students/${student.id}/blocks/${block.id}`, {
			expectedRevision: block.revision,
		})
		if (result.ok || result.status === 404) {
			finishDelete()
			return true
		}
		if (result.error?.code === 'precondition_failed') await onReloadBlock(block.id)
		return false
	}

	function finishDelete() {
		onDraft(block.key, undefined)
		onDeleted(block)
		toast.show({ title: 'Block deleted', description: `${block.name} on ${student.displayName}'s card.` })
	}

	async function deleteNow() {
		const done = await remove()
		if (!done) toast.show({ title: 'Could not delete the block', description: 'Try again.', status: 'error' })
	}

	function askDelete() {
		window.setTimeout(() => {
			if (block.body.trim() === '') void deleteNow()
			else setConfirming(true)
		}, 0)
	}

	const entries = block.standard ? (
		<NoteEntries
			studentId={student.id}
			studentName={student.displayName}
			sectionKind={block.key}
			sectionTitle={block.name}
			state={notes}
			timeZone={timeZone}
			now={now}
			onReload={onReloadNotes}
			onRemoved={onNoteRemoved}
			onFocusSection={() => (editButton.current ?? textarea.current)?.focus()}
		/>
	) : null

	const menuLocked = renaming || editing || pending || renamePending
	let item = 0

	return (
		<Elevated
			offset={1}
			shadowLevel={2}
			className={cn('flex min-w-0 flex-col rounded-2xl', lifted && 'bg-surface-4 shadow-surface-4 ring-1 ring-input')}
			data-block-id={block.id}
		>
			<section
				aria-labelledby={headingId}
				data-block-key={block.key}
				className="flex min-w-0 flex-col gap-2 px-4 pt-3 pb-4"
			>
				<div className="flex min-h-8 items-center gap-2">
					{handle}
					<h2
						id={headingId}
						className={cn('min-w-0 text-title font-semibold text-foreground', renaming ? 'flex-1' : 'truncate')}
						title={renaming ? undefined : block.name}
					>
						{renaming ? (
							<Input
								ref={nameInput}
								value={name}
								maxLength={BLOCK_NAME_MAX_LENGTH}
								aria-label="Block name"
								aria-invalid={nameError ? true : undefined}
								aria-describedby={`${headingId}-hint`}
								autoComplete="off"
								disabled={renamePending}
								className="h-8 font-semibold"
								onChange={(event) => {
									setName(event.target.value)
									setNameError(null)
								}}
								onKeyDown={onNameKey}
								onBlur={() => void commitRename()}
							/>
						) : (
							block.name
						)}
					</h2>
					{renaming ? null : <span className="flex-1" />}
					{renaming || editing ? null : (
						<Button
							ref={editButton}
							variant="ghost"
							size="compact"
							leadingIcon={Pencil}
							data-block-edit
							onClick={startEdit}
						>
							Edit
						</Button>
					)}
					{renaming ? null : (
						<DropdownMenu size="compact">
							<DropdownTrigger
								render={
									<Button
										ref={menuButton}
										variant="ghost"
										size="icon-compact"
										aria-label={`More actions for ${block.name}`}
										disabled={menuLocked}
									/>
								}
							>
								<MoreHorizontal />
							</DropdownTrigger>
							<DropdownContent align="end" className="w-48 min-w-48 bg-surface-4 shadow-surface-4">
								<MenuItem
									index={item++}
									label="Rename"
									icon={Pencil}
									onSelect={() => window.setTimeout(startRename, 0)}
								/>
								<MenuItem
									index={item++}
									label="Move up"
									icon={ArrowUp}
									disabled={index === 0 || ordering}
									onSelect={() => onMove(-1)}
								/>
								<MenuItem
									index={item++}
									label="Move down"
									icon={ArrowDown}
									disabled={index === count - 1 || ordering}
									onSelect={() => onMove(1)}
								/>
								<DropdownSeparator />
								<MenuItem
									index={item++}
									label="Delete block"
									icon={Trash2}
									className="[&_span]:text-destructive"
									onSelect={askDelete}
								/>
							</DropdownContent>
						</DropdownMenu>
					)}
				</div>
				{renaming ? (
					<p
						id={`${headingId}-hint`}
						role={nameError ? 'alert' : undefined}
						className={cn('text-caption', nameError ? 'text-destructive' : 'text-muted-foreground')}
					>
						{nameError ?? 'Enter to save, Esc to cancel.'}
					</p>
				) : null}
				{editing ? (
					<div className="flex flex-col gap-2">
						{failed ? (
							<Banner status="error">
								<BannerTitle>Could not save the block. Try again.</BannerTitle>
							</Banner>
						) : null}
						<Textarea
							ref={textarea}
							className="min-h-32"
							aria-label={block.name}
							aria-invalid={bodyError ? true : undefined}
							aria-describedby={bodyError ? errorId : undefined}
							value={draft}
							onChange={(event) => onDraft(block.key, event.target.value)}
							onBlur={() => setShowError(true)}
							disabled={pending}
						/>
						{bodyError ? (
							<p id={errorId} className="text-caption text-destructive">
								{bodyError}
							</p>
						) : null}
						{conflict ? (
							<ReloadNotice
								status="warning"
								text="This block changed elsewhere. Your draft has been kept. Reload the current text before saving."
								reloadLabel="Reload block"
								pending={reloading}
								onReload={() => void reload()}
							/>
						) : null}
						<EditorFooter pending={pending} canSave={!conflict} onCancel={cancelEdit} onSave={() => void save()} />
						{entries}
					</div>
				) : (
					<div className="flex flex-col gap-2">
						<div className="w-0 min-w-full">
							{block.body.trim() === '' ? (
								<p className="text-body text-muted-foreground">{NO_TEXT}</p>
							) : (
								<MarkdownView body={block.body} />
							)}
						</div>
						{entries}
					</div>
				)}
			</section>
			{confirming ? (
				<ConfirmDialog
					title="Delete this block?"
					body={`“${block.name}” and its text will be deleted. This cannot be undone.`}
					cancelLabel="Keep block"
					confirmLabel="Delete block"
					pendingLabel="Deleting…"
					tone="destructive"
					failureText="Could not delete the block. Try again."
					failureLine
					onConfirm={remove}
					onClose={() => setConfirming(false)}
				/>
			) : null}
		</Elevated>
	)
}

interface NewBlockPanelProps {
	student: StudentDetail
	onCreated: (block: NoteBlock) => void
	onCancel: () => void
}

export function NewBlockPanel({ student, onCreated, onCancel }: NewBlockPanelProps) {
	const [name, setName] = useState('')
	const [body, setBody] = useState('')
	const [pending, setPending] = useState(false)
	const [nameError, setNameError] = useState<string | null>(null)
	const [failed, setFailed] = useState(false)
	const [showError, setShowError] = useState(false)
	const root = useRef<HTMLElement>(null)
	const nameInput = useRef<HTMLInputElement>(null)
	const long = tooLong(body)
	const bodyError = showError && long ? BODY_TOO_LONG : undefined

	useEffect(() => {
		root.current?.scrollIntoView({ block: 'nearest' })
		nameInput.current?.focus()
	}, [])

	async function save() {
		if (pending) return
		const next = name.trim()
		if (next === '') {
			setNameError(NAME_REQUIRED)
			nameInput.current?.focus()
			return
		}
		setShowError(true)
		if (long) return
		setFailed(false)
		setPending(true)
		const result = await apiRequest<unknown>('POST', `/students/${student.id}/blocks`, { name: next, body })
		setPending(false)
		if (!result.ok) {
			if (result.error?.code === 'block_name_taken') {
				setNameError(NAME_TAKEN)
				nameInput.current?.focus()
			} else setFailed(true)
			return
		}
		const created = parseBlock(result.data)
		if (created === null) {
			setFailed(true)
			return
		}
		onCreated(created)
	}

	return (
		<Elevated offset={1} shadowLevel={2} className="flex min-w-0 flex-col rounded-2xl" data-slot="new-block">
			<section ref={root} aria-label="New block" className="flex min-w-0 flex-col gap-2 px-4 pt-3 pb-4">
				<div className="flex flex-col gap-1">
					<Input
						ref={nameInput}
						value={name}
						maxLength={BLOCK_NAME_MAX_LENGTH}
						placeholder="Block name"
						aria-label="Block name"
						aria-invalid={nameError ? true : undefined}
						aria-describedby={nameError ? 'new-block-name-error' : undefined}
						autoComplete="off"
						disabled={pending}
						className="h-8 font-semibold"
						onChange={(event) => {
							setName(event.target.value)
							setNameError(null)
						}}
					/>
					{nameError ? (
						<p id="new-block-name-error" role="alert" className="text-caption text-destructive">
							{nameError}
						</p>
					) : null}
				</div>
				{failed ? (
					<Banner status="error">
						<BannerTitle>Could not save the block. Try again.</BannerTitle>
					</Banner>
				) : null}
				<Textarea
					className="min-h-32"
					aria-label="Block text"
					placeholder="Write notes in Markdown."
					aria-invalid={bodyError ? true : undefined}
					value={body}
					onChange={(event) => setBody(event.target.value)}
					onBlur={() => setShowError(true)}
					disabled={pending}
				/>
				{bodyError ? <p className="text-caption text-destructive">{bodyError}</p> : null}
				<EditorFooter pending={pending} canSave={name.trim() !== ''} onCancel={onCancel} onSave={() => void save()} />
			</section>
		</Elevated>
	)
}
