'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import { useCalendarController } from '@/components/app/calendar-command-provider'
import { API_CACHE_INVALIDATED, DATA_CHANGED_CHANNEL, apiEventStream, apiRequest, peekApi } from '@/lib/api-client'

import {
	CHAT_ACTIVE_TURN_STATES,
	chatActionResponse,
	chatConversationReadResponse,
	chatStreamEvent,
	chatTurnResponse,
	sendMessageResponse,
	studentLessonOptionsResponse,
	undoResponse,
	type AssistantSettingsResponse,
	type ChatActionResultBlock,
	type ChatCalendarProposalBlock,
	type ChatChangeProposalBlock,
	type ChatConversation,
	type ChatConversationListItem,
	type ChatConversationResponse,
	type ChatConversationsResponse,
	type ChatMessage,
	type ChatNoteChangeBlock,
	type ChatReviewOfferBlock,
	type ChatReviewResultBlock,
	type ChatStep,
	type ChatStreamEvent,
	type ChatEffort,
	type ChatTurn,
	type ChatUndoState,
	type ConversationModelRequest,
	type DeleteConversationRequest,
	type MentionBinding,
	type RenameConversationRequest,
	type SendMessageRequest,
	type StudentLessonOption,
	type UndoRequest,
} from '@dv-lab/contracts'

export type MentionStudents = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; rows: StudentLessonOption[] }

export type Draft = { text: string; bindings: MentionBinding[]; stale: boolean }

const EMPTY_DRAFT: Draft = { text: '', bindings: [], stale: false }

function searchKey(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase()
}

export function matchStudents(rows: readonly StudentLessonOption[], query: string): StudentLessonOption[] {
	const key = searchKey(query.trim())
	return rows.filter((row) => searchKey(row.displayName).includes(key))
}

export function tokenStart(text: string, binding: MentionBinding): number {
	return binding.start > 0 && text[binding.start - 1] === '@' ? binding.start - 1 : binding.start
}

function shifted(binding: MentionBinding, delta: number): MentionBinding {
	return { ...binding, start: binding.start + delta, end: binding.end + delta }
}

export function editDraft(draft: Draft, text: string): Draft {
	const before = draft.text
	const limit = Math.min(before.length, text.length)
	let prefix = 0
	while (prefix < limit && before[prefix] === text[prefix]) prefix++
	let suffix = 0
	while (suffix < limit - prefix && before[before.length - 1 - suffix] === text[text.length - 1 - suffix]) suffix++
	const changedEnd = before.length - suffix
	const delta = text.length - before.length
	let stale = draft.stale
	const bindings: MentionBinding[] = []
	for (const binding of draft.bindings) {
		if (binding.end <= prefix) bindings.push(binding)
		else if (tokenStart(before, binding) >= changedEnd) bindings.push(shifted(binding, delta))
		else stale = true
	}
	return { text, bindings, stale: text.trim() === '' ? false : stale }
}

function replaceRange(draft: Draft, from: number, to: number, insert: string): Draft {
	const delta = insert.length - (to - from)
	return {
		...draft,
		text: `${draft.text.slice(0, from)}${insert}${draft.text.slice(to)}`,
		bindings: draft.bindings
			.filter((binding) => binding.end <= from || tokenStart(draft.text, binding) >= to)
			.map((binding) => (binding.end <= from ? binding : shifted(binding, delta))),
	}
}

export function insertMention(draft: Draft, from: number, to: number, student: StudentLessonOption) {
	const name = student.displayName
	const next = replaceRange(draft, from, to, `@${name} `)
	const binding: MentionBinding = { studentId: student.id, text: name, start: from + 1, end: from + 1 + name.length }
	return {
		draft: {
			text: next.text,
			bindings: [...next.bindings, binding].sort((left, right) => left.start - right.start),
			stale: false,
		},
		caret: from + name.length + 2,
	}
}

export function removeToken(draft: Draft, binding: MentionBinding) {
	const from = tokenStart(draft.text, binding)
	return { draft: replaceRange(draft, from, binding.end, ''), caret: from }
}

export function replaceText(draft: Draft, from: number, to: number, insert: string) {
	return { draft: replaceRange(draft, from, to, insert), caret: from + insert.length }
}

export function useComposerDraft() {
	const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
	const type = useCallback((text: string) => setDraft((current) => editDraft(current, text)), [])
	return { draft, setDraft, type, clear: () => setDraft(EMPTY_DRAFT) }
}

async function readMentionStudents(): Promise<MentionStudents> {
	const response = await apiRequest<unknown>('GET', '/students/options')
	if (!response.ok) return { kind: 'error' }
	const parsed = studentLessonOptionsResponse.safeParse(response.data)
	return parsed.success ? { kind: 'ready', rows: parsed.data.students } : { kind: 'error' }
}

