'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

import { AnimatePresence } from 'motion/react'
import { useRouter } from 'next/navigation'

import { EmptyLine } from '@/components/app/empty-line'
import { ReadError } from '@/components/app/read-error'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { withoutSearchParams } from '@/lib/arrival-mark'

import {
	CHAT_FOLLOW_UP_TEXT,
	REVIEW_COMMAND_TEXT,
	type ChatClarifyBlock,
	type ChatConversation,
	type ChatReviewOfferBlock,
	type ChatStudentFacts,
} from '@dv-lab/contracts'

import { ChatHeader } from './chat-header'
import { useChatContext } from './chat-provider'
import type { ReviewHandlers } from './chat-review'
import { CommandList } from './command-list'
import { Composer } from './composer'
import { DeleteConversationDialog, RenameConversationDialog } from './conversation-dialogs'
import { ConversationList } from './conversation-list'
import { ConversationRail, RAIL_MIN_WIDTH } from './conversation-rail'
import { type ActiveReply, type CalendarHandlers, type ChangeHandlers, Messages, type ReplyHandlers } from './messages'
import { PanelHeader } from './panel-header'
import { StudentFacts, StudentFactsSkeleton } from './student-facts'
import { useComposerDraft, useMentionStudents, type Draft, type ThreadState } from './use-chat'

type ReadState =
	{ kind: 'loading' } | { kind: 'error' } | { kind: 'missing' } | { kind: 'ready'; facts: ChatStudentFacts }

async function readRecords(studentId: string): Promise<ReadState> {
	const result = await apiRequest<ChatStudentFacts>('GET', `/chat/records?studentId=${encodeURIComponent(studentId)}`)
	if (result.ok) return { kind: 'ready', facts: result.data }
	return result.status === 404 ? { kind: 'missing' } : { kind: 'error' }
}

function StudentRecords({ studentId }: { studentId: string }) {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [refreshing, setRefreshing] = useState(false)
	const requests = useRef(0)

	const load = useCallback(async () => {
		const id = ++requests.current
		const next = await readRecords(studentId)
		if (id === requests.current) setState(next)
	}, [studentId])

	useEffect(() => {
		const counter = requests
		void load()
		return () => {
			counter.current++
		}
	}, [load])

	async function refresh() {
		setRefreshing(true)
		try {
			await load()
		} finally {
			setRefreshing(false)
		}
	}

	if (state.kind === 'loading') return <StudentFactsSkeleton />
	if (state.kind === 'missing') return <EmptyLine text="This student is no longer available." />
	if (state.kind === 'error') {
		return (
			<Banner status="error" aria-busy={refreshing}>
				<BannerTitle>Could not read the student&apos;s records.</BannerTitle>
				<BannerActions>
					<BannerAction disabled={refreshing} onClick={() => void refresh()}>
						{refreshing ? 'Refreshing…' : 'Refresh records'}
					</BannerAction>
				</BannerActions>
			</Banner>
		)
	}
	return <StudentFacts facts={state.facts} />
}

function ThreadSkeleton() {
	return (
		<div role="status" aria-label="Loading messages" className="flex flex-col gap-4">
			<Skeleton className="h-9 w-56 self-end rounded-2xl" />
			<Skeleton className="h-20 w-full rounded-2xl" />
			<Skeleton className="h-9 w-40 self-end rounded-2xl" />
		</div>
	)
}

function Thread({
	state,
	onUndo,
	onChoose,
	onRefresh,
	calendar,
	changes,
	reviews,
	replies,
	active,
	empty,
	onCommand,
}: {
	state: ThreadState
	onUndo: (actionId: string) => void
	onChoose: (block: ChatClarifyBlock, reply: string) => void
	onRefresh: () => void
	calendar: CalendarHandlers
	changes: ChangeHandlers
	reviews: ReviewHandlers
	replies: ReplyHandlers
	active: ActiveReply | null
	empty: boolean
	onCommand: (text: string) => void
}) {
	if (state.kind === 'loading') return <ThreadSkeleton />
	if (state.kind === 'error') return <ReadError screen="this conversation" onRefresh={onRefresh} />
	const messages = state.kind === 'ready' ? state.messages : []
	if (messages.length === 0) {
		return empty ? (
			<div className="flex flex-1 items-center justify-center">
				<CommandList onPick={onCommand} />
			</div>
		) : null
	}
	return (
		<Messages
			messages={messages}
			onUndo={onUndo}
			onChoose={onChoose}
			calendar={calendar}
			changes={changes}
			reviews={reviews}
			replies={replies}
			active={active}
		/>
	)
}

