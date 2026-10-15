import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MouseEvent,
	type MutableRefObject,
	type PointerEvent,
	type RefObject,
} from 'react'

import type { CalendarEventView } from '@dv-lab/contracts'
import { zonedInstant } from '@dv-lab/core'

import { GRID_MINUTES, gridMinutes, gridSlot } from './calendar-layout'
import { SLOT_MINUTES } from './use-slot-drag'
import { HOLD_MS, HOLD_SLOP, vibrate } from './use-touch-hold'
import type { SlotFrame } from './week-grid'

export type MoveSeed = SlotFrame & { gesture: 'move' | 'resize' }
type Press = {
	pointerId: number
	button: HTMLElement
	event: CalendarEventView
	touch: boolean
	timer: number
	x: number
	y: number
	lastX: number
	lastY: number
	offset: number
	started: boolean
	edge: -1 | 0 | 1
	edgeSince: number
}
export type LessonDrag = { eventKey: string; event: CalendarEventView; frame: SlotFrame | null; edge: -1 | 0 | 1 }

export const RESIZE_STRIP_SELECTOR = '[data-slot="calendar-event-resize"]'
export const CURRENT_COLUMNS = '[data-slot="week-grid-column"][data-page="current"]'
export const DRAG_THRESHOLD = 4
const EDGE_ZONE = 48
const SCROLL_STEP = 16
const TURN_EDGE = 32
const TURN_MS = 700

export function useEdgeScroll(
	bodyRef: RefObject<HTMLDivElement | null>,
	active: boolean,
	pointer: () => { x: number; y: number } | null,
	onScrolled: (x: number, y: number) => void
) {
	const pointerRef = useRef(pointer)
	const scrolledRef = useRef(onScrolled)
	useEffect(() => {
		pointerRef.current = pointer
		scrolledRef.current = onScrolled
	})
	useEffect(() => {
		if (!active) return
		let frameId = 0
		const tick = () => {
			const body = bodyRef.current
			const current = pointerRef.current()
			if (body && current) {
				const rect = body.getBoundingClientRect()
				const fromTop = current.y - rect.top
				const fromBottom = rect.bottom - current.y
				let delta = 0
				if (fromTop < EDGE_ZONE) delta = -Math.ceil((1 - Math.max(fromTop, 0) / EDGE_ZONE) * SCROLL_STEP)
				else if (fromBottom < EDGE_ZONE) delta = Math.ceil((1 - Math.max(fromBottom, 0) / EDGE_ZONE) * SCROLL_STEP)
				if (delta !== 0) {
					const before = body.scrollTop
					body.scrollTop = before + delta
					if (body.scrollTop !== before) scrolledRef.current(current.x, current.y)
				}
			}
			frameId = requestAnimationFrame(tick)
		}
		frameId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frameId)
	}, [active, bodyRef])
}

function sameFrame(left: SlotFrame | null, right: SlotFrame | null) {
	return (
		left === right ||
		(left !== null &&
			right !== null &&
			left.date === right.date &&
			left.time === right.time &&
			left.durationMinutes === right.durationMinutes)
	)
}

