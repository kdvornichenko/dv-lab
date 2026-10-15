'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { Check, Info, Minus, Plus, RefreshCw, StickyNote, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import Link from 'next/link'

import { Panel } from '@/components/app/layout-parts'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { studentHref } from '@/lib/schedule-links'
import { cn } from '@/lib/utils'

import type { ChatNoteChangeBlock } from '@dv-lab/contracts'

import { Caption, Header, Spinner, TOUCH } from './change-proposal'
import type { ChangeHandlers } from './messages'

type Handlers = ChangeHandlers & { onUndo: (actionId: string) => Promise<void> }

type Decision = 'confirm' | 'decline'

type Hunk = ChatNoteChangeBlock['hunks'][number]

const CANT_UNDO_BLOCK = "Can't undo: this block changed after the edit."
const CANT_UNDO_WORDS = "Can't undo: the vocabulary changed after the edit."

function blockName(block: ChatNoteChangeBlock): string {
	return block.target.kind === 'block' ? block.target.blockName : 'vocabulary'
}

function countWord(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`
}

function wordCount(block: ChatNoteChangeBlock): number {
	return block.words.filter((word) => word.state !== 'already').length
}

function addedLines(hunks: readonly Hunk[]): number {
	return hunks.reduce((total, hunk) => total + hunk.lines.filter((line) => line.kind === 'added').length, 0)
}

function receiptSentence(block: ChatNoteChangeBlock): string {
	const name = blockName(block)
	switch (block.change) {
		case 'updated':
			return `Updated ${name}.`
		case 'created':
			return `Created the block “${name}”.`
		case 'deleted':
			return `Deleted the empty block “${name}”.`
		case 'words_added':
			return `Added ${countWord(wordCount(block), 'word', 'words')} to ${block.studentName}'s vocabulary.`
		case 'words_removed':
			return `Removed ${countWord(wordCount(block), 'word', 'words')} from ${block.studentName}'s vocabulary.`
		case 'already':
			return block.target.kind === 'block'
				? `That is already in ${block.studentName}'s notes, in ${name}. Nothing was changed.`
				: `That is already in ${block.studentName}'s vocabulary. Nothing was changed.`
		case 'update_block':
			return `${name} updated.`
		case 'delete_block':
			return `${name} deleted.`
	}
}

function receiptCaption(block: ChatNoteChangeBlock): string | null {
	switch (block.change) {
		case 'updated': {
			const added = addedLines(block.hunks)
			return added === 0 ? null : `Added ${countWord(added, 'line', 'lines')} to the block.`
		}
		case 'created':
			return `No block of ${block.studentName}'s notes fitted.`
		case 'deleted':
			return 'It had no text.'
		case 'words_removed':
			return 'They stay in Removed for 30 days.'
		case 'update_block':
			return 'The text of the block was replaced.'
		case 'delete_block':
			return `The block and its text were removed from ${block.studentName}'s notes.`
		default:
			return null
	}
}

function undoneCaption(block: ChatNoteChangeBlock): string {
	const name = blockName(block)
	switch (block.change) {
		case 'created':
			return `The block “${name}” was removed.`
		case 'deleted':
		case 'delete_block':
			return `${name} is back in ${block.studentName}'s notes.`
		case 'words_added':
			return `The words were removed from ${block.studentName}'s vocabulary.`
		case 'words_removed':
			return `The words are back in ${block.studentName}'s vocabulary.`
		default:
			return `The previous text of ${name} is back.`
	}
}

function linkOf(block: ChatNoteChangeBlock): { href: string; label: string } | null {
	if (block.target.kind === 'vocabulary')
		return { href: studentHref(block.studentId, { tab: 'vocabulary' }), label: 'Open vocabulary' }
	const gone = block.change === 'deleted' || block.change === 'delete_block'
	if (gone || (block.change === 'created' && block.undo === 'undone'))
		return { href: studentHref(block.studentId, { tab: 'notes' }), label: 'Open Notes' }
	return {
		href: studentHref(block.studentId, { tab: 'notes', section: block.target.blockKey }),
		label: `Open ${block.target.blockName}`,
	}
}

