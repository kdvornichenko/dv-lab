'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'

import { Info, TriangleAlert } from 'lucide-react'
import { m } from 'motion/react'
import { usePathname, useRouter } from 'next/navigation'

import { AssistantStar } from '@/components/app/assistant-star'
import { Button } from '@/components/ui/button'
import { SurfaceProvider } from '@/lib/surface-context'

import { useChatContext } from '../chat/_components/chat-provider'
import { ChatScreen } from '../chat/_components/chat-screen'

const SIZE = 56
const EDGE = 8
const PHONE_BELOW = 768
const CARD_WIDTH = 560
const BUBBLE_WIDTH = 288
const BUBBLE_MS = 4000
const KEY = 'dvlab:assistant-star'
const CARD_ID = 'assistant-star-card'

type Fraction = { x: number; y: number }
type Point = { x: number; y: number }
type Insets = { top: number; right: number; bottom: number; left: number }
type View = { width: number; height: number; keyboard: number; safe: Insets }
type Bubble = { kind: 'info' | 'warning'; id: string; title: string }

function readFraction(): Fraction | null {
	try {
		const raw = window.localStorage.getItem(KEY)
		if (raw === null) return null
		const parsed: unknown = JSON.parse(raw)
		if (typeof parsed !== 'object' || parsed === null || !('x' in parsed) || !('y' in parsed)) return null
		const { x, y } = parsed
		return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)
			? { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
			: null
	} catch {
		return null
	}
}

function writeFraction(value: Fraction) {
	try {
		window.localStorage.setItem(KEY, JSON.stringify(value))
	} catch {
		return
	}
}

function bounds(view: View) {
	return {
		minX: EDGE + view.safe.left,
		maxX: Math.max(EDGE + view.safe.left, view.width - SIZE - EDGE - view.safe.right),
		minY: EDGE + view.safe.top,
		maxY: Math.max(EDGE + view.safe.top, view.height - SIZE - EDGE - view.safe.bottom),
	}
}

function place(view: View, fraction: Fraction | null): Point {
	const { minX, maxX, minY, maxY } = bounds(view)
	if (fraction === null) {
		const inset = view.width >= PHONE_BELOW ? EDGE : 0
		return { x: maxX - inset, y: maxY - inset }
	}
	return { x: minX + fraction.x * (maxX - minX), y: minY + fraction.y * (maxY - minY) }
}

function clamp(view: View, point: Point): Point {
	const { minX, maxX, minY, maxY } = bounds(view)
	return { x: Math.min(maxX, Math.max(minX, point.x)), y: Math.min(maxY, Math.max(minY, point.y)) }
}

function toFraction(view: View, point: Point): Fraction {
	const { minX, maxX, minY, maxY } = bounds(view)
	return {
		x: maxX === minX ? 1 : (point.x - minX) / (maxX - minX),
		y: maxY === minY ? 1 : (point.y - minY) / (maxY - minY),
	}
}

function cardStyle(view: View, star: Point): CSSProperties {
	if (view.width < PHONE_BELOW) {
		const bottom = Math.max(EDGE + view.safe.bottom, view.keyboard + EDGE)
		return {
			left: EDGE,
			right: EDGE,
			bottom,
			maxHeight: view.height - view.keyboard - bottom - 56 - view.safe.top,
		}
	}
	const width = Math.min(CARD_WIDTH, view.width - EDGE * 2)
	const lower = star.y + SIZE / 2 > view.height / 2
	const spaceLeft = star.x - EDGE * 2
	const spaceRight = view.width - (star.x + SIZE) - EDGE * 2
	const beside = spaceLeft >= width ? 'left' : spaceRight >= width ? 'right' : null
	const style: CSSProperties = { width }
	if (beside !== null) {
		style.left = beside === 'left' ? star.x - EDGE - width : star.x + SIZE + EDGE
	} else {
		style.left = Math.min(view.width - EDGE - width, Math.max(EDGE, star.x + SIZE / 2 - width / 2))
	}
	if (beside !== null) {
		if (lower) {
			style.bottom = view.height - (star.y + SIZE)
			style.maxHeight = Math.min(700, view.height * 0.8, star.y + SIZE - view.safe.top - EDGE)
		} else {
			style.top = star.y
			style.maxHeight = Math.min(700, view.height * 0.8, view.height - star.y - view.safe.bottom - EDGE)
		}
	} else if (lower) {
		style.bottom = view.height - star.y + EDGE
		style.maxHeight = Math.min(700, view.height * 0.8, star.y - view.safe.top - EDGE * 2)
	} else {
		style.top = star.y + SIZE + EDGE
		style.maxHeight = Math.min(700, view.height * 0.8, view.height - star.y - SIZE - view.safe.bottom - EDGE * 2)
	}
	return style
}