export function useMentionStudents() {
	const [state, setState] = useState<MentionStudents>({ kind: 'loading' })
	const requests = useRef(0)
	const load = useCallback(() => {
		const id = ++requests.current
		setState({ kind: 'loading' })
		void readMentionStudents().then((next) => {
			if (id === requests.current) setState(next)
		})
	}, [])
	useEffect(() => {
		const counter = requests
		const id = ++counter.current
		void readMentionStudents().then((next) => {
			if (id === counter.current) setState(next)
		})
		return () => {
			counter.current++
		}
	}, [])
	return { state, retry: load }
}

export type ConversationListState =
	{ kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; conversations: ChatConversationListItem[] }

export type RenameOutcome = 'saved' | 'gone' | 'failed'

export type DeleteOutcome = 'deleted' | 'busy' | 'failed'

function selectionHref(id: string | null): string {
	const url = new URL(window.location.href)
	if (id === null) url.searchParams.delete('c')
	else url.searchParams.set('c', id)
	return `${url.pathname}${url.search}${url.hash}`
}

function latestConversation(conversations: readonly ChatConversationListItem[]): ChatConversationListItem | null {
	let latest: ChatConversationListItem | null = null
	for (const item of conversations) if (latest === null || item.updatedAt > latest.updatedAt) latest = item
	return latest
}

export type ThreadState =
	{ kind: 'empty' } | { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; messages: ChatMessage[] }

type Thread = { conversationId: string | null; state: ThreadState }

type Pending = { requestId: string; conversationId: string; text: string; mentions: string }

const EMPTY_THREAD: Thread = { conversationId: null, state: { kind: 'empty' } }

export type Reply = { conversationId: string; turn: ChatTurn; stopping: boolean }

type Stream = { turnId: string; controller: AbortController; seq: number }

const ACTIVE_TURN: readonly string[] = CHAT_ACTIVE_TURN_STATES
const RECONNECTS = 5
const NEW_CHAT_TITLE = 'New chat'
const TITLE_CHECK_DELAYS = [1500, 5000] as const
const TITLED_ISSUES: readonly (string | null)[] = [null, 'max_tokens', 'request_limit']

export function turnActive(turn: ChatTurn): boolean {
	return ACTIVE_TURN.includes(turn.state)
}

async function readThread(conversationId: string): Promise<{ state: ThreadState; turn: ChatTurn | null }> {
	const result = await apiRequest<unknown>('GET', `/chat/conversations/${conversationId}`)
	if (!result.ok) return { state: { kind: 'error' }, turn: null }
	const parsed = chatConversationReadResponse.safeParse(result.data)
	return parsed.success
		? { state: { kind: 'ready', messages: parsed.data.messages }, turn: parsed.data.turn }
		: { state: { kind: 'error' }, turn: null }
}

function withMessage(messages: readonly ChatMessage[], next: ChatMessage): ChatMessage[] {
	return messages.some((message) => message.id === next.id)
		? messages.map((message) => (message.id === next.id ? next : message))
		: [...messages, next]
}

function changeMessage(
	messages: readonly ChatMessage[],
	id: string,
	change: (message: ChatMessage) => ChatMessage
): ChatMessage[] {
	return messages.map((message) => (message.id === id ? change(message) : message))
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		const timer = window.setTimeout(resolve, ms)
		signal.addEventListener(
			'abort',
			() => {
				window.clearTimeout(timer)
				resolve()
			},
			{ once: true }
		)
	})
}

function withStep(steps: readonly ChatStep[], next: ChatStep): ChatStep[] {
	return steps.some((step) => step.id === next.id)
		? steps.map((step) => (step.id === next.id ? next : step))
		: [...steps, next]
}

function mergeMessages(current: readonly ChatMessage[], added: readonly ChatMessage[]): ChatMessage[] {
	const known = new Set(current.map((message) => message.id))
	return [...current, ...added.filter((message) => !known.has(message.id))]
}

type ActionBlock =
	| ChatActionResultBlock
	| ChatCalendarProposalBlock
	| ChatChangeProposalBlock
	| ChatNoteChangeBlock
	| ChatReviewResultBlock
	| ChatReviewOfferBlock

function withBlock(messages: readonly ChatMessage[], next: ActionBlock): ChatMessage[] {
	return messages.map((message) => ({
		...message,
		blocks: message.blocks.map((block) =>
			block.type === next.type && block.actionId === next.actionId ? next : block
		),
	}))
}

function calendarBlock(messages: readonly ChatMessage[], actionId: string): ChatCalendarProposalBlock | null {
	for (const message of messages)
		for (const block of message.blocks)
			if (block.type === 'calendar_proposal' && block.actionId === actionId) return block
	return null
}

function changeBlock(
	messages: readonly ChatMessage[],
	actionId: string
): ChatChangeProposalBlock | ChatNoteChangeBlock | null {
	for (const message of messages)
		for (const block of message.blocks)
			if ((block.type === 'change_proposal' || block.type === 'note_change') && block.actionId === actionId)
				return block
	return null
}