export function useLessonDrag(
	bodyRef: RefObject<HTMLDivElement | null>,
	hourHeight: number,
	events: readonly CalendarEventView[],
	mainTimeZone: string,
	enabled: boolean,
	canMove: (event: CalendarEventView) => boolean,
	onMove: (event: CalendarEventView, seed: MoveSeed) => void,
	heldRef: MutableRefObject<boolean>,
	onEdge?: (direction: 1 | -1) => void
) {
	const press = useRef<Press | null>(null)
	const suppressClick = useRef(false)
	const [drag, setDrag] = useState<LessonDrag | null>(null)
	const cancel = useCallback(() => {
		const previous = press.current
		press.current = null
		if (previous) {
			window.clearTimeout(previous.timer)
			if (previous.started) suppressClick.current = true
			if (previous.touch && previous.started) heldRef.current = false
			for (const node of [bodyRef.current, previous.button])
				if (node?.hasPointerCapture(previous.pointerId)) node.releasePointerCapture(previous.pointerId)
		}
		setDrag(null)
	}, [bodyRef, heldRef])
	useEffect(() => cancel, [mainTimeZone, cancel])
	useEffect(() => {
		const escape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape' || !press.current) return
			event.preventDefault()
			cancel()
		}
		document.addEventListener('keydown', escape)
		window.addEventListener('blur', cancel)
		return () => {
			document.removeEventListener('keydown', escape)
			window.removeEventListener('blur', cancel)
		}
	}, [cancel])
	const moving = drag !== null
	const destinationRef = useRef(destination)
	const edgeRef = useRef(onEdge)
	useEffect(() => {
		destinationRef.current = destination
		edgeRef.current = onEdge
	})
	useEdgeScroll(
		bodyRef,
		moving,
		() => (press.current?.started ? { x: press.current.lastX, y: press.current.lastY } : null),
		(x, y) => {
			const current = press.current
			if (!current) return
			const next = destinationRef.current(x, y, current)
			setDrag((previous) => (previous === null ? previous : { ...previous, frame: next }))
		}
	)
	useEffect(() => {
		if (!moving) return
		let frameId = 0
		const tick = () => {
			const current = press.current
			const body = bodyRef.current
			if (current?.started && body) {
				const columns = Array.from(body.querySelectorAll<HTMLElement>(CURRENT_COLUMNS))
				const first = columns.at(0)?.getBoundingClientRect()
				const last = columns.at(-1)?.getBoundingClientRect()
				let edge: -1 | 0 | 1 = 0
				if (first && last && edgeRef.current) {
					const zone = Math.min(TURN_EDGE, last.width / 4)
					if (current.lastX < first.left + 4) edge = -1
					else if (current.lastX > last.right - zone) edge = 1
				}
				const now = performance.now()
				if (edge !== current.edge) {
					current.edge = edge
					current.edgeSince = now
					setDrag((previous) => (previous === null ? previous : { ...previous, edge }))
				} else if (edge !== 0 && now - current.edgeSince >= TURN_MS) {
					current.edgeSince = now
					edgeRef.current?.(edge)
				}
				const next = destinationRef.current(current.lastX, current.lastY, current)
				setDrag((previous) =>
					previous === null || sameFrame(previous.frame, next) ? previous : { ...previous, frame: next }
				)
			}
			frameId = requestAnimationFrame(tick)
		}
		frameId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frameId)
	}, [moving, bodyRef])

	function begin(current: Press) {
		current.started = true
		const body = bodyRef.current
		try {
			body?.setPointerCapture(current.pointerId)
		} catch {}
		setDrag({
			eventKey: current.event.eventKey,
			event: current.event,
			frame: destination(current.lastX, current.lastY, current),
			edge: 0,
		})
	}

	function down(event: PointerEvent<HTMLDivElement>) {
		suppressClick.current = false
		if (!enabled || event.button !== 0 || !event.isPrimary) return
		const touch = event.pointerType === 'touch'
		if (!touch && event.target instanceof Element && event.target.closest(RESIZE_STRIP_SELECTOR)) return
		const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-event-key]') : null
		const source = events.find((item) => item.eventKey === button?.dataset.eventKey)
		if (!button || !source || source.when.kind !== 'timed' || !canMove(source)) return
		const column = button.closest<HTMLElement>('[data-slot="week-grid-column"]')
		const date = column?.dataset.date
		if (!column || !date) return
		const startMinutes = gridMinutes(new Date(source.when.startsAt), date, mainTimeZone)
		const current: Press = {
			pointerId: event.pointerId,
			button,
			event: source,
			touch,
			timer: 0,
			x: event.clientX,
			y: event.clientY,
			lastX: event.clientX,
			lastY: event.clientY,
			offset: event.clientY - column.getBoundingClientRect().top - (startMinutes * hourHeight) / 60,
			started: false,
			edge: 0,
			edgeSince: 0,
		}
		press.current = current
		if (!touch) {
			button.setPointerCapture(event.pointerId)
			return
		}
		current.timer = window.setTimeout(() => {
			if (press.current !== current) return
			heldRef.current = true
			vibrate()
			begin(current)
		}, HOLD_MS)
	}

	function destination(x: number, y: number, current: Press): SlotFrame | null {
		if (current.event.when.kind !== 'timed') return null
		const body = bodyRef.current
		if (!body) return null
		const viewport = body.getBoundingClientRect()
		if (y < viewport.top || y >= viewport.bottom) return null
		const columns = Array.from(body.querySelectorAll<HTMLElement>(CURRENT_COLUMNS))
		const first = columns.at(0)
		const last = columns.at(-1)
		const column =
			first && x < first.getBoundingClientRect().left
				? first
				: last && x >= last.getBoundingClientRect().right
					? last
					: columns.find((item) => {
							const rect = item.getBoundingClientRect()
							return x >= rect.left && x < rect.right
						})
		const date = column?.dataset.date
		if (!column || !date) return null
		const durationMinutes = (Date.parse(current.event.when.endsAt) - Date.parse(current.event.when.startsAt)) / 60000
		const snapped =
			Math.round((y - column.getBoundingClientRect().top - current.offset) / (hourHeight / 60) / SLOT_MINUTES) *
			SLOT_MINUTES
		const latest = Math.floor((GRID_MINUTES - durationMinutes) / SLOT_MINUTES) * SLOT_MINUTES
		if (latest < 0) return null
		const minutes = Math.min(Math.max(snapped, 0), latest)
		const slot = gridSlot(date, minutes)
		if (current.event.binding.kind === 'lesson') {
			try {
				zonedInstant(slot.date, slot.time, mainTimeZone)
			} catch {
				return null
			}
		}
		return { ...slot, durationMinutes }
	}

	function move(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.pointerId !== event.pointerId) return
		current.lastX = event.clientX
		current.lastY = event.clientY
		const distance = Math.hypot(event.clientX - current.x, event.clientY - current.y)
		if (!current.started) {
			if (current.touch) {
				if (distance > HOLD_SLOP) cancel()
				return
			}
			if (!enabled || !canMove(current.event)) return cancel()
			if (distance < DRAG_THRESHOLD) return
			begin(current)
		}
		event.preventDefault()
		event.stopPropagation()
		const next = destination(event.clientX, event.clientY, current)
		setDrag((previous) =>
			previous === null || sameFrame(previous.frame, next) ? previous : { ...previous, frame: next }
		)
	}

	function up(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.pointerId !== event.pointerId) return
		const seed = destination(event.clientX, event.clientY, current)
		const dragged = current.started
		cancel()
		if (!dragged) return
		event.preventDefault()
		event.stopPropagation()
		if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < DRAG_THRESHOLD) return
		const source = events.find((item) => item.eventKey === current.event.eventKey) ?? current.event
		if (JSON.stringify(source) !== JSON.stringify(current.event)) return
		if (!seed || source.when.kind !== 'timed') return
		if (zonedInstant(seed.date, seed.time, mainTimeZone).toISOString() === new Date(source.when.startsAt).toISOString())
			return
		onMove(source, { ...seed, gesture: 'move' })
	}

	function lost(event: PointerEvent<HTMLDivElement>) {
		if (event.target === event.currentTarget && press.current?.pointerId === event.pointerId) cancel()
	}

	function click(event: MouseEvent<HTMLDivElement>) {
		if (!suppressClick.current) return
		suppressClick.current = false
		event.preventDefault()
		event.stopPropagation()
	}
	return {
		drag,
		handlers: {
			onPointerDownCapture: down,
			onPointerMoveCapture: move,
			onPointerUpCapture: up,
			onPointerCancelCapture: cancel,
			onLostPointerCapture: lost,
			onClickCapture: click,
		},
	}
}
