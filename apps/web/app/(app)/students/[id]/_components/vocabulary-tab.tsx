'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'

import { BookOpen, Pencil, Plus, Trash2, Undo2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/app/confirm-dialog'
import { EmptyState } from '@/components/app/empty-state'
import { ReadError } from '@/components/app/read-error'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest } from '@/lib/api-client'
import { Elevated } from '@/lib/elevated'
import { formatDay, yearInZone } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import {
	studentBlocksResponse,
	type StudentDetail,
	type StudentTerm,
	type StudentTermResponse,
	type StudentTermsResponse,
} from '@dv-lab/contracts'

import { useToast } from '../../../_components/toasts'
import { ReviewStamp, ReviewStampLoading } from './review-stamp'
import { AddTermDialog, EditNoteDialog } from './term-dialogs'

type View = 'words' | 'removed'

type ReadState =
	| { kind: 'loading' }
	| { kind: 'error' }
	| { kind: 'ready'; words: StudentTerm[]; removed: StudentTerm[]; reviewedAt: string | null }

function newestFirst(terms: StudentTerm[]): StudentTerm[] {
	return [...terms].sort(
		(left, right) => right.createdAt.localeCompare(left.createdAt) || left.term.localeCompare(right.term)
	)
}

async function readTerms(studentId: string): Promise<ReadState> {
	const [words, removed, blocks] = await Promise.all([
		apiRequest<StudentTermsResponse>('GET', `/students/${studentId}/terms`),
		apiRequest<StudentTermsResponse>('GET', `/students/${studentId}/terms?view=removed`),
		apiRequest<unknown>('GET', `/students/${studentId}/blocks`),
	])
	if (!words.ok || !removed.ok || !blocks.ok) return { kind: 'error' }
	const review = studentBlocksResponse.safeParse(blocks.data)
	if (!review.success) return { kind: 'error' }
	return {
		kind: 'ready',
		words: newestFirst(words.data.terms),
		removed: removed.data.terms,
		reviewedAt: review.data.reviewedAt,
	}
}

const GRID =
	'grid items-start gap-x-4 grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(8rem,1fr)_minmax(10rem,2fr)_11rem_6.5rem]'

const SOURCE_WORDS = { chat: 'Added in chat', review: 'Added by review' } as const
const SOURCE_REMOVED = { chat: 'Removed in chat', review: 'Removed by review' } as const

function addedSource(term: StudentTerm): string | null {
	return term.addedBy === 'chat' || term.addedBy === 'review' ? SOURCE_WORDS[term.addedBy] : null
}

function removedSource(term: StudentTerm): string | null {
	return term.removedBy === 'chat' || term.removedBy === 'review' ? SOURCE_REMOVED[term.removedBy] : null
}

function Head({ dateTitle }: { dateTitle: string }) {
	return (
		<div
			aria-hidden
			data-slot="vocabulary-head"
			className={cn(GRID, 'hidden px-4 pt-3 pb-1 text-caption text-muted-foreground sm:grid')}
		>
			<span>Word</span>
			<span>Meaning</span>
			<span>{dateTitle}</span>
			<span />
		</div>
	)
}

interface RowFrameProps {
	term: StudentTerm
	muted?: boolean
	date: string
	source: string | null
	actions: React.ReactNode
	actionsBelow?: boolean
	error?: string
}

function RowFrame({ term, muted, date, source, actions, actionsBelow, error }: RowFrameProps) {
	const hasNote = Boolean(term.note)
	const dateRow = hasNote ? 'max-sm:row-start-3' : 'max-sm:row-start-2'
	const actionsClassName = !actionsBelow
		? 'max-sm:col-start-2 max-sm:row-start-1'
		: hasNote
			? 'max-sm:col-span-2 max-sm:row-start-4 max-sm:justify-start'
			: 'max-sm:col-span-2 max-sm:row-start-3 max-sm:justify-start'
	return (
		<li
			data-slot="vocabulary-row"
			data-term-id={term.id}
			className={cn(GRID, 'gap-y-1 border-b border-border px-4 py-3 text-body last:border-b-0 sm:py-2')}
		>
			<span
				className={cn(
					'min-w-0 font-medium wrap-anywhere max-sm:col-start-1 max-sm:row-start-1',
					muted && 'text-muted-foreground'
				)}
			>
				{term.term}
			</span>
			<span className="min-w-0 wrap-anywhere whitespace-pre-line text-muted-foreground empty:hidden max-sm:col-span-2 max-sm:row-start-2 sm:empty:block">
				{term.note}
			</span>
			<div
				className={cn(
					'flex min-w-0 flex-wrap items-baseline gap-x-1 text-micro text-muted-foreground tabular-nums max-sm:col-span-2 sm:flex-col sm:gap-x-0 sm:text-body sm:text-foreground',
					dateRow
				)}
			>
				<span>{date}</span>
				{source ? (
					<Fragment>
						<span aria-hidden className="sm:hidden">
							·
						</span>
						<span className="text-micro text-muted-foreground">{source}</span>
					</Fragment>
				) : null}
			</div>
			<div className={cn('flex justify-end gap-1', actionsClassName)}>{actions}</div>
			{error ? (
				<p role="alert" className="col-span-2 text-caption text-destructive sm:col-span-4">
					{error}
				</p>
			) : null}
		</li>
	)
}

