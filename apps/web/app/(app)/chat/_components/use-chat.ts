'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { apiRequest } from '@/lib/api-client'

import type {
	ChatConversation,
	ChatConversationResponse,
	ChatConversationsResponse,
	DeleteConversationRequest,
	RenameConversationRequest,
} from '@dv-lab/contracts'

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