function noteUndoLost(messages: readonly ChatMessage[], actionId: string): ChatMessage[] {
	return messages.map((message) => ({
		...message,
		blocks: message.blocks.map((block) =>
			block.type === 'note_change' && block.actionId === actionId && block.undo === 'available'
				? {
						...block,
						undo: 'unavailable' as const,
						issue: block.target.kind === 'vocabulary' ? ('words_changed' as const) : ('block_changed' as const),
					}
				: block.type === 'review_result' && block.actionId === actionId && block.undo === 'available'
					? { ...block, undo: 'unavailable' as const, issue: 'block_changed' as const }
					: block
		),
	}))
}

function withUndo(messages: readonly ChatMessage[], actionId: string, undo: ChatUndoState): ChatMessage[] {
	return messages.map((message) => ({
		...message,
		blocks: message.blocks.map((block) =>
			(block.type === 'action_result' || block.type === 'calendar_proposal') && block.actionId === actionId
				? { ...block, undo }
				: block
		),
	}))
}

function settled(before: ChatCalendarProposalBlock | null, after: ChatCalendarProposalBlock): boolean {
	return (
		(after.state === 'applied' && before?.state !== 'applied') || (after.undo === 'done' && before?.undo !== 'done')
	)
}

function announceChange() {
	window.dispatchEvent(new Event(API_CACHE_INVALIDATED))
	DATA_CHANGED_CHANNEL?.postMessage('changed')
}

export type AssistantView =
	{ kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: AssistantSettingsResponse }

export type ModelChoice = { model: string | null; effort: ChatEffort | null }

export type ChatModels = {
	assistant: AssistantView
	conversation: ChatConversation | null
	pending: ModelChoice | null
	choose: (choice: ModelChoice) => Promise<boolean>
	refresh: () => void
}

function useAssistantSnapshot() {
	const [view, setView] = useState<AssistantView>({ kind: 'loading' })
	const requests = useRef(0)
	const mounted = useRef(true)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const refresh = useCallback(() => {
		const id = ++requests.current
		void apiRequest<AssistantSettingsResponse>('GET', '/settings/assistant').then((result) => {
			if (id !== requests.current || !mounted.current) return
			if (result.ok) setView({ kind: 'ready', data: result.data })
			else setView((current) => (current.kind === 'ready' ? current : { kind: 'failed' }))
		})
	}, [])
	return { view, refresh }
}

