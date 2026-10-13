'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useCalendarController } from '@/components/app/calendar-command-provider'
import { API_CACHE_INVALIDATED, DATA_CHANGED_CHANNEL, apiRequest } from '@/lib/api-client'

import {
	calendarActionResponse,
	chatConversationReadResponse,
	sendMessageResponse,
	studentLessonOptionsResponse,
	undoResponse,
	type ChatActionResultBlock,
	type ChatCalendarProposalBlock,
	type ChatConversation,
	type ChatConversationResponse,
	type ChatConversationsResponse,
	type ChatMessage,
	type ChatUndoState,
	type DeleteConversationRequest,
	type MentionBinding,
	type RenameConversationRequest,
	type SendMessageRequest,
	type StudentLessonOption,
	type UndoRequest,
} from '@dv-lab/contracts'

export const MENTION_LIMIT = 6

export type MentionStudents = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; rows: StudentLessonOption[] }

export type Draft = { text: string; bindings: MentionBinding[]; stale: boolean }

const EMPTY_DRAFT: Draft = { text: '', bindings: [], stale: false }

function searchKey(value: string): string {
	return value.normalize('NFC').toLocaleLowerCase()
}

export function matchStudents(rows: readonly StudentLessonOption[], query: string): StudentLessonOption[] {
	const key = searchKey(query.trim())
	return rows.filter((row) => searchKey(row.displayName).includes(key)).slice(0, MENTION_LIMIT)
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
	{ kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; conversations: ChatConversation[] }

export type RenameOutcome = 'saved' | 'gone' | 'failed'

function writeSelection(id: string | null): void {
	const url = new URL(window.location.href)
	if (id === null) url.searchParams.delete('c')
	else url.searchParams.set('c', id)
	window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export type ThreadState =
	{ kind: 'empty' } | { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; messages: ChatMessage[] }

type Thread = { conversationId: string | null; state: ThreadState }

type Pending = { requestId: string; conversationId: string; text: string; mentions: string }

const EMPTY_THREAD: Thread = { conversationId: null, state: { kind: 'empty' } }

async function readThread(conversationId: string): Promise<ThreadState> {
	const result = await apiRequest<unknown>('GET', `/chat/conversations/${conversationId}`)
	if (!result.ok) return { kind: 'error' }
	const parsed = chatConversationReadResponse.safeParse(result.data)
	return parsed.success ? { kind: 'ready', messages: parsed.data.messages } : { kind: 'error' }
}

function mergeMessages(current: readonly ChatMessage[], added: readonly ChatMessage[]): ChatMessage[] {
	const known = new Set(current.map((message) => message.id))
	return [...current, ...added.filter((message) => !known.has(message.id))]
}

type ActionBlock = ChatActionResultBlock | ChatCalendarProposalBlock

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

export function useChat(initialConversationId: string | null) {
	const calendar = useCalendarController()
	const [list, setList] = useState<ConversationListState>({ kind: 'loading' })
	const listRef = useRef<ConversationListState>(list)
	const [selectedId, setSelectedId] = useState<string | null>(initialConversationId)
	const [thread, setThread] = useState<Thread>(EMPTY_THREAD)
	const threadRef = useRef<Thread>(thread)
	const [threadGeneration, setThreadGeneration] = useState(0)
	const [sending, setSending] = useState(false)
	const [sendFailed, setSendFailed] = useState(false)
	const sendingRef = useRef(false)
	const pending = useRef<Pending | null>(null)
	const requests = useRef(0)
	const mounted = useRef(true)

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

	const select = useCallback((id: string | null) => {
		setSelectedId(id)
		writeSelection(id)
	}, [])

	const known =
		list.kind !== 'ready' || selectedId === null || list.conversations.some((item) => item.id === selectedId)
	const activeId = known ? selectedId : null

	useEffect(() => {
		if (!known) writeSelection(null)
	}, [known])

	useEffect(() => {
		if (activeId === null || threadRef.current.conversationId === activeId) return
		let live = true
		void readThread(activeId).then((state) => {
			if (live && mounted.current) commitThread({ conversationId: activeId, state })
		})
		return () => {
			live = false
		}
	}, [activeId, threadGeneration, commitThread])

	const shownThread: ThreadState =
		activeId === null ? { kind: 'empty' } : thread.conversationId === activeId ? thread.state : { kind: 'loading' }

	const reloadThread = useCallback(() => {
		commitThread(EMPTY_THREAD)
		setThreadGeneration((value) => value + 1)
	}, [commitThread])

	const putFirst = useCallback(
		(conversation: ChatConversation) => {
			requests.current++
			const current = listRef.current
			const others = (current.kind === 'ready' ? current.conversations : []).filter(
				(item) => item.id !== conversation.id
			)
			commit({ kind: 'ready', conversations: [conversation, ...others] })
		},
		[commit]
	)

	const newChat = useCallback(() => {
		setSendFailed(false)
		select(null)
	}, [select])

	const openConversation = useCallback(async (): Promise<string | null> => {
		if (activeId !== null) return activeId
		const created = await apiRequest<ChatConversationResponse>('POST', '/chat/conversations')
		if (!created.ok || !mounted.current) return null
		const conversation = created.data.conversation
		putFirst(conversation)
		commitThread({ conversationId: conversation.id, state: { kind: 'ready', messages: [] } })
		select(conversation.id)
		return conversation.id
	}, [activeId, commitThread, putFirst, select])

	const send = useCallback(
		async (draft: Draft): Promise<boolean> => {
			if (sendingRef.current || draft.stale || draft.text.trim() === '') return false
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
				return true
			} finally {
				sendingRef.current = false
				if (mounted.current) setSending(false)
			}
		},
		[load, openConversation, putFirst, updateThread]
	)

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
			else
				updateThread(conversationId, (messages) =>
					withUndo(messages, actionId, result.status === 409 ? 'stale' : 'available')
				)
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
			const parsed = result.ok ? calendarActionResponse.safeParse(result.data) : null
			if (parsed?.success) shownCalendar(conversationId, parsed.data.block)
			else updateThread(conversationId, (messages) => withBlock(messages, { ...block, state: 'unknown' }))
			void calendar.store.refresh()
		},
		[calendar, shownCalendar, updateThread]
	)

	const checkCalendar = useCallback(
		async (actionId: string) => {
			const conversationId = threadRef.current.conversationId
			if (conversationId === null) return
			const result = await apiRequest<unknown>('POST', `/chat/actions/${actionId}/check`, {})
			if (!mounted.current) return
			const parsed = result.ok ? calendarActionResponse.safeParse(result.data) : null
			if (parsed?.success) shownCalendar(conversationId, parsed.data.block)
		},
		[shownCalendar]
	)

	const rename = useCallback(
		async (conversation: ChatConversation, title: string): Promise<RenameOutcome> => {
			const body: RenameConversationRequest = { title, expectedRevision: conversation.revision }
			const result = await apiRequest<ChatConversationResponse>('PATCH', `/chat/conversations/${conversation.id}`, body)
			if (result.ok) {
				await load(true)
				return 'saved'
			}
			if (result.status === 404) {
				await load(true)
				return 'gone'
			}
			if (result.status === 409) await load(true)
			return 'failed'
		},
		[load]
	)

	const remove = useCallback(
		async (conversation: ChatConversation): Promise<boolean> => {
			const body: DeleteConversationRequest = { expectedRevision: conversation.revision }
			const result = await apiRequest<void>('DELETE', `/chat/conversations/${conversation.id}`, body)
			if (!result.ok && result.status !== 404) {
				if (result.status === 409) await load(true)
				return false
			}
			requests.current++
			const current = listRef.current
			const remaining = (current.kind === 'ready' ? current.conversations : []).filter(
				(item) => item.id !== conversation.id
			)
			commit({ kind: 'ready', conversations: remaining })
			if (activeId === conversation.id) select(remaining[0]?.id ?? null)
			void load(true)
			return true
		},
		[activeId, commit, load, select]
	)

	return {
		list,
		selectedId: activeId,
		thread: shownThread,
		sending,
		sendFailed,
		select,
		newChat,
		send,
		undo,
		confirmCalendar,
		checkCalendar,
		reloadThread,
		rename,
		remove,
		reload: () => load(false),
	}
}
