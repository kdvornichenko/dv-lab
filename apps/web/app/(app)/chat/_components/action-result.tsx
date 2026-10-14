'use client'

import { useEffect, useRef } from 'react'

import { Check, Info, LoaderCircle, Undo2 } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { markHelp, markLabel } from '@/lib/lesson-mark-text'
import { mainWhen, yearInZone } from '@/lib/schedule-format'
import { lessonHref } from '@/lib/schedule-links'
import { cn } from '@/lib/utils'

import type { ChatActionResultBlock } from '@dv-lab/contracts'

import { CalendarLink } from './agent-links'

export const UNDO_CONFLICT = 'This record changed after your action. Undo is unavailable.'

function sentence(block: ChatActionResultBlock): string {
	if (block.kind === 'note') return 'Note added.'
	if (block.kind === 'comment') return 'Comment added.'
	return block.mark === 'no_show' ? 'Lesson marked No-show.' : 'Lesson marked Done.'
}

function detail(block: ChatActionResultBlock, secondZone: string | null): string {
	if (block.kind === 'note') return `In ${block.studentName}'s notes.`
	const zone = block.timeZone
	const at = block.lessonStartsAt ? new Date(block.lessonStartsAt) : null
	const head =
		at !== null && zone !== undefined
			? `${block.studentName}, ${mainWhen(at, zone, secondZone, yearInZone(new Date(), zone))}.`
			: `${block.studentName}.`
	if (block.kind !== 'mark' || block.effect === undefined || block.lessonMinutes === undefined) return head
	return `${head} ${markHelp(block.effect, block.lessonMinutes, null, zone ?? 'UTC')}`
}

function undoneLine(block: ChatActionResultBlock): string {
	if (block.kind === 'note') return 'The note is removed.'
	if (block.kind === 'comment') return 'The comment is removed.'
	return `${block.studentName}'s lesson is back to ${markLabel(block.before ?? 'none')}.`
}

function Spinner({ size, className }: { size?: number; className?: string }) {
	return <LoaderCircle size={size ?? 16} className={cn('animate-spin', className)} aria-hidden />
}

function UndoButton({
	block,
	onUndo,
	className,
}: {
	block: ChatActionResultBlock
	onUndo: (actionId: string) => void
	className?: string
}) {
	const pending = block.undo === 'pending'
	return (
		<Button
			variant="ghost"
			size="compact"
			leadingIcon={pending ? Spinner : Undo2}
			disabled={pending}
			aria-busy={pending}
			aria-label={pending ? undefined : `Undo: ${sentence(block).replace(/\.$/, '')}`}
			className={className}
			onClick={() => onUndo(block.actionId)}
		>
			{pending ? 'Undoing…' : 'Undo'}
		</Button>
	)
}

export function ActionResult({ block, onUndo }: { block: ChatActionResultBlock; onUndo: (actionId: string) => void }) {
	const [secondZone] = useSecondZone(block.timeZone ?? null)
	const status = useRef<HTMLDivElement>(null)
	const previous = useRef(block.undo)
	const done = block.undo === 'done'
	const undoable = block.undo === 'available' || block.undo === 'pending'

	useEffect(() => {
		if (previous.current === 'pending' && block.undo !== 'pending') status.current?.focus()
		previous.current = block.undo
	}, [block.undo])

	return (
		<Panel>
			<div
				ref={status}
				role="status"
				tabIndex={-1}
				data-slot="chat-action-result"
				data-undo={block.undo}
				className="flex flex-col gap-2 px-4 py-3 outline-none"
			>
				<div className="flex items-center gap-2">
					<span className="flex shrink-0 text-muted-foreground" aria-hidden>
						{done ? <Undo2 size={16} /> : <Check size={16} />}
					</span>
					<p className="min-w-0 flex-1 text-body font-semibold text-foreground">
						{done ? 'Change undone.' : sentence(block)}
					</p>
					{done || block.lessonRef === undefined || block.lessonDate === undefined ? null : (
						<CalendarLink href={lessonHref(block.lessonDate, block.lessonRef)} />
					)}
					{undoable ? <UndoButton block={block} onUndo={onUndo} className="max-sm:hidden" /> : null}
				</div>
				<p className="pl-6 text-caption text-muted-foreground tabular-nums">
					{done ? undoneLine(block) : detail(block, secondZone)}
				</p>
				{!done && block.text !== undefined ? (
					<div className="pl-6">
						<p className="border-l-2 border-border pl-3 text-body break-words whitespace-pre-wrap text-foreground">
							{block.text}
						</p>
					</div>
				) : null}
				{block.undo === 'stale' ? (
					<p className="flex items-start gap-2 pl-6 text-caption text-muted-foreground">
						<Info aria-hidden size={14} className="mt-0.5 shrink-0 text-info" />
						<span className="min-w-0 flex-1">{UNDO_CONFLICT}</span>
					</p>
				) : null}
				{undoable ? (
					<div className="flex pl-6 sm:hidden">
						<UndoButton block={block} onUndo={onUndo} className="-ml-2" />
					</div>
				) : null}
			</div>
		</Panel>
	)
}
