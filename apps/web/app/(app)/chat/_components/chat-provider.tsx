'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { withoutSearchParams } from '@/lib/arrival-mark'

import { type ChatSignal, useChatSignal } from './chat-signals'
import { useChat, useComposerDraft } from './use-chat'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PANEL_MIN_VIEWPORT = 1024

export type ChatPanelState = {
	open: boolean
	available: boolean
	width: number
	viewport: number
	show: (conversationId?: string | null) => void
	hide: () => void
	toggle: () => void
}

type ChatContextValue = {
	chat: ReturnType<typeof useChat>
	composer: ReturnType<typeof useComposerDraft>
	panel: ChatPanelState
	signal: ChatSignal
	star: { open: boolean; setOpen: (open: boolean) => void }
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext(): ChatContextValue {
	const value = useContext(ChatContext)
	if (value === null) throw new Error('useChatContext must be used within a ChatProvider')
	return value
}

function panelWidth(viewport: number): number {
	if (viewport >= 1536) return 480
	if (viewport >= 1192) return 416
	return 360
}

function typing(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	return (
		target.tagName === 'INPUT' ||
		target.tagName === 'TEXTAREA' ||
		target.tagName === 'SELECT' ||
		target.isContentEditable
	)
}

export function ChatProvider({ children }: { children: ReactNode }) {
	const chat = useChat(null, { startNew: false })
	const composer = useComposerDraft()
	const router = useRouter()
	const onChatPage = usePathname() === '/chat'
	const arrival = useSearchParams().get('chat')
	const [viewport, setViewport] = useState(0)
	const [chosen, setChosen] = useState(false)
	const [starOpen, setStarOpen] = useState(false)
	const available = viewport >= PANEL_MIN_VIEWPORT && !onChatPage
	const adopt = chat.adopt

	if (!available && chosen) setChosen(false)

	useEffect(() => {
		const read = () => setViewport(window.innerWidth)
		read()
		window.addEventListener('resize', read)
		return () => window.removeEventListener('resize', read)
	}, [])

	const show = useCallback(
		(conversationId?: string | null) => {
			if (!available) {
				router.push(conversationId ? `/chat?c=${conversationId}` : '/chat')
				return
			}
			if (conversationId) adopt(conversationId, false)
			setChosen(true)
		},
		[adopt, available, router]
	)
	const hide = useCallback(() => setChosen(false), [])
	const toggle = useCallback(() => setChosen((current) => !current), [])

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key !== ']' || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return
			if (!available) return
			event.preventDefault()
			toggle()
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [available, toggle])

	useEffect(() => {
		if (arrival === null || viewport === 0) return
		const clean = withoutSearchParams(['chat'])
		if (!UUID.test(arrival)) {
			if (clean !== undefined) router.replace(clean, { scroll: false })
			return
		}
		if (!available) {
			router.replace(`/chat?c=${arrival}`)
			return
		}
		adopt(arrival, false)
		queueMicrotask(() => setChosen(true))
		if (clean !== undefined) router.replace(clean, { scroll: false })
	}, [arrival, viewport, available, adopt, router])

	const signal = useChatSignal(chat.list, (chosen && available) || onChatPage || starOpen, chat.reply !== null)
	const panel: ChatPanelState = {
		open: chosen && available,
		available,
		width: panelWidth(viewport),
		viewport,
		show,
		hide,
		toggle,
	}
	return <ChatContext.Provider value={{ chat, composer, panel, signal, star: { open: starOpen, setOpen: setStarOpen } }}>{children}</ChatContext.Provider>
}