function icon(block: ChatNoteChangeBlock): ReactNode {
	const trash = block.change === 'deleted' || block.change === 'delete_block' || block.change === 'words_removed'
	const Icon = trash ? Trash2 : StickyNote
	return <Icon size={16} aria-hidden />
}

const MARK: Record<'added' | 'removed' | 'same', { label: string; look: string }> = {
	added: {
		label: 'Added',
		look: 'border-l-[3px] border-success bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-foreground',
	},
	removed: {
		label: 'Removed',
		look: 'border-l-[3px] border-destructive bg-[color-mix(in_oklab,var(--destructive)_12%,transparent)] text-muted-foreground line-through',
	},
	same: { label: 'Unchanged', look: 'border-l-[3px] border-transparent text-muted-foreground' },
}

function DiffLine({ kind, text }: { kind: 'added' | 'removed' | 'same'; text: string }) {
	const mark = MARK[kind]
	return (
		<p
			data-slot="note-diff-line"
			data-kind={kind}
			className={cn('flex items-start gap-2 rounded-sm py-0.5 pr-2 pl-2 text-caption', mark.look)}
		>
			<span aria-hidden className="flex size-3.5 shrink-0 items-center justify-center pt-0.5">
				{kind === 'added' ? <Plus size={14} /> : kind === 'removed' ? <Minus size={14} /> : null}
			</span>
			<span className="sr-only">{mark.label}: </span>
			<span data-slot="note-diff-text" className="min-w-0 flex-1 wrap-anywhere whitespace-pre-wrap">
				{text === '' ? ' ' : text}
			</span>
		</p>
	)
}

function Diff({ block, dim = false }: { block: ChatNoteChangeBlock; dim?: boolean }) {
	if (block.hunks.length === 0) return null
	return (
		<div
			data-slot="note-diff"
			className={cn('ml-6 flex flex-col gap-1.5 rounded-lg bg-hover p-2', dim && 'opacity-60')}
		>
			{block.hunks.map((hunk, index) => (
				<div key={index} className="flex flex-col">
					{hunk.lines.map((line, lineIndex) => (
						<DiffLine key={lineIndex} kind={line.kind} text={line.text} />
					))}
				</div>
			))}
			{block.more > 0 ? (
				<p data-slot="note-diff-more" className="px-2 text-caption text-muted-foreground">
					{block.more} more {block.more === 1 ? 'change' : 'changes'}
				</p>
			) : null}
		</div>
	)
}

function Words({ block }: { block: ChatNoteChangeBlock }) {
	if (block.words.length === 0) return null
	return (
		<ul aria-label="Words" data-slot="note-words" className="flex flex-wrap gap-1.5 pl-6">
			{block.words.map((word) => (
				<li
					key={word.termId}
					data-state={word.state}
					className={cn(
						'rounded-full px-2 py-0.5 text-caption wrap-anywhere',
						word.state === 'removed'
							? 'text-muted-foreground line-through ring-1 ring-border ring-inset'
							: word.state === 'already'
								? 'bg-hover text-muted-foreground'
								: 'bg-secondary text-foreground'
					)}
				>
					{word.term}
				</li>
			))}
		</ul>
	)
}

function Info14({ children, role }: { children: ReactNode; role?: 'status' }) {
	return (
		<p role={role} className="flex items-start gap-2 pl-6 text-caption text-muted-foreground">
			<Info aria-hidden size={14} className="mt-0.5 shrink-0 text-info" />
			<span className="min-w-0 flex-1 wrap-anywhere">{children}</span>
		</p>
	)
}

