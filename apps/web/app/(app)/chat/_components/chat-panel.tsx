'use client'

import { useEffect, useRef, useState } from 'react'

import { m, useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'

import { useSidebar } from '@/components/ui/sidebar'
import { spring } from '@/lib/springs'
import { SurfaceProvider } from '@/lib/surface-context'

import { useChatContext } from './chat-provider'
import { ChatScreen } from './chat-screen'

const FOLD_BELOW = 1424
const GUTTER = 8

export function ChatPanel() {
	const { chat, panel } = useChatContext()
	const router = useRouter()
	const reduce = useReducedMotion() ?? false
	const sidebar = useSidebar()
	const sidebarRef = useRef(sidebar)
	const folded = useRef(false)
	const aside = useRef<HTMLElement>(null)
	const [everOpened, setEverOpened] = useState(false)
	if (panel.open && !everOpened) setEverOpened(true)
	const narrow = panel.viewport < FOLD_BELOW

	useEffect(() => {
		sidebarRef.current = sidebar
	})

	useEffect(() => {
		const current = sidebarRef.current
		if (panel.open && narrow && current.open) {
			folded.current = true
			current.setOpen(false)
		}
		if (!panel.open && folded.current) {
			folded.current = false
			current.setOpen(true)
		}
	}, [panel.open, narrow])

	useEffect(() => {
		if (panel.open && folded.current && sidebar.open) folded.current = false
	}, [panel.open, sidebar.open])

	useEffect(() => {
		if (!panel.open) return
		const timer = window.setTimeout(() => aside.current?.querySelector('textarea')?.focus(), 60)
		return () => window.clearTimeout(timer)
	}, [panel.open])

	const hide = panel.hide
	const selectedId = chat.selectedId

	function openInChat() {
		hide()
		router.push(selectedId === null ? '/chat' : `/chat?c=${selectedId}`)
	}

	return (
		<m.div
			initial={false}
			animate={{ width: panel.open ? panel.width + GUTTER : 0 }}
			transition={reduce ? { duration: 0 } : spring.slow}
			className="shrink-0 overflow-hidden"
			inert={!panel.open}
		>
			<m.aside
				ref={aside}
				aria-label="Chat"
				initial={false}
				animate={{ x: panel.open ? 0 : '100%' }}
				transition={reduce ? { duration: 0 } : spring.slow}
				style={{ width: panel.width }}
				className="my-2 mr-2 flex h-[calc(100%-1rem)] flex-col overflow-hidden rounded-2xl bg-surface-2 shadow-surface-2 ring-1 ring-border"
			>
				{everOpened ? (
					<SurfaceProvider value={2}>
						<ChatScreen
							studentId={null}
							conversationId={null}
							startNew={false}
							startReview={false}
							panel={{ onClose: hide, onOpenInChat: openInChat }}
						/>
					</SurfaceProvider>
				) : null}
			</m.aside>
		</m.div>
	)
}