function focusAllChats() {
	const buttons = Array.from(document.querySelectorAll<HTMLElement>('[data-all-chats]'))
	buttons.find((button) => button.offsetParent !== null)?.focus()
}

function focusRow(id: string) {
	document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus()
}

function later(action: () => void) {
	window.setTimeout(action, 60)
}

function useWide(area: RefObject<HTMLDivElement | null>): boolean {
	const [wide, setWide] = useState(false)
	useEffect(() => {
		const node = area.current
		if (!node) return
		const observer = new ResizeObserver(([entry]) => {
			if (entry) setWide(entry.contentRect.width >= RAIL_MIN_WIDTH)
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [area])
	return wide
}

const ASK_NOTICES = {
	unavailable: 'This student is no longer available. Choose a student again.',
	failed: 'Could not open chat for this student. Try again.',
} as const

type AskNotice = keyof typeof ASK_NOTICES

function reviewDraft(student: { id: string; name: string }): Draft {
	const start = REVIEW_COMMAND_TEXT.length + 2
	return {
		text: `${REVIEW_COMMAND_TEXT} @${student.name}`,
		bindings: [{ studentId: student.id, text: student.name, start, end: start + student.name.length }],
		stale: false,
	}
}

export type PanelActions = {
	onClose: () => void
	onOpenInChat: () => void
	onOpenAsPanel?: () => void
	floating?: boolean
}

export function ChatScreen({
	studentId,
	conversationId,
	startNew,
	startReview,
	panel,
}: {
	studentId: string | null
	conversationId: string | null
	startNew: boolean
	startReview: boolean
	panel?: PanelActions
}) {
	const router = useRouter()
	const { chat, composer: sharedComposer } = useChatContext()
	const adopt = chat.adopt
	useEffect(() => {
		if (panel === undefined) adopt(conversationId, startNew)
	}, [panel, adopt, conversationId, startNew])
	const area = useRef<HTMLDivElement>(null)
	const wide = useWide(area)
	const [wasWide, setWasWide] = useState(false)
	const [listChosen, setListOpen] = useState(false)
	if (wide !== wasWide) {
		setWasWide(wide)
		if (wide) setListOpen(false)
	}
	const listOpen = listChosen && !wide
	const [renaming, setRenaming] = useState<ChatConversation | null>(null)
	const [deleting, setDeleting] = useState<ChatConversation | null>(null)
	const conversations = chat.list.kind === 'ready' ? chat.list.conversations : []
	const selected = conversations.find((item) => item.id === chat.selectedId) ?? null
	const liveRenaming = renaming && (conversations.find((item) => item.id === renaming.id) ?? renaming)
	const liveDeleting = deleting && (conversations.find((item) => item.id === deleting.id) ?? deleting)
	const bare =
		panel?.floating === true && chat.thread.kind === 'empty' && studentId === null
	const loadingTitle = chat.selectedId !== null && chat.list.kind === 'loading'
	const ownComposer = useComposerDraft()
	const composer = panel === undefined ? ownComposer : sharedComposer
	const students = useMentionStudents()
	const input = useRef<HTMLTextAreaElement>(null)
	const shownId = useRef(chat.selectedId)
	const [seenNew, setSeenNew] = useState(false)
	const [pendingAsk, setPendingAsk] = useState<string | null>(null)
	const [reviewAsk, setReviewAsk] = useState(false)
	const [reviewStart, setReviewStart] = useState<Draft | null>(null)
	const reviewSent = useRef<Draft | null>(null)
	const [askNotice, setAskNotice] = useState<AskNotice | null>(null)
	const [askFocus, setAskFocus] = useState(0)
	const setDraft = composer.setDraft
	const mentionStudents = students.state

	if (startNew !== seenNew) {
		setSeenNew(startNew)
		if (startNew) {
			setAskNotice(null)
			setDraft({ text: '', bindings: [], stale: false })
			setPendingAsk(studentId)
			setReviewAsk(startReview && studentId !== null)
		}
	}

	if (pendingAsk !== null && mentionStudents.kind !== 'loading') {
		setPendingAsk(null)
		setReviewAsk(false)
		const row =
			mentionStudents.kind === 'ready' ? mentionStudents.rows.find((item) => item.id === pendingAsk) : undefined
		if (reviewAsk) {
			if (row !== undefined) setReviewStart(reviewDraft({ id: row.id, name: row.displayName }))
		} else if (mentionStudents.kind === 'error') setAskNotice('failed')
		else if (row === undefined) setAskNotice('unavailable')
		else {
			const name = row.displayName
			setDraft({
				text: `@${name} `,
				bindings: [{ studentId: row.id, text: name, start: 1, end: 1 + name.length }],
				stale: false,
			})
			setAskFocus((value) => value + 1)
		}
	}

	useEffect(() => {
		if (!startNew) return
		const href = withoutSearchParams(['new', 'c', 'review'])
		if (href !== undefined) router.replace(href, { scroll: false })
		later(() => input.current?.focus())
	}, [startNew, router])

	const sendChat = chat.send

	useEffect(() => {
		if (reviewStart === null || startReview || reviewSent.current === reviewStart) return
		reviewSent.current = reviewStart
		setReviewStart(null)
		void sendChat(reviewStart).then((sent) => {
			if (!sent) setDraft(reviewStart)
		})
	}, [reviewStart, startReview, sendChat, setDraft])

	useEffect(() => {
		if (askFocus === 0) return
		later(() => {
			const field = input.current
			if (!field) return
			field.focus()
			field.setSelectionRange(field.value.length, field.value.length)
		})
	}, [askFocus])

	useEffect(() => {
		if (shownId.current === chat.selectedId) return
		shownId.current = chat.selectedId
		later(() => input.current?.focus())
	}, [chat.selectedId])

	function closeList() {
		setListOpen(false)
		later(focusAllChats)
	}

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== 'Escape' || !listOpen || !event.currentTarget.contains(event.target as Node)) return
		event.stopPropagation()
		closeList()
	}

	function create() {
		setListOpen(false)
		composer.clear()
		chat.newChat()
		later(() => input.current?.focus())
	}

	async function send() {
		if (await chat.send(composer.draft)) {
			composer.clear()
			setAskNotice(null)
		}
		later(() => input.current?.focus())
	}

	function command(text: string) {
		composer.setDraft({ text, bindings: [], stale: false })
		later(() => {
			const field = input.current
			if (!field) return
			field.setSelectionRange(text.length, text.length)
			field.focus()
		})
	}

	async function sendCommand(draft: Draft): Promise<boolean> {
		if (await chat.send(draft)) return true
		composer.setDraft(draft)
		later(() => {
			const field = input.current
			if (!field) return
			field.focus()
			field.setSelectionRange(field.value.length, field.value.length)
		})
		return false
	}

	function followUp(student: { id: string; displayName: string }) {
		const name = student.displayName
		void sendCommand({
			text: `@${name} ${CHAT_FOLLOW_UP_TEXT}`,
			bindings: [{ studentId: student.id, text: name, start: 1, end: 1 + name.length }],
			stale: false,
		})
	}

	async function answerReview(block: ChatReviewOfferBlock, yes: boolean): Promise<boolean> {
		if (!(await chat.answerReview(block.actionId, yes ? 'confirm' : 'decline'))) return false
		if (yes) await sendCommand(reviewDraft({ id: block.studentId, name: block.studentName }))
		return true
	}

	function choose(block: ChatClarifyBlock, reply: string) {
		const name = block.studentName
		composer.setDraft({
			text: `@${name} ${reply}`,
			bindings: [{ studentId: block.studentId, text: name, start: 1, end: 1 + name.length }],
			stale: false,
		})
		later(() => {
			const field = input.current
			if (!field) return
			field.focus()
			field.setSelectionRange(field.value.length, field.value.length)
		})
	}

	return (
		<div ref={area} className="flex min-h-0 flex-1">
			<div
				className={
					panel === undefined
						? 'flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-4 pb-[max(0.75rem,var(--safe-bottom))] md:px-6 md:pb-6'
						: 'flex min-h-0 min-w-0 flex-1 flex-col px-3 pb-3'
				}
			>
				{panel === undefined ? (
					<div className="mx-auto w-full max-w-180 pb-4">
						<ChatHeader
							title={selected?.title ?? 'Chat'}
							loadingTitle={loadingTitle}
							compact={wide}
							listOpen={listOpen}
							onToggleList={() => setListOpen((open) => !open)}
							onCreate={create}
						/>
					</div>
				) : (
					<PanelHeader
						title={selected?.title ?? 'New chat'}
						loadingTitle={loadingTitle}
						listOpen={listOpen}
						disabled={chat.sending}
						onToggleList={() => setListOpen((open) => !open)}
						onCreate={create}
						onOpenInChat={panel.onOpenInChat}
						onOpenAsPanel={panel.onOpenAsPanel}
						onClose={panel.onClose}
					/>
				)}
				<div className="relative flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
					<div inert={listOpen} className="flex min-h-0 flex-1 flex-col gap-3">
						{bare ? null : (
							<ScrollArea
								className={`-mx-3 min-h-0 flex-1 transition-opacity ease-out motion-reduce:transition-none md:-mx-6 ${listOpen ? 'opacity-0 duration-[160ms]' : 'duration-[120ms]'}`}
								viewportClassName="scroll-fade px-3 md:px-6 [&>div]:!min-w-0 [&>div]:flex [&>div]:min-h-full [&>div]:flex-col"
							>
								<div
									role="log"
									aria-label="Messages"
									className="mx-auto flex min-h-full w-full max-w-180 flex-1 flex-col gap-4 pb-2 [&>:first-child]:mt-auto"
								>
									{studentId === null ? null : <StudentRecords key={studentId} studentId={studentId} />}
									<Thread
										state={chat.thread}
										onUndo={(actionId) => void chat.undo(actionId)}
										onChoose={choose}
										onRefresh={chat.reloadThread}
										calendar={{
											onConfirm: (actionId) => void chat.confirmCalendar(actionId),
											onDecline: chat.declineAction,
											onCheck: chat.checkAction,
										}}
										changes={{
											onConfirm: (actionId) => chat.decideChange(actionId, 'confirm'),
											onDecline: (actionId) => chat.decideChange(actionId, 'decline'),
											onRefresh: chat.refreshThread,
											onUndo: chat.undo,
										}}
										reviews={{
											onAnswer: answerReview,
											onRun: (student) => sendCommand(reviewDraft(student)),
											onUndo: chat.undo,
										}}
										replies={{
											onAsk: () => later(() => input.current?.focus()),
											onCheckStatus: chat.checkStatus,
											onFollowUp: (student) => followUp(student),
											onCommand: command,
											busy: chat.sending || chat.reply !== null,
											commandsOff: composer.draft.text !== '' || chat.sending || chat.reply !== null,
										}}
										active={
											chat.reply === null
												? null
												: { messageId: chat.reply.turn.assistantMessageId, stopping: chat.reply.stopping }
										}
										empty={studentId === null}
										onCommand={command}
									/>
								</div>
							</ScrollArea>
						)}
						<div className="mx-auto flex w-full max-w-180 flex-col gap-3">
							{askNotice === null ? null : (
								<Banner status="error">
									<BannerTitle>{ASK_NOTICES[askNotice]}</BannerTitle>
								</Banner>
							)}
							{chat.sendFailed ? (
								<Banner status="error">
									<BannerTitle>Could not send the message. Try again.</BannerTitle>
								</Banner>
							) : null}
							<Composer
								draft={composer.draft}
								onDraft={composer.setDraft}
								onType={composer.type}
								students={students.state}
								onRetryStudents={students.retry}
								disabled={listOpen || chat.sending}
								sending={chat.sending}
								onSend={() => void send()}
								replying={chat.reply !== null}
								stopping={chat.reply?.stopping ?? false}
								onStop={() => void chat.stop()}
								inputRef={input}
								models={chat.models}
							/>
						</div>
					</div>
					<div className="absolute inset-x-0 top-0 mx-auto max-w-180">
						<AnimatePresence>
							{listOpen ? (
								<ConversationList
									state={chat.list}
									selectedId={chat.selectedId}
									onSelect={(id) => {
										chat.select(id)
										setListOpen(false)
									}}
									onRename={setRenaming}
									onDelete={setDeleting}
									onRefresh={() => void chat.reload()}
								/>
							) : null}
						</AnimatePresence>
					</div>
				</div>
			</div>
			{wide && panel === undefined ? (
				<ConversationRail
					state={chat.list}
					selectedId={chat.selectedId}
					onSelect={chat.select}
					onRename={setRenaming}
					onDelete={setDeleting}
					onRefresh={() => void chat.reload()}
					onCreate={create}
				/>
			) : null}
			{liveRenaming ? (
				<RenameConversationDialog
					key={liveRenaming.id}
					conversation={liveRenaming}
					onSave={(title) => chat.rename(liveRenaming, title)}
					onClose={() => {
						setRenaming(null)
						later(() => focusRow(liveRenaming.id))
					}}
				/>
			) : null}
			{liveDeleting ? (
				<DeleteConversationDialog
					conversation={liveDeleting}
					onDelete={() => chat.remove(liveDeleting)}
					onClose={(deleted) => {
						setDeleting(null)
						later(deleted ? focusAllChats : () => focusRow(liveDeleting.id))
					}}
				/>
			) : null}
		</div>
	)
}