function UndoAndLink({ block, onUndo }: { block: ChatNoteChangeBlock; onUndo: (actionId: string) => Promise<void> }) {
	const [busy, setBusy] = useState(false)
	const link = linkOf(block)
	const sentence = receiptSentence(block).replace(/\.$/, '')

	async function undo() {
		if (busy) return
		setBusy(true)
		try {
			await onUndo(block.actionId)
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="flex flex-wrap gap-2 pl-6">
			{block.undo === 'available' ? (
				<Button
					variant="secondary"
					size="compact"
					className={TOUCH}
					leadingIcon={busy ? Spinner : Undo2}
					disabled={busy}
					aria-busy={busy}
					aria-label={busy ? undefined : `Undo: ${sentence}`}
					onClick={() => void undo()}
				>
					{busy ? 'Undoing…' : 'Undo'}
				</Button>
			) : null}
			{link === null ? null : (
				<Button
					variant="secondary"
					size="compact"
					className={`${TOUCH} h-auto min-h-7 py-1 whitespace-normal`}
					nativeButton={false}
					render={<Link href={link.href} />}
				>
					{link.label}
				</Button>
			)}
		</div>
	)
}

function CantUndo({ block }: { block: ChatNoteChangeBlock }) {
	return <Info14 role="status">{block.target.kind === 'vocabulary' ? CANT_UNDO_WORDS : CANT_UNDO_BLOCK}</Info14>
}

function Receipt({ block, onUndo }: { block: ChatNoteChangeBlock; onUndo: Handlers['onUndo'] }) {
	if (block.change === 'already')
		return (
			<p
				role="status"
				data-slot="chat-note-change"
				data-mode="receipt"
				data-change="already"
				className="text-body text-muted-foreground"
			>
				{receiptSentence(block)}
			</p>
		)
	const undone = block.undo === 'undone'
	const caption = undone ? undoneCaption(block) : receiptCaption(block)
	return (
		<Panel>
			<div
				role="group"
				aria-label={undone ? 'Change undone' : receiptSentence(block)}
				data-slot="chat-note-change"
				data-mode="receipt"
				data-change={block.change}
				data-undo={block.undo ?? 'none'}
				className="flex flex-col gap-2 px-4 py-3"
			>
				<Header
					icon={undone ? <Check size={16} aria-hidden /> : icon(block)}
					text={undone ? 'Change undone.' : receiptSentence(block)}
				/>
				{caption === null ? null : <Caption>{caption}</Caption>}
				{undone ? null : <Diff block={block} />}
				{undone ? null : <Words block={block} />}
				{block.undo === 'unavailable' ? <CantUndo block={block} /> : null}
				<UndoAndLink block={block} onUndo={onUndo} />
			</div>
		</Panel>
	)
}

function reason(block: ChatNoteChangeBlock): string {
	switch (block.issue) {
		case 'not_found':
			return 'The block no longer exists.'
		case 'name_taken':
			return 'A block with this name already exists.'
		case 'words_changed':
			return 'The vocabulary changed.'
		default:
			return 'The block changed.'
	}
}

function Proposal({ block, onConfirm, onDecline, onRefresh, onUndo }: { block: ChatNoteChangeBlock } & Handlers) {
	const [pending, setPending] = useState<Decision | null>(null)
	const [unknown, setUnknown] = useState(false)
	const [refreshing, setRefreshing] = useState(false)
	const status = useRef<HTMLDivElement>(null)
	const previous = useRef(block.state)
	const name = blockName(block)
	const removing = block.change === 'delete_block'
	const question = removing ? `Delete ${name}?` : `Update ${name}?`
	const busyText = removing ? 'Deleting block…' : 'Saving to notes…'

	useEffect(() => {
		if (previous.current === 'applying' && block.state !== 'applying' && block.state !== 'proposed')
			status.current?.focus()
		previous.current = block.state
	}, [block.state])

	async function decide(decision: Decision) {
		if (pending !== null || block.state !== 'proposed') return
		setPending(decision)
		const known = await (decision === 'confirm' ? onConfirm : onDecline)(block.actionId)
		setPending(null)
		setUnknown(!known)
	}

	async function refresh() {
		if (refreshing) return
		setRefreshing(true)
		const known = await onRefresh()
		setRefreshing(false)
		if (known) setUnknown(false)
	}

	if (block.state === 'stale' || block.state === 'failed') {
		const stale = block.state === 'stale'
		return (
			<Banner
				status={stale ? 'warning' : 'error'}
				role="alert"
				data-slot="chat-note-change"
				data-mode="proposal"
				data-change={block.change}
				data-state={block.state}
			>
				<BannerTitle>
					{stale
						? 'This proposal is out of date. Nothing was changed.'
						: `${name} was not ${removing ? 'deleted' : 'updated'}. Nothing was changed.`}
				</BannerTitle>
				<BannerDescription>
					{stale
						? block.issue === 'not_found'
							? `${name} no longer exists. Ask again to use the current notes.`
							: `${name} changed after it was made. Ask again to use the current text.`
						: reason(block)}
				</BannerDescription>
			</Banner>
		)
	}

	const busy = block.state === 'applying' || pending !== null
	const confirming = busy && pending !== 'decline'

	function body(): ReactNode {
		if (unknown && block.state === 'proposed')
			return (
				<>
					<Header
						icon={<TriangleAlert size={16} className="text-warning" aria-hidden />}
						text="Could not load this change's status."
					/>
					<Diff block={block} />
					<div className="flex flex-wrap gap-2 pl-6">
						<Button
							variant="secondary"
							size="compact"
							className={TOUCH}
							disabled={refreshing}
							aria-busy={refreshing}
							leadingIcon={refreshing ? Spinner : RefreshCw}
							onClick={() => void refresh()}
						>
							Refresh status
						</Button>
					</div>
				</>
			)
		if (block.state === 'applied') {
			const undone = block.undo === 'undone'
			const caption = undone ? undoneCaption(block) : receiptCaption(block)
			return (
				<div ref={status} tabIndex={-1} role="status" className="flex flex-col gap-2 outline-none">
					<Header icon={<Check size={16} aria-hidden />} text={undone ? 'Change undone.' : receiptSentence(block)} />
					{caption === null ? null : <Caption>{caption}</Caption>}
					{block.undo === 'unavailable' ? <CantUndo block={block} /> : null}
					<UndoAndLink block={block} onUndo={onUndo} />
				</div>
			)
		}
		if (block.state === 'declined')
			return (
				<>
					<div className="flex flex-col gap-2 opacity-60">
						<Header icon={icon(block)} text={question} />
						<Diff block={block} />
					</div>
					<div ref={status} tabIndex={-1} role="status" className="outline-none">
						<Info14>Proposal declined. This proposal made no changes.</Info14>
					</div>
				</>
			)
		return (
			<>
				<Header icon={icon(block)} text={question} />
				<Diff block={block} />
				<Caption>
					{removing
						? 'The block and its text will be deleted.'
						: 'Only this block changes. The old text can be restored with Undo after it is saved.'}
				</Caption>
				<p role="status" className="sr-only">
					{busy ? (pending === 'decline' ? '' : busyText) : 'Waiting for your decision.'}
				</p>
				<div className="flex flex-wrap gap-2 pl-6">
					{removing ? (
						<>
							<Button
								variant="secondary"
								size="compact"
								className={TOUCH}
								disabled={busy}
								leadingIcon={pending === 'decline' ? Spinner : undefined}
								onClick={() => void decide('decline')}
							>
								Keep block
							</Button>
							<Button
								variant="tertiary"
								size="compact"
								className={`${TOUCH} text-destructive`}
								disabled={busy}
								leadingIcon={confirming ? Spinner : undefined}
								onClick={() => void decide('confirm')}
							>
								{confirming ? busyText : 'Delete block'}
							</Button>
						</>
					) : (
						<>
							<Button
								size="compact"
								className={TOUCH}
								disabled={busy}
								leadingIcon={confirming ? Spinner : undefined}
								onClick={() => void decide('confirm')}
							>
								{confirming ? busyText : 'Save to notes'}
							</Button>
							<Button
								variant="secondary"
								size="compact"
								className={TOUCH}
								disabled={busy}
								leadingIcon={pending === 'decline' ? Spinner : undefined}
								onClick={() => void decide('decline')}
							>
								Keep the notes
							</Button>
						</>
					)}
				</div>
			</>
		)
	}

	return (
		<Panel>
			<div
				role="group"
				aria-label={question}
				aria-busy={busy}
				data-slot="chat-note-change"
				data-mode="proposal"
				data-change={block.change}
				data-state={unknown && block.state === 'proposed' ? 'unknown' : block.state}
				data-undo={block.undo ?? 'none'}
				className="flex flex-col gap-2 px-4 py-3"
			>
				{body()}
			</div>
		</Panel>
	)
}

export function ChatNoteChange({ block, ...handlers }: { block: ChatNoteChangeBlock } & Handlers) {
	return block.mode === 'receipt' ? (
		<Receipt block={block} onUndo={handlers.onUndo} />
	) : (
		<Proposal block={block} {...handlers} />
	)
}