export function useChat(initialConversationId: string | null, options: { startNew: boolean }) {
	const calendar = useCalendarController()
	const router = useRouter()
	const [list, setList] = useState<ConversationListState>(() => {
		const cached = peekApi<ChatConversationsResponse>('/chat/conversations')
		return cached !== null && cached.ok
			? { kind: 'ready', conversations: cached.data.conversations }
			: { kind: 'loading' }
	})
	const listRef = useRef<ConversationListState>(list)
	const [selectedId, setSelectedId] = useState<string | null>(options.startNew ? null : initialConversationId)
	const [startedNew, setStartedNew] = useState(options.startNew)
	const [thread, setThread] = useState<Thread>(EMPTY_THREAD)
	const threadRef = useRef<Thread>(thread)
	const [threadGeneration, setThreadGeneration] = useState(0)
	const [sending, setSending] = useState(false)
	const [sendFailed, setSendFailed] = useState(false)
	const sendingRef = useRef(false)
	const pending = useRef<Pending | null>(null)
	const requests = useRef(0)
	const mounted = useRef(true)
	const [reply, setReplyState] = useState<Reply | null>(null)
	const replyRef = useRef<Reply | null>(null)
	const streamRef = useRef<Stream | null>(null)
	const assistant = useAssistantSnapshot()
	const refreshAssistant = assistant.refresh
	const [pendingChoice, setPendingChoice] = useState<ModelChoice | null>(null)
	const pendingChoiceRef = useRef<ModelChoice | null>(null)

	const commitThread = useCallback((next: Thread) => {
		threadRef.current = next
		setThread(next)
	}, [])

	const updateThread = useCallback((conversationId: string, change: (messages: ChatMessage[]) => ChatMessage[]) => {
		const current = threadRef.current
		if (current.conversationId !== conversationId || current.state.kind !== 'ready') return
		const next: Thread = { conversationId, state: { kind: 'ready', messages: change(current.state.messages) } }
		threadRef.current = next
		setThread(next)
	}, [])

	const commit = useCallback((next: ConversationListState) => {
		listRef.current = next
		setList(next)
	}, [])

	const fetchList = useCallback((silent: boolean): Promise<void> => {
		const id = ++requests.current
		return apiRequest<ChatConversationsResponse>('GET', '/chat/conversations').then((result) => {
			if (id !== requests.current || !mounted.current) return
			const next: ConversationListState | null = result.ok
				? { kind: 'ready', conversations: result.data.conversations }
				: silent
					? null
					: { kind: 'error' }
			if (next === null) return
			listRef.current = next
			setList(next)
		})
	}, [])

	const load = useCallback(
		(silent: boolean) => {
			if (!silent) commit({ kind: 'loading' })
			return fetchList(silent)
		},
		[commit, fetchList]
	)

	useEffect(() => {
		mounted.current = true
		void fetchList(false)
		return () => {
			mounted.current = false
		}
	}, [fetchList])

	const readQuietly = useCallback(async () => {
		const id = requests.current
		const result = await apiRequest<ChatConversationsResponse>('GET', '/chat/conversations')
		if (id !== requests.current || !mounted.current || !result.ok) return
		commit({ kind: 'ready', conversations: result.data.conversations })
	}, [commit])

	const titleWatch = useRef<{ conversationId: string; timer: number } | null>(null)

	const cancelTitleWatch = useCallback((conversationId?: string) => {
		const current = titleWatch.current
		if (current === null || (conversationId !== undefined && current.conversationId !== conversationId)) return
		window.clearTimeout(current.timer)
		titleWatch.current = null
	}, [])

	const hasTitle = useCallback((conversationId: string) => {
		const current = listRef.current
		if (current.kind !== 'ready') return false
		const item = current.conversations.find((conversation) => conversation.id === conversationId)
		return item === undefined || item.title !== NEW_CHAT_TITLE
	}, [])

	const watchTitle = useCallback(
		(conversationId: string) => {
			cancelTitleWatch()
			if (hasTitle(conversationId)) return
			const watch = { conversationId, timer: 0 }
			titleWatch.current = watch
			const schedule = (step: number) => {
				watch.timer = window.setTimeout(() => {
					void readQuietly().then(() => {
						if (titleWatch.current !== watch || !mounted.current) return
						if (hasTitle(conversationId) || step + 1 >= TITLE_CHECK_DELAYS.length) {
							titleWatch.current = null
							return
						}
						schedule(step + 1)
					})
				}, TITLE_CHECK_DELAYS[step])
			}
			schedule(0)
		},
		[cancelTitleWatch, hasTitle, readQuietly]
	)

	const select = useCallback(
		(id: string | null) => {
			setSelectedId(id)
			router.replace(selectionHref(id), { scroll: false })
		},
		[router]
	)

	const known =
		list.kind !== 'ready' || selectedId === null || list.conversations.some((item) => item.id === selectedId)
	const fallbackId =
		list.kind === 'ready' && !startedNew && (selectedId === null || !known)
			? (latestConversation(list.conversations)?.id ?? null)
			: null
	const activeId = fallbackId ?? (known ? selectedId : null)

	useEffect(() => {
		if (fallbackId !== null) router.replace(selectionHref(fallbackId), { scroll: false })
		else if (!known) router.replace(selectionHref(null), { scroll: false })
	}, [fallbackId, known, router])

	const setReply = useCallback((next: Reply | null) => {
		replyRef.current = next
		setReplyState(next)
	}, [])

	const unfollow = useCallback(() => {
		streamRef.current?.controller.abort()
		streamRef.current = null
		setReply(null)
	}, [setReply])

	const mergeThread = useCallback(
		async (conversationId: string) => {
			const read = await readThread(conversationId)
			if (!mounted.current || read.state.kind !== 'ready') return
			const fresh = read.state.messages
			updateThread(conversationId, (messages) => mergeMessages(messages, fresh))
		},
		[updateThread]
	)

	const apply = useCallback(
		(conversationId: string, stream: Stream, event: ChatStreamEvent) => {
			if (event.type === 'heartbeat') return
			if (event.type === 'snapshot') {
				stream.seq = event.seq
				const message = event.message
				if (message !== null) updateThread(conversationId, (messages) => withMessage(messages, message))
			} else if (event.type === 'state') {
				const message = event.message
				if (message) updateThread(conversationId, (messages) => withMessage(messages, message))
			} else if (event.type === 'text' || event.type === 'block' || event.type === 'step') {
				if (event.seq <= stream.seq) return
				stream.seq = event.seq
				if (event.type === 'text') {
					updateThread(conversationId, (messages) =>
						changeMessage(messages, event.messageId, (message) => ({ ...message, body: message.body + event.text }))
					)
				} else if (event.type === 'step') {
					updateThread(conversationId, (messages) =>
						changeMessage(messages, event.messageId, (message) => ({
							...message,
							steps: withStep(message.steps, event.step),
						}))
					)
				} else {
					updateThread(conversationId, (messages) =>
						changeMessage(messages, event.messageId, (message) => ({
							...message,
							blocks: [...message.blocks, event.block],
						}))
					)
					if (event.block.type === 'action_result') {
						announceChange()
						void calendar.store.refresh()
					}
				}
				return
			}
			if (streamRef.current !== stream) return
			const current = replyRef.current
			if (!turnActive(event.turn)) {
				streamRef.current = null
				stream.controller.abort()
				setReply(null)
				void readQuietly()
				void mergeThread(conversationId)
				if (event.turn.state === 'completed' && TITLED_ISSUES.includes(event.turn.issue)) watchTitle(conversationId)
			} else setReply({ conversationId, turn: event.turn, stopping: current?.stopping ?? false })
		},
		[calendar, mergeThread, readQuietly, setReply, updateThread, watchTitle]
	)

	const follow = useCallback(
		(conversationId: string, turn: ChatTurn) => {
			if (!turnActive(turn) || streamRef.current?.turnId === turn.id) return
			cancelTitleWatch()
			streamRef.current?.controller.abort()
			const stream: Stream = { turnId: turn.id, controller: new AbortController(), seq: -1 }
			streamRef.current = stream
			setReply({ conversationId, turn, stopping: false })
			void (async () => {
				let failures = 0
				while (streamRef.current === stream && failures < RECONNECTS) {
					let received = false
					const result = await apiEventStream(`/chat/turns/${turn.id}/stream`, {
						signal: stream.controller.signal,
						schema: chatStreamEvent,
						onEvent: (event) => {
							received = true
							apply(conversationId, stream, event)
						},
					})
					if (streamRef.current !== stream || !mounted.current) return
					failures = received && result.ok ? 0 : failures + 1
					await pause(1000, stream.controller.signal)
				}
				if (streamRef.current !== stream || !mounted.current) return
				streamRef.current = null
				setReply(null)
				const read = await readThread(conversationId)
				if (mounted.current && threadRef.current.conversationId === conversationId)
					commitThread({ conversationId, state: read.state })
				void readQuietly()
			})()
		},
		[apply, cancelTitleWatch, commitThread, readQuietly, setReply]
	)

	useEffect(() => {
		if (activeId === null || threadRef.current.conversationId === activeId) return
		let live = true
		void readThread(activeId).then((read) => {
			if (!live || !mounted.current) return
			commitThread({ conversationId: activeId, state: read.state })
			if (read.turn !== null) follow(activeId, read.turn)
		})
		return () => {
			live = false
		}
	}, [activeId, threadGeneration, commitThread, follow])

	useEffect(() => {
		if (replyRef.current !== null && replyRef.current.conversationId !== activeId) unfollow()
		if (titleWatch.current !== null && titleWatch.current.conversationId !== activeId) cancelTitleWatch()
	}, [activeId, unfollow, cancelTitleWatch])

	useEffect(
		() => () => {
			streamRef.current?.controller.abort()
			streamRef.current = null
			cancelTitleWatch()
		},
		[cancelTitleWatch]
	)

	const stop = useCallback(async () => {
		const current = replyRef.current
		if (current === null || current.stopping) return
		setReply({ ...current, stopping: true })
		const result = await apiRequest<unknown>('POST', `/chat/turns/${current.turn.id}/stop`, {})
		if (!mounted.current) return
		const parsed = result.ok ? chatTurnResponse.safeParse(result.data) : null
		if (!parsed?.success) {
			if (replyRef.current?.turn.id === current.turn.id) setReply({ ...current, stopping: false })
			return
		}
		if (turnActive(parsed.data.turn) || streamRef.current?.turnId !== current.turn.id) return
		unfollow()
		const read = await readThread(current.conversationId)
		if (mounted.current && threadRef.current.conversationId === current.conversationId)
			commitThread({ conversationId: current.conversationId, state: read.state })
	}, [commitThread, setReply, unfollow])

	const choosingDefault = !startedNew && list.kind === 'loading' && selectedId === null
	const shownThread: ThreadState = choosingDefault
		? { kind: 'loading' }
		: activeId === null
			? { kind: 'empty' }
			: thread.conversationId === activeId
				? thread.state
				: { kind: 'loading' }

	const reloadThread = useCallback(() => {
		commitThread(EMPTY_THREAD)
		setThreadGeneration((value) => value + 1)
	}, [commitThread])

	const checkStatus = useCallback(async () => {
		const conversationId = threadRef.current.conversationId
		if (conversationId === null) return
		const read = await readThread(conversationId)
		if (!mounted.current || threadRef.current.conversationId !== conversationId) return
		if (read.state.kind === 'ready') commitThread({ conversationId, state: read.state })
		if (read.turn !== null) follow(conversationId, read.turn)
	}, [commitThread, follow])

	const putFirst = useCallback(
		(conversation: ChatConversation) => {
			requests.current++
			const current = listRef.current
			const all = current.kind === 'ready' ? current.conversations : []
			const previous = all.find((item) => item.id === conversation.id)
			const first: ChatConversationListItem = {
				...conversation,
				preview: previous?.preview ?? null,
				waiting: previous?.waiting ?? false,
			}
			commit({ kind: 'ready', conversations: [first, ...all.filter((item) => item.id !== conversation.id)] })
		},
		[commit]
	)

	const setPending = useCallback((next: ModelChoice | null) => {
		pendingChoiceRef.current = next
		setPendingChoice(next)
	}, [])

	const newChat = useCallback(() => {
		setSendFailed(false)
		setPending(null)
		setStartedNew(true)
		select(null)
	}, [select, setPending])

	const beginNew = useCallback(() => {
		setSendFailed(false)
		setPending(null)
		setStartedNew(true)
		setSelectedId(null)
	}, [setPending])

	const replaceConversation = useCallback(
		(conversation: ChatConversation) => {
			requests.current++
			const current = listRef.current
			if (current.kind !== 'ready') return
			commit({
				kind: 'ready',
				conversations: current.conversations.map((item) =>
					item.id === conversation.id ? { ...item, ...conversation } : item
				),
			})
		},
		[commit]
	)

	const openConversation = useCallback(async (): Promise<string | null> => {
		if (activeId !== null) return activeId
		const created = await apiRequest<ChatConversationResponse>('POST', '/chat/conversations')
		if (!created.ok || !mounted.current) return null
		let conversation = created.data.conversation
		const choice = pendingChoiceRef.current
		let applied = true
		if (choice !== null) {
			const body: ConversationModelRequest = { ...choice, expectedRevision: conversation.revision }
			const result = await apiRequest<ChatConversationResponse>(
				'PATCH',
				`/chat/conversations/${conversation.id}/model`,
				body
			)
			if (!mounted.current) return null
			if (result.ok) conversation = result.data.conversation
			else {
				applied = false
				refreshAssistant()
			}
			setPending(null)
		}
		putFirst(conversation)
		commitThread({ conversationId: conversation.id, state: { kind: 'ready', messages: [] } })
		select(conversation.id)
		return applied ? conversation.id : null
	}, [activeId, commitThread, putFirst, refreshAssistant, select, setPending])

	const send = useCallback(
		async (draft: Draft): Promise<boolean> => {
			if (sendingRef.current || draft.stale || draft.text.trim() === '') return false
			cancelTitleWatch()
			sendingRef.current = true
			setSending(true)
			setSendFailed(false)
			try {
				const conversationId = await openConversation()
				if (conversationId === null) {
					setSendFailed(true)
					return false
				}
				const mentions = JSON.stringify(draft.bindings)
				const previous = pending.current
				const entry: Pending =
					previous !== null &&
					previous.conversationId === conversationId &&
					previous.text === draft.text &&
					previous.mentions === mentions
						? previous
						: { requestId: crypto.randomUUID(), conversationId, text: draft.text, mentions }
				pending.current = entry
				const body: SendMessageRequest = { requestId: entry.requestId, text: draft.text, mentions: draft.bindings }
				const result = await apiRequest<unknown>('POST', `/chat/conversations/${conversationId}/messages`, body)
				if (!mounted.current) return false
				const parsed = result.ok ? sendMessageResponse.safeParse(result.data) : null
				if (!parsed?.success) {
					if (result.status === 404) void load(true)
					setSendFailed(true)
					return false
				}
				pending.current = null
				putFirst(parsed.data.conversation)
				updateThread(conversationId, (messages) => mergeMessages(messages, parsed.data.messages))
				if (parsed.data.turn !== null) follow(conversationId, parsed.data.turn)
				void readQuietly()
				return true
			} finally {
				sendingRef.current = false
				if (mounted.current) setSending(false)
			}
		},
		[cancelTitleWatch, follow, load, openConversation, putFirst, readQuietly, updateThread]
	)

	const activeConversation =
		list.kind === 'ready' && activeId !== null
			? (list.conversations.find((item) => item.id === activeId) ?? null)
			: null

	const choose = useCallback(
		async (choice: ModelChoice): Promise<boolean> => {
			if (activeId === null) {
				setPending(choice.model === null && choice.effort === null ? null : choice)
				return true
			}
			const current = listRef.current
			const conversation =
				current.kind === 'ready' ? (current.conversations.find((item) => item.id === activeId) ?? null) : null
			if (conversation === null) return false
			const body: ConversationModelRequest = { ...choice, expectedRevision: conversation.revision }
			const result = await apiRequest<ChatConversationResponse>('PATCH', `/chat/conversations/${activeId}/model`, body)
			if (!mounted.current) return false
			if (result.ok) {
				replaceConversation(result.data.conversation)
				return true
			}
			if (result.status === 409 || result.status === 404) await load(true)
			refreshAssistant()
			return false
		},
		[activeId, load, refreshAssistant, replaceConversation, setPending]
	)

	const replying = reply !== null
	useEffect(() => {
		if (!replying) refreshAssistant()
	}, [replying, refreshAssistant])

	const shownCalendar = useCallback(
		(conversationId: string, block: ChatCalendarProposalBlock) => {
			const current = threadRef.current
			const before =
				current.conversationId === conversationId && current.state.kind === 'ready'
					? calendarBlock(current.state.messages, block.actionId)
					: null
			updateThread(conversationId, (messages) => withBlock(messages, block))
			if (!settled(before, block)) return
			announceChange()
			void calendar.store.refresh()
		},
		[calendar, updateThread]
	)

	const undo = useCallback(
		async (actionId: string) => {
			const conversationId = threadRef.current.conversationId
			if (conversationId === null) return
			updateThread(conversationId, (messages) => withUndo(messages, actionId, 'pending'))
			const body: UndoRequest = { requestId: crypto.randomUUID() }
			const result = await apiRequest<unknown>('POST', `/chat/actions/${actionId}/undo`, body)
			if (!mounted.current) return
			const parsed = result.ok ? undoResponse.safeParse(result.data) : null
			if (parsed?.success && parsed.data.block.type === 'calendar_proposal') {
				shownCalendar(conversationId, parsed.data.block)
				void calendar.store.refresh()
			} else if (parsed?.success) updateThread(conversationId, (messages) => withBlock(messages, parsed.data.block))
			else {
				updateThread(conversationId, (messages) =>
					withUndo(messages, actionId, result.status === 409 ? 'stale' : 'available')
				)
				if (result.status === 409) updateThread(conversationId, (messages) => noteUndoLost(messages, actionId))
			}
		},
		[calendar, shownCalendar, updateThread]
	)

	const confirmCalendar = useCallback(
		async (actionId: string) => {
			const conversationId = threadRef.current.conversationId
			const current = threadRef.current.state
			const block = current.kind === 'ready' ? calendarBlock(current.messages, actionId) : null
			if (conversationId === null || block === null || block.state !== 'proposed') return
			updateThread(conversationId, (messages) => withBlock(messages, { ...block, state: 'submitting' }))
			const result = await apiRequest<unknown>('POST', `/chat/actions/${actionId}/confirm`, {})
			if (!mounted.current) return
			const parsed = result.ok ? chatActionResponse.safeParse(result.data) : null
			if (parsed?.success && parsed.data.block.type === 'calendar_proposal')
				shownCalendar(conversationId, parsed.data.block)
			else updateThread(conversationId, (messages) => withBlock(messages, { ...block, state: 'unknown' }))
			void calendar.store.refresh()
			void readQuietly()
		},
		[calendar, readQuietly, shownCalendar, updateThread]
	)

	const landed = useCallback(
		(before: ChatChangeProposalBlock | null, after: ChatChangeProposalBlock) => {
			if (after.change.operation !== 'bulk_move' || before?.state === after.state) return
			if (after.state !== 'applied' && after.state !== 'partial') return
			announceChange()
			void calendar.store.refresh()
		},
		[calendar]
	)

	const checkAction = useCallback(
		async (actionId: string) => {
			const conversationId = threadRef.current.conversationId
			if (conversationId === null) return
			const result = await apiRequest<unknown>('POST', `/chat/actions/${actionId}/check`, {})
			if (!mounted.current) return
			const parsed = result.ok ? chatActionResponse.safeParse(result.data) : null
			if (!parsed?.success) return
			const block = parsed.data.block
			if (block.type === 'calendar_proposal') {
				shownCalendar(conversationId, block)
				return
			}
			if (block.type === 'note_change') {
				updateThread(conversationId, (messages) => withBlock(messages, block))
				return
			}
			if (block.type !== 'change_proposal') return
			const current = threadRef.current.state
			const before = current.kind === 'ready' ? changeBlock(current.messages, actionId) : null
			updateThread(conversationId, (messages) => withBlock(messages, block))
			landed(before?.type === 'change_proposal' ? before : null, block)
		},
		[landed, shownCalendar, updateThread]
	)

	const refreshThread = useCallback(async (): Promise<boolean> => {
		const conversationId = threadRef.current.conversationId
		if (conversationId === null) return false
		const read = await readThread(conversationId)
		if (!mounted.current || threadRef.current.conversationId !== conversationId) return false
		if (read.state.kind !== 'ready') return false
		commitThread({ conversationId, state: read.state })
		return true
	}, [commitThread])

	const declineAction = useCallback(
		async (actionId: string) => {
			const conversationId = threadRef.current.conversationId
			const current = threadRef.current.state
			const block = current.kind === 'ready' ? calendarBlock(current.messages, actionId) : null
			if (conversationId === null || block === null || block.state !== 'proposed') return
			const result = await apiRequest<unknown>('POST', `/chat/actions/${actionId}/decline`, {})
			if (!mounted.current) return
			const parsed = result.ok ? chatActionResponse.safeParse(result.data) : null
			if (parsed?.success && parsed.data.block.type === 'calendar_proposal')
				updateThread(conversationId, (messages) => withBlock(messages, parsed.data.block))
			else void refreshThread()
			void readQuietly()
		},
		[readQuietly, refreshThread, updateThread]
	)

	const decideChange = useCallback(
		async (actionId: string, decision: 'confirm' | 'decline'): Promise<boolean> => {
			const conversationId = threadRef.current.conversationId
			const current = threadRef.current.state
			const block = current.kind === 'ready' ? changeBlock(current.messages, actionId) : null
			if (conversationId === null || block === null || block.state !== 'proposed') return true
			updateThread(conversationId, (messages) => withBlock(messages, { ...block, state: 'applying' }))
			const result = await apiRequest<unknown>('POST', `/chat/actions/${actionId}/${decision}`, {})
			if (!mounted.current) return true
			const parsed = result.ok ? chatActionResponse.safeParse(result.data) : null
			const shown = parsed?.success ? parsed.data.block : null
			if (
				shown !== null &&
				(shown.type === 'change_proposal' || shown.type === 'note_change') &&
				shown.type === block.type
			) {
				updateThread(conversationId, (messages) => withBlock(messages, shown))
				if (block.type === 'change_proposal' && shown.type === 'change_proposal') landed(block, shown)
				void readQuietly()
				return true
			}
			if (await refreshThread()) return true
			updateThread(conversationId, (messages) => withBlock(messages, block))
			return false
		},
		[landed, readQuietly, refreshThread, updateThread]
	)

	const answerReview = useCallback(
		async (actionId: string, decision: 'confirm' | 'decline'): Promise<boolean> => {
			const conversationId = threadRef.current.conversationId
			if (conversationId === null) return false
			const result = await apiRequest<unknown>('POST', `/chat/actions/${actionId}/${decision}`, {})
			if (!mounted.current) return false
			const parsed = result.ok ? chatActionResponse.safeParse(result.data) : null
			const shown = parsed?.success ? parsed.data.block : null
			if (shown !== null && shown.type === 'review_offer') {
				updateThread(conversationId, (messages) => withBlock(messages, shown))
				void readQuietly()
				return shown.state === (decision === 'confirm' ? 'accepted' : 'declined')
			}
			await refreshThread()
			return false
		},
		[readQuietly, refreshThread, updateThread]
	)

	const rename = useCallback(
		async (conversation: ChatConversation, title: string): Promise<RenameOutcome> => {
			const attempt = async (revision: number, retry: boolean): Promise<RenameOutcome> => {
				const body: RenameConversationRequest = { title, expectedRevision: revision }
				const result = await apiRequest<ChatConversationResponse>(
					'PATCH',
					`/chat/conversations/${conversation.id}`,
					body
				)
				if (result.ok) {
					cancelTitleWatch(conversation.id)
					await load(true)
					return 'saved'
				}
				if (result.status === 404) {
					await load(true)
					return 'gone'
				}
				if (result.status === 409) {
					await load(true)
					if (retry && conversation.title === NEW_CHAT_TITLE) {
						const current = listRef.current
						const fresh =
							current.kind === 'ready' ? current.conversations.find((item) => item.id === conversation.id) : undefined
						if (fresh !== undefined && fresh.revision !== revision) return attempt(fresh.revision, false)
					}
				}
				return 'failed'
			}
			return attempt(conversation.revision, true)
		},
		[cancelTitleWatch, load]
	)

	const remove = useCallback(
		async (conversation: ChatConversation): Promise<DeleteOutcome> => {
			cancelTitleWatch(conversation.id)
			const body: DeleteConversationRequest = { expectedRevision: conversation.revision }
			const result = await apiRequest<void>('DELETE', `/chat/conversations/${conversation.id}`, body)
			if (!result.ok && result.status !== 404) {
				if (result.status === 409 && result.error?.code === 'busy') return 'busy'
				if (result.status === 409) await load(true)
				return 'failed'
			}
			requests.current++
			const current = listRef.current
			const remaining = (current.kind === 'ready' ? current.conversations : []).filter(
				(item) => item.id !== conversation.id
			)
			commit({ kind: 'ready', conversations: remaining })
			if (activeId === conversation.id) select(latestConversation(remaining)?.id ?? null)
			void load(true)
			return 'deleted'
		},
		[activeId, cancelTitleWatch, commit, load, select]
	)

	return {
		list,
		selectedId: activeId,
		thread: shownThread,
		sending,
		sendFailed,
		reply: reply !== null && reply.conversationId === activeId ? reply : null,
		stop,
		checkStatus,
		select,
		newChat,
		beginNew,
		send,
		undo,
		confirmCalendar,
		declineAction,
		checkAction,
		decideChange,
		answerReview,
		refreshThread,
		reloadThread,
		rename,
		remove,
		reload: () => load(false),
		models: {
			assistant: assistant.view,
			conversation: activeConversation,
			pending: pendingChoice,
			choose,
			refresh: refreshAssistant,
		} satisfies ChatModels,
	}
}
