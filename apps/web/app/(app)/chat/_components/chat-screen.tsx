'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { AnimatePresence } from 'framer-motion'
import { List, Plus } from 'lucide-react'

import { EmptyLine } from '@/components/app/empty-line'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'

import type { ChatConversation, ChatStudentFacts } from '@dv-lab/contracts'

import { Composer } from './composer'
import { DeleteConversationDialog, RenameConversationDialog } from './conversation-dialogs'
import { ConversationList } from './conversation-list'
import { StudentFacts, StudentFactsSkeleton } from './student-facts'
import { useChat, useComposerDraft, useMentionStudents } from './use-chat'

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

function ChatHeader({
	title,
	loadingTitle,
	listOpen,
	creating,
	onToggleList,
	onCreate,
}: {
	title: string
	loadingTitle: boolean
	listOpen: boolean
	creating: boolean
	onToggleList: () => void
	onCreate: () => void
}) {
	return (
		<header className="flex h-12 items-center gap-2">
			{loadingTitle ? (
				<h1 className="min-w-0 flex-1" aria-label="Chat">
					<Skeleton className="h-5 w-40" />
				</h1>
			) : (
				<h1 className="min-w-0 flex-1 truncate text-subtitle font-semibold text-foreground" title={title}>
					{title}
				</h1>
			)}
			<Button
				data-all-chats=""
				variant="ghost"
				size="compact"
				leadingIcon={List}
				active={listOpen}
				aria-expanded={listOpen}
				className="max-md:hidden"
				onClick={onToggleList}
			>
				All chats
			</Button>
			<Button
				data-all-chats=""
				variant="ghost"
				size="icon-compact"
				active={listOpen}
				aria-expanded={listOpen}
				aria-label="All chats"
				className="w-9 md:hidden"
				onClick={onToggleList}
			>
				<List />
			</Button>
			<Button
				variant="tertiary"
				size="compact"
				leadingIcon={Plus}
				loading={creating}
				className="max-md:hidden"
				onClick={onCreate}
			>
				New chat
			</Button>
			<Button
				variant="tertiary"
				size="icon-compact"
				loading={creating}
				aria-label="New chat"
				className="w-9 md:hidden"
				onClick={onCreate}
			>
				<Plus />
			</Button>
		</header>
	)
}

export function ChatScreen({ studentId, conversationId }: { studentId: string | null; conversationId: string | null }) {
	const chat = useChat(conversationId)
	const [listOpen, setListOpen] = useState(false)
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
		void chat.create()
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col px-3 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-6">
			<div className="mx-auto flex min-h-0 w-full max-w-180 flex-1 flex-col gap-4">
				<ChatHeader
					title={selected?.title ?? 'Chat'}
					loadingTitle={loadingTitle}
					listOpen={listOpen}
					creating={chat.creating}
					onToggleList={() => setListOpen((open) => !open)}
					onCreate={create}
				/>
				{chat.createFailed ? (
					<Banner status="error">
						<BannerTitle>Could not create a chat. Try again.</BannerTitle>
					</Banner>
				) : null}
				<div className="relative flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
					<div inert={listOpen} className="flex min-h-0 flex-1 flex-col gap-3">
						<ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade [&>div]:!min-w-0">
							<div role="log" aria-label="Messages" className="flex flex-col gap-4 pb-2">
								{studentId === null ? (
									<EmptyLine text="What do you want to ask?" />
								) : (
									<StudentRecords key={studentId} studentId={studentId} />
								)}
							</div>
						</ScrollArea>
						<Composer
							draft={composer.draft}
							onDraft={composer.setDraft}
							onType={composer.type}
							students={students.state}
							onRetryStudents={students.retry}
							disabled={listOpen}
							inputRef={input}
						/>
					</div>
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
