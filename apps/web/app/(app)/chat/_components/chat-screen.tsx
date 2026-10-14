'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react'

import { AnimatePresence } from 'framer-motion'

import { EmptyLine } from '@/components/app/empty-line'
import { ReadError } from '@/components/app/read-error'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'

import type { ChatClarifyBlock, ChatConversation, ChatStudentFacts } from '@dv-lab/contracts'

import { ChatHeader } from './chat-header'
import { CommandList } from './command-list'
import { Composer } from './composer'
import { DeleteConversationDialog, RenameConversationDialog } from './conversation-dialogs'
import { ConversationList } from './conversation-list'
import { ConversationRail, RAIL_MIN_WIDTH } from './conversation-rail'
import { type ActiveReply, type CalendarHandlers, type ChangeHandlers, Messages, type ReplyHandlers } from './messages'
import { StudentFacts, StudentFactsSkeleton } from './student-facts'
import { useChat, useComposerDraft, useMentionStudents, type ThreadState } from './use-chat'

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

export function ChatScreen({ studentId, conversationId }: { studentId: string | null; conversationId: string | null }) {
	const chat = useChat(conversationId)
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
	const loadingTitle = chat.selectedId !== null && chat.list.kind === 'loading'
	const composer = useComposerDraft()
	const students = useMentionStudents()
	const input = useRef<HTMLTextAreaElement>(null)
	const shownId = useRef(chat.selectedId)

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
		if (await chat.send(composer.draft)) composer.clear()
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
			<div className="flex min-h-0 min-w-0 flex-1 flex-col px-3 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6">
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
				<div className="relative flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
					<div inert={listOpen} className="flex min-h-0 flex-1 flex-col gap-3">
						<ScrollArea
							className={`-mx-3 min-h-0 flex-1 transition-opacity ease-out motion-reduce:transition-none md:-mx-6 ${listOpen ? 'opacity-0 duration-[160ms]' : 'duration-[120ms]'}`}
							viewportClassName="scroll-fade px-3 md:px-6 [&>div]:!min-w-0 [&>div]:flex [&>div]:min-h-full [&>div]:flex-col [&>div]:justify-end"
						>
							<div
								role="log"
								aria-label="Messages"
								className="mx-auto flex min-h-full w-full max-w-180 flex-1 flex-col justify-end gap-4 pb-2"
							>
								{studentId === null ? null : <StudentRecords key={studentId} studentId={studentId} />}
								<Thread
									state={chat.thread}
									onUndo={(actionId) => void chat.undo(actionId)}
									onChoose={choose}
									onRefresh={chat.reloadThread}
									calendar={{
										onConfirm: (actionId) => void chat.confirmCalendar(actionId),
										onCheck: chat.checkCalendar,
									}}
									changes={{
										onConfirm: (actionId) => chat.decideChange(actionId, 'confirm'),
										onDecline: (actionId) => chat.decideChange(actionId, 'decline'),
										onRefresh: chat.refreshThread,
									}}
									replies={{
										onAsk: () => later(() => input.current?.focus()),
										onCheckStatus: chat.checkStatus,
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
						<div className="mx-auto flex w-full max-w-180 flex-col gap-3">
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
			{wide ? (
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