function LoadingList() {
	return (
		<Elevated offset={1} shadowLevel={2} className="rounded-2xl" data-slot="vocabulary-loading">
			<div className="flex flex-col gap-3.5 px-4 py-3">
				{['w-full', 'w-[90%]', 'w-[96%]', 'w-4/5'].map((width) => (
					<Skeleton key={width} className={cn('h-3', width)} />
				))}
			</div>
		</Elevated>
	)
}

interface VocabularyTabProps {
	student: StudentDetail
	timeZone: string
	asOf: string
}

export function VocabularyTab({ student, timeZone, asOf }: VocabularyTabProps) {
	const toast = useToast()
	const studentId = student.id
	const year = yearInZone(new Date(asOf), timeZone)
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [view, setView] = useState<View>('words')
	const [adding, setAdding] = useState(false)
	const [editing, setEditing] = useState<StudentTerm | null>(null)
	const [removing, setRemoving] = useState<StudentTerm | null>(null)
	const [restoring, setRestoring] = useState<string | null>(null)
	const [restoreErrors, setRestoreErrors] = useState<Record<string, string>>({})
	const addButton = useRef<HTMLButtonElement>(null)
	const removedTab = useRef<HTMLButtonElement>(null)

	const load = useCallback(async () => {
		setState(await readTerms(studentId))
	}, [studentId])

	useEffect(() => {
		let current = true
		void readTerms(studentId).then((next) => {
			if (current) setState(next)
		})
		return () => {
			current = false
		}
	}, [studentId])

	function focusAfter(id?: string) {
		requestAnimationFrame(() => {
			const target = (id ? document.getElementById(id) : null) ?? addButton.current
			target?.focus()
		})
	}

	async function remove(term: StudentTerm) {
		const result = await apiRequest<undefined>('DELETE', `/students/${studentId}/terms/${term.id}`)
		if (!result.ok) {
			if (result.status === 404) void load()
			return false
		}
		toast.show({ title: 'Term deleted', description: `${term.term} was removed.` })
		await load()
		return true
	}

	async function restore(term: StudentTerm, next: StudentTerm | undefined) {
		if (restoring !== null || state.kind !== 'ready') return
		setRestoring(term.id)
		setRestoreErrors((current) => {
			const rest = { ...current }
			delete rest[term.id]
			return rest
		})
		const result = await apiRequest<StudentTermResponse>('POST', `/students/${studentId}/terms/${term.id}/restore`)
		setRestoring(null)
		if (!result.ok) {
			const code = result.error?.code
			const message =
				result.status === 409 && code === 'term_exists'
					? 'This word is already in Words.'
					: result.status === 404
						? 'This word is no longer here.'
						: 'Could not restore the word. Try again.'
			setRestoreErrors((current) => ({ ...current, [term.id]: message }))
			if (result.status === 404) void load()
			return
		}
		const restored = result.data.term
		setState((current) =>
			current.kind === 'ready'
				? {
						...current,
						words: newestFirst([...current.words.filter((item) => item.id !== restored.id), restored]),
						removed: current.removed.filter((item) => item.id !== term.id),
					}
				: current
		)
		requestAnimationFrame(() => {
			const target = next ? document.getElementById(`restore-term-${next.id}`) : removedTab.current
			target?.focus()
		})
	}

	if (state.kind === 'error') return <ReadError screen="vocabulary" onRefresh={load} />

	const words = state.kind === 'ready' ? state.words : null
	const removed = state.kind === 'ready' ? state.removed : null
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				{state.kind === 'ready' ? (
					<ReviewStamp reviewedAt={state.reviewedAt} timeZone={timeZone} now={new Date(asOf)} />
				) : (
					<ReviewStampLoading />
				)}
				<Button ref={addButton} variant="secondary" leadingIcon={Plus} onClick={() => setAdding(true)}>
					Add term
				</Button>
			</div>
			<Tabs value={view} onValueChange={(next) => setView(next as View)} className="flex flex-col gap-4">
				<TabsList aria-label="Vocabulary views" className="self-start">
					<TabItem value="words" label={words === null ? 'Words …' : `Words ${words.length}`} />
					<TabItem
						ref={removedTab}
						value="removed"
						label={removed === null ? 'Removed …' : `Removed ${removed.length}`}
					/>
				</TabsList>
				<TabPanel value="words">
					{words === null ? (
						<LoadingList />
					) : words.length === 0 ? (
						<Elevated offset={1} shadowLevel={2} className="rounded-2xl">
							<EmptyState
								icon={BookOpen}
								title="No words yet"
								description="Ask the assistant in the chat to add the words from a lesson."
							/>
						</Elevated>
					) : (
						<Elevated offset={1} shadowLevel={2} className="rounded-2xl" data-slot="vocabulary-words">
							<Head dateTitle="Added" />
							<ul className="flex flex-col">
								{words.map((term) => (
									<RowFrame
										key={term.id}
										term={term}
										date={formatDay(new Date(term.createdAt), timeZone, year)}
										source={addedSource(term)}
										actions={
											<>
												<Tooltip content="Edit note">
													<Button
														id={`edit-term-${term.id}`}
														variant="ghost"
														size="icon-compact"
														aria-label={`Edit note for ${term.term}`}
														onClick={() => setEditing(term)}
													>
														<Pencil />
													</Button>
												</Tooltip>
												<Tooltip content="Delete term">
													<Button
														id={`delete-term-${term.id}`}
														variant="ghost"
														size="icon-compact"
														aria-label={`Delete ${term.term}`}
														onClick={() => setRemoving(term)}
													>
														<Trash2 />
													</Button>
												</Tooltip>
											</>
										}
									/>
								))}
							</ul>
						</Elevated>
					)}
				</TabPanel>
				<TabPanel value="removed">
					{removed === null ? (
						<LoadingList />
					) : removed.length === 0 ? (
						<Elevated offset={1} shadowLevel={2} className="rounded-2xl">
							<EmptyState
								icon={Trash2}
								title="Nothing removed"
								description="Words the assistant removes stay here for 30 days."
							/>
						</Elevated>
					) : (
						<Elevated offset={1} shadowLevel={2} className="rounded-2xl" data-slot="vocabulary-removed">
							<Head dateTitle="Removed" />
							<ul className="flex flex-col">
								{removed.map((term, index) => (
									<RowFrame
										key={term.id}
										term={term}
										muted
										date={formatDay(new Date(term.removedAt ?? term.createdAt), timeZone, year)}
										source={removedSource(term)}
										error={restoreErrors[term.id]}
										actionsBelow
										actions={
											<Button
												id={`restore-term-${term.id}`}
												variant="ghost"
												size="compact"
												leadingIcon={Undo2}
												aria-label={`Restore ${term.term}`}
												loading={restoring === term.id}
												disabled={restoring !== null && restoring !== term.id}
												onClick={() => void restore(term, removed[index + 1] ?? removed[index - 1])}
											>
												Restore
											</Button>
										}
									/>
								))}
							</ul>
						</Elevated>
					)}
				</TabPanel>
			</Tabs>
			{adding ? (
				<AddTermDialog
					student={student}
					onClose={() => {
						setAdding(false)
						focusAfter()
					}}
					onAdded={() => {
						setAdding(false)
						setView('words')
						void load()
						focusAfter()
					}}
				/>
			) : null}
			{editing ? (
				<EditNoteDialog
					student={student}
					term={editing}
					onClose={() => {
						setEditing(null)
						focusAfter(`edit-term-${editing.id}`)
					}}
					onSaved={() => {
						setEditing(null)
						void load()
						focusAfter(`edit-term-${editing.id}`)
					}}
				/>
			) : null}
			{removing ? (
				<ConfirmDialog
					title={`Delete "${removing.term}"?`}
					body="The term and its note are removed from this card."
					cancelLabel="Keep term"
					confirmLabel="Delete term"
					pendingLabel="Deleting…"
					tone="destructive"
					failureText="Could not delete the term. Try again."
					onConfirm={() => remove(removing)}
					onClose={() => {
						setRemoving(null)
						focusAfter(`delete-term-${removing.id}`)
					}}
				/>
			) : null}
		</div>
	)
}
