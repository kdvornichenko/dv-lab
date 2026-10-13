'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { CircleAlert, Info, RefreshCw, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { MarkdownView } from '@/components/app/markdown-view'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { formatDayMonth, formatTime, formatWhen, yearInZone } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import type {
	LessonComment,
	LessonCommentResponse,
	LessonCommentsResponse,
	ScheduleOccurrenceRef,
} from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'

type CommentsState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; comments: LessonComment[] }

export function commentsPath(ref: ScheduleOccurrenceRef): string {
	return ref.kind === 'single'
		? `/schedule/lessons/${ref.lessonId}/comments`
		: `/schedule/series/${ref.seriesId}/occurrences/${ref.originalOn}/comments`
}

async function readComments(path: string): Promise<CommentsState> {
	const result = await apiRequest<LessonCommentsResponse>('GET', path)
	return result.ok ? { kind: 'ready', comments: result.data.comments } : { kind: 'error' }
}

function CommentsLoading() {
	return (
		<div role="status" aria-label="Loading comments" className="flex flex-col gap-2 pt-2">
			<Skeleton className="h-3.5 w-[80%]" />
			<Skeleton className="h-3.5 w-[55%]" />
		</div>
	)
}

function CommentsReadError({ onReload }: { onReload: () => Promise<void> }) {
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
				Could not load the comments.
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

interface CommentRowProps {
	comment: LessonComment
	mainTimeZone: string
	currentYear: number
	removing: boolean
	onRemove: (comment: LessonComment) => void
}

function CommentRow({ comment, mainTimeZone, currentYear, removing, onRemove }: CommentRowProps) {
	const created = new Date(comment.createdAt)
	return (
		<li
			className={cn(
				'flex flex-col gap-1.5 border-t border-border py-2.5 first:border-t-0 md:flex-row md:items-start md:gap-3',
				removing && 'opacity-50'
			)}
		>
			<div className="flex min-w-0 flex-col gap-0.5 md:flex-1">
				<p className="text-caption text-muted-foreground tabular-nums">
					{formatWhen(created, mainTimeZone, currentYear)} {zoneLabel(mainTimeZone, created)}
				</p>
				<div className="w-0 min-w-full">
					<MarkdownView body={comment.body} />
				</div>
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
						data-comment-remove={comment.id}
						aria-label={`Remove comment from ${formatDayMonth(created, mainTimeZone)}, ${formatTime(created, mainTimeZone)}`}
						onClick={() => onRemove(comment)}
					>
						Remove
					</Button>
				)}
			</div>
		</li>
	)
}

interface LessonCommentsProps {
	lessonRef: ScheduleOccurrenceRef
	mainTimeZone: string
	now: Date
}

export function LessonComments({ lessonRef, mainTimeZone, now }: LessonCommentsProps) {
	const toast = useToast()
	const heading = useRef<HTMLParagraphElement>(null)
	const [state, setState] = useState<CommentsState>({ kind: 'loading' })
	const [confirming, setConfirming] = useState<LessonComment | null>(null)
	const [removingId, setRemovingId] = useState<string | null>(null)
	const [conflict, setConflict] = useState(false)
	const path = commentsPath(lessonRef)
	const currentYear = yearInZone(now, mainTimeZone)

	const reload = useCallback(async () => {
		setState(await readComments(path))
	}, [path])

	useEffect(() => {
		let current = true
		void readComments(path).then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [path])

	const entries = state.kind === 'ready' ? [...state.comments].reverse() : []

	async function remove(comment: LessonComment): Promise<boolean> {
		const index = entries.findIndex((item) => item.id === comment.id)
		const next = entries[index + 1] ?? entries[index - 1]
		setConflict(false)
		setRemovingId(comment.id)
		const result = await apiRequest<LessonCommentResponse>('POST', `/schedule/comments/${comment.id}/retract`, {
			expectedRevision: comment.revision,
		})
		if (result.ok) {
			setRemovingId(null)
			setState((previous) =>
				previous.kind === 'ready'
					? { kind: 'ready', comments: previous.comments.filter((item) => item.id !== comment.id) }
					: previous
			)
			toast.show({ title: 'Comment removed', description: 'The lesson and its mark did not change.' })
			requestAnimationFrame(() => {
				const target = next ? document.querySelector<HTMLElement>(`[data-comment-remove="${next.id}"]`) : null
				if (target) target.focus()
				else heading.current?.focus()
			})
			return true
		}
		if (result.status === 409 || result.status === 404) {
			await reload()
			setRemovingId(null)
			setConflict(true)
			return true
		}
		setRemovingId(null)
		return false
	}

	return (
		<section aria-labelledby="lesson-comments-title" className="flex flex-col">
			<p id="lesson-comments-title" ref={heading} tabIndex={-1} className="text-body font-semibold outline-none">
				Comments
			</p>
			{state.kind === 'loading' ? <CommentsLoading /> : null}
			{state.kind === 'error' ? <CommentsReadError onReload={reload} /> : null}
			{state.kind === 'ready' && entries.length === 0 ? (
				<p className="pt-1 text-caption text-muted-foreground">No comments yet. Ask in the chat to add one.</p>
			) : null}
			{entries.length > 0 ? (
				<ul role="list" className="flex flex-col">
					{entries.map((comment) => (
						<CommentRow
							key={comment.id}
							comment={comment}
							mainTimeZone={mainTimeZone}
							currentYear={currentYear}
							removing={removingId === comment.id}
							onRemove={setConfirming}
						/>
					))}
				</ul>
			) : null}
			{conflict ? (
				<div role="status" className="flex items-start gap-2 pt-1">
					<Info size={16} strokeWidth={1.5} aria-hidden className="mt-px shrink-0 text-info" />
					<p className="min-w-0 flex-1 text-caption text-muted-foreground">
						This comment changed after it was added. The list is updated.
					</p>
				</div>
			) : null}
			{confirming ? (
				<ConfirmDialog
					key={confirming.id}
					title="Remove this comment?"
					body="The comment is deleted. The lesson and its mark do not change."
					cancelLabel="Keep comment"
					confirmLabel="Remove comment"
					pendingLabel="Removing…"
					tone="destructive"
					failureText="Could not remove the comment. Try again."
					failureLine
					onConfirm={() => remove(confirming)}
					onClose={() => setConfirming(null)}
				/>
			) : null}
		</section>
	)
}
