'use client'

import { useEffect, useRef, useState } from 'react'

import type { ConversationListState } from './use-chat'

export type ChatSignal = 'info' | 'warning' | null

const KEY = 'dvlab:chat-seen'

type Seen = Record<string, string>

function readSeen(): Seen | null {
	try {
		const raw = window.localStorage.getItem(KEY)
		if (raw === null) return null
		const parsed: unknown = JSON.parse(raw)
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
		const seen: Seen = {}
		for (const [id, at] of Object.entries(parsed)) if (typeof at === 'string') seen[id] = at
		return seen
	} catch {
		return null
	}
}

function writeSeen(seen: Seen) {
	try {
		window.localStorage.setItem(KEY, JSON.stringify(seen))
	} catch {
		return
	}
}

export function useChatSignal(list: ConversationListState, visible: boolean, replying: boolean): ChatSignal {
	const [seen, setSeen] = useState<Seen | null>(null)
	const known = useRef<Seen | null>(null)
	const conversations = list.kind === 'ready' ? list.conversations : null

	useEffect(() => {
		if (conversations === null) return
		const stored = known.current ?? readSeen()
		const next: Seen = { ...stored }
		let changed = stored === null
		for (const item of conversations) {
			if ((visible || stored === null) && next[item.id] !== item.updatedAt) {
				next[item.id] = item.updatedAt
				changed = true
			}
		}
		known.current = next
		if (changed) writeSeen(next)
		setSeen(next)
	}, [conversations, visible])

	if (seen === null || conversations === null || visible || replying) return null
	if (conversations.some((item) => item.waiting)) return 'warning'
	return conversations.some((item) => (seen[item.id] ?? '') < item.updatedAt) ? 'info' : null
}