function bubbleStyle(view: View, star: Point): CSSProperties {
	const width = Math.min(BUBBLE_WIDTH, view.width - EDGE * 2)
	const left = star.x + SIZE / 2 > view.width / 2
	const x = left ? star.x - EDGE - width : star.x + SIZE + EDGE
	return { width, left: Math.min(view.width - EDGE - width, Math.max(EDGE, x)), bottom: view.height - (star.y + SIZE) }
}

export function AssistantStarLayer() {
	const { chat, panel, signal, star } = useChatContext()
	const router = useRouter()
	const pathname = usePathname()
	const probe = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	const card = useRef<HTMLDivElement>(null)
	const drag = useRef<{ id: number; origin: Point; start: Point; moved: boolean; last: number } | null>(null)
	const suppressClick = useRef(false)
	const [view, setView] = useState<View | null>(null)
	const [fraction, setFraction] = useState<Fraction | null>(() =>
		typeof window === 'undefined' ? null : readFraction()
	)
	const [dragging, setDragging] = useState<Point | null>(null)
	const [lean, setLean] = useState(0)
	const [hop, setHop] = useState(0)
	const [bubble, setBubble] = useState<Bubble | null>(null)
	const armed = useRef(false)
	const shownKey = useRef<string | null>(null)
	const open = star.open
	const setOpen = star.setOpen

	useEffect(() => {
		function read() {
			const style = probe.current ? getComputedStyle(probe.current) : null
			const inset = (name: 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft') =>
				style ? Number.parseFloat(style[name]) || 0 : 0
			const viewport = window.visualViewport
			const height = window.innerHeight
			const keyboard = viewport ? Math.max(0, height - viewport.height - viewport.offsetTop) : 0
			setView({
				width: window.innerWidth,
				height,
				keyboard,
				safe: {
					top: inset('paddingTop'),
					right: inset('paddingRight'),
					bottom: inset('paddingBottom'),
					left: inset('paddingLeft'),
				},
			})
		}
		read()
		window.addEventListener('resize', read)
		window.visualViewport?.addEventListener('resize', read)
		window.visualViewport?.addEventListener('scroll', read)
		return () => {
			window.removeEventListener('resize', read)
			window.visualViewport?.removeEventListener('resize', read)
			window.visualViewport?.removeEventListener('scroll', read)
		}
	}, [])

	const conversations = chat.list.kind === 'ready' ? chat.list.conversations : null
	const target =
		conversations === null
			? undefined
			: signal === 'warning'
				? conversations.find((item) => item.waiting)
				: signal === 'info'
					? conversations.reduce<(typeof conversations)[number] | undefined>(
							(latest, item) => (latest === undefined || item.updatedAt > latest.updatedAt ? item : latest),
							undefined
						)
					: undefined
	const key = signal !== null && target !== undefined ? `${signal}:${target.id}:${target.updatedAt}` : null

	useEffect(() => {
		if (conversations === null) return
		if (!armed.current) {
			armed.current = true
			shownKey.current = key
			return
		}
		if (key === null || key === shownKey.current || signal === null || target === undefined) return
		shownKey.current = key
		setHop((value) => value + 1)
		setBubble({ kind: signal, id: target.id, title: target.title })
	}, [conversations, key, signal, target])

	useEffect(() => {
		if (bubble === null) return
		const timer = window.setTimeout(() => setBubble(null), BUBBLE_MS)
		return () => window.clearTimeout(timer)
	}, [bubble])

	useEffect(() => {
		if (!open) return
		const timer = window.setTimeout(() => card.current?.querySelector('textarea')?.focus(), 60)
		return () => window.clearTimeout(timer)
	}, [open])

	const hidden = pathname === '/chat' || panel.open
	const phoneOpen = view !== null && view.width < PHONE_BELOW && open
	const position = view === null ? null : (dragging ?? clamp(view, place(view, fraction)))

	const close = useCallback(() => {
		setOpen(false)
		window.setTimeout(() => button.current?.focus(), 0)
	}, [setOpen])

	function move(next: Point) {
		if (view === null) return
		const point = clamp(view, next)
		const saved = toFraction(view, point)
		setFraction(saved)
		writeFraction(saved)
	}

	function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
		if (position === null || (event.pointerType === 'mouse' && event.button !== 0)) return
		drag.current = {
			id: event.pointerId,
			origin: { x: event.clientX, y: event.clientY },
			start: position,
			moved: false,
			last: event.clientX,
		}
	}

	function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
		const current = drag.current
		if (current === null || current.id !== event.pointerId || view === null) return
		const dx = event.clientX - current.origin.x
		const dy = event.clientY - current.origin.y
		const threshold = event.pointerType === 'touch' ? 8 : 4
		if (!current.moved) {
			if (Math.hypot(dx, dy) < threshold) return
			current.moved = true
			event.currentTarget.setPointerCapture(event.pointerId)
		}
		setLean(Math.max(-9, Math.min(9, (event.clientX - current.last) * 1.2)))
		current.last = event.clientX
		setDragging(clamp(view, { x: current.start.x + dx, y: current.start.y + dy }))
	}

	function onPointerUp(event: PointerEvent<HTMLButtonElement>) {
		const current = drag.current
		if (current === null || current.id !== event.pointerId) return
		drag.current = null
		if (!current.moved) return
		suppressClick.current = true
		window.setTimeout(() => {
			suppressClick.current = false
		}, 0)
		if (dragging !== null) move(dragging)
		setDragging(null)
		setLean(0)
	}

	function onClick() {
		if (suppressClick.current) return
		if (open) close()
		else setOpen(true)
	}

	function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		const step = event.shiftKey ? 64 : 16
		const delta: Point | null =
			event.key === 'ArrowLeft'
				? { x: -step, y: 0 }
				: event.key === 'ArrowRight'
					? { x: step, y: 0 }
					: event.key === 'ArrowUp'
						? { x: 0, y: -step }
						: event.key === 'ArrowDown'
							? { x: 0, y: step }
							: null
		if (delta === null || position === null) return
		event.preventDefault()
		move({ x: position.x + delta.x, y: position.y + delta.y })
	}

	function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key !== 'Escape' || event.defaultPrevented) return
		event.stopPropagation()
		close()
	}

	function openAsPanel() {
		setOpen(false)
		panel.show(chat.selectedId)
	}

	function openInChat() {
		setOpen(false)
		router.push(chat.selectedId === null ? '/chat' : `/chat?c=${chat.selectedId}`)
	}

	function openBubble(id: string) {
		setBubble(null)
		chat.adopt(id, false)
		setOpen(true)
	}

	const badge = open ? null : signal
	const label =
		badge === 'warning'
			? 'Assistant, waiting for your decision'
			: badge === 'info'
				? 'Assistant, new reply'
				: 'Assistant'

	return (
		<>
			<div
				ref={probe}
				aria-hidden
				className="pointer-events-none fixed size-0"
				style={{ padding: 'var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)' }}
			/>
			{hidden || view === null || position === null ? null : (
				<>
					{open ? (
						<m.div
							ref={card}
							id={CARD_ID}
							role="dialog"
							aria-label="Assistant"
							aria-modal={false}
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.16 }}
							style={cardStyle(view, position)}
							className="fixed z-30 flex flex-col overflow-hidden rounded-3xl bg-surface-3 shadow-surface-3 ring-1 ring-border"
							onKeyDown={onCardKeyDown}
						>
							<SurfaceProvider value={3}>
								<ChatScreen
									studentId={null}
									conversationId={null}
									startNew={false}
									startReview={false}
									panel={{
										floating: true,
										onClose: close,
										onOpenInChat: openInChat,
										onOpenAsPanel: panel.available ? openAsPanel : undefined,
									}}
								/>
							</SurfaceProvider>
						</m.div>
					) : null}
					{bubble === null || open ? null : (
						<div
							role="status"
							style={bubbleStyle(view, position)}
							className="fixed z-30 flex flex-col gap-2 rounded-xl bg-surface-4 px-4 py-3 text-foreground shadow-surface-4"
						>
							<div className="flex items-start gap-2">
								{bubble.kind === 'warning' ? (
									<TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
								) : (
									<Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
								)}
								<div className="min-w-0 flex-1">
									<p className="text-body font-semibold">
										{bubble.kind === 'warning' ? 'Waiting for your decision' : 'Reply is ready'}
									</p>
									<p className="truncate text-caption text-muted-foreground" title={bubble.title}>
										{bubble.title}
									</p>
								</div>
							</div>
							<Button variant="secondary" size="compact" className="self-start" onClick={() => openBubble(bubble.id)}>
								Open chat
							</Button>
						</div>
					)}
					{phoneOpen ? null : (
						<button
							ref={button}
							type="button"
							aria-label={label}
							aria-expanded={open}
							aria-controls={CARD_ID}
							data-slot="assistant-star"
							className="fixed z-30 size-14 touch-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]"
							style={{
								left: position.x,
								top: position.y,
								transform: `rotate(${lean}deg)${dragging === null ? '' : ' scale(1.06)'}`,
								transition: dragging === null ? 'transform 160ms ease-out' : 'transform 80ms linear',
								filter: dragging === null ? undefined : 'drop-shadow(0 6px 6px rgb(0 0 0 / 0.25))',
							}}
							onPointerDown={onPointerDown}
							onPointerMove={onPointerMove}
							onPointerUp={onPointerUp}
							onPointerCancel={onPointerUp}
							onClick={onClick}
							onKeyDown={onKeyDown}
						>
							<AssistantStar busy={chat.reply !== null} hop={hop} />
							{badge === null ? null : (
								<span
									aria-hidden
									className={`absolute -top-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full text-[8px] leading-none font-bold text-black ring-2 ring-surface-1 ${badge === 'warning' ? 'bg-warning' : 'bg-info'}`}
								>
									{badge === 'warning' ? '!' : null}
								</span>
							)}
						</button>
					)}
				</>
			)}
		</>
	)
}
