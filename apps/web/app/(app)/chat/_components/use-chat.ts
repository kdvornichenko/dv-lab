'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '@/lib/api-client'

import {
	studentLessonOptionsResponse,
	type ChatConversation,
	type ChatConversationResponse,
	type ChatConversationsResponse,
	type DeleteConversationRequest,
	type MentionBinding,
	type RenameConversationRequest,
	type StudentLessonOption,
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
	window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

export function useChat(initialConversationId: string | null) {
	const [list, setList] = useState<ConversationListState>({ kind: 'loading' })
	const listRef = useRef<ConversationListState>(list)
	const [selectedId, setSelectedId] = useState<string | null>(initialConversationId)
	const [creating, setCreating] = useState(false)
	const [createFailed, setCreateFailed] = useState(false)
	const requests = useRef(0)
	const mounted = useRef(true)

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

	const create = useCallback(async () => {
		if (creating) return
		setCreating(true)
		setCreateFailed(false)
		const result = await apiRequest<ChatConversationResponse>('POST', '/chat/conversations')
		if (!mounted.current) return
		setCreating(false)
		if (!result.ok) {
			setCreateFailed(true)
			return
		}
		const created = result.data.conversation
		requests.current++
		const current = listRef.current
		commit({ kind: 'ready', conversations: [created, ...(current.kind === 'ready' ? current.conversations : [])] })
		select(created.id)
		void load(true)
	}, [commit, creating, load, select])

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
		creating,
		createFailed,
		select,
		create,
		rename,
		remove,
		reload: () => load(false),
	}
}
