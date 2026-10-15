import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type MutableRefObject,
	type PointerEvent as ReactPointerEvent,
	type RefObject,
} from 'react'

import { GRID_MINUTES, gridClock, gridSlot } from './calendar-layout'
import { HOLD_MS, HOLD_SLOP, vibrate } from './use-touch-hold'
import type { SlotChoice } from './week-grid'

export const SLOT_MINUTES = 15
const GRID_SLOTS = GRID_MINUTES / SLOT_MINUTES
const DRAG_THRESHOLD = 4
const CLICK_FRAME_MINUTES = 60
const TOUCH_FRAME_SLOTS = CLICK_FRAME_MINUTES / SLOT_MINUTES
const EDGE_ZONE = 48
const SCROLL_STEP = 16

export function clock(minutes: number): string {
	return gridClock(minutes)
}

function slotAt(clientY: number, columnTop: number, slotHeight: number): number {
	return Math.max(0, Math.min(GRID_SLOTS - 1, Math.floor((clientY - columnTop) / slotHeight)))
}

interface DragState {
	date: string
	start: number
	end: number
}

interface Press {
	pointerId: number
	date: string
	column: HTMLElement
	touch: boolean
	timer: number
	startX: number
	startY: number
	lastY: number
	offset: number
	anchor: number
	start: number
	end: number
	started: boolean
}

export function useSlotDrag(
	bodyRef: RefObject<HTMLDivElement | null>,
	hourHeight: number,
	onSlot: ((choice: SlotChoice) => void) | undefined,
	enabled: boolean,
	heldRef: MutableRefObject<boolean>
) {
	const SLOT_HEIGHT = (hourHeight * SLOT_MINUTES) / 60
	const pressRef = useRef<Press | null>(null)
	const [drag, setDrag] = useState<DragState | null>(null)
	const dragging = enabled && drag !== null

	const cancelDrag = useCallback(() => {
		const press = pressRef.current
		pressRef.current = null
		if (press) {
			window.clearTimeout(press.timer)
			if (press.started && press.touch) heldRef.current = false
			try {
				press.column.releasePointerCapture(press.pointerId)
			} catch {}
		}
		setDrag(null)
	}, [heldRef])

	const rangeAt = useCallback(
		(press: Press, clientY: number) => {
			const top = press.column.getBoundingClientRect().top
			if (!press.touch) {
				const slot = slotAt(clientY, top, SLOT_HEIGHT)
				return { start: Math.min(press.anchor, slot), end: Math.max(press.anchor, slot) + 1 }
			}
			const shift = Math.round((clientY - top - press.offset) / SLOT_HEIGHT)
			const edge = Math.max(0, Math.min(GRID_SLOTS, press.anchor + TOUCH_FRAME_SLOTS + shift))
			const start = Math.min(press.anchor, edge)
			const end = Math.max(press.anchor, edge)
			return end === start ? { start, end: start + 1 } : { start, end }
		},
		[SLOT_HEIGHT]
	)

	const show = useCallback(
		(press: Press, clientY: number) => {
			const range = rangeAt(press, clientY)
			press.start = range.start
			press.end = range.end
			setDrag((current) =>
				current && current.date === press.date && current.start === range.start && current.end === range.end
					? current
					: { date: press.date, ...range }
			)
		},
		[rangeAt]
	)

	useEffect(() => {
		return cancelDrag
	}, [enabled, cancelDrag])

	useEffect(() => {
		if (!dragging) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return
			event.preventDefault()
			cancelDrag()
		}
		document.addEventListener('keydown', onKey)
		window.addEventListener('blur', cancelDrag)
		return () => {
			document.removeEventListener('keydown', onKey)
			window.removeEventListener('blur', cancelDrag)
		}
	}, [dragging, cancelDrag])

	useEffect(() => {
		if (!dragging) return
		let frameId = 0
		const tick = () => {
			const body = bodyRef.current
			const press = pressRef.current
			if (body && press && press.started) {
				const rect = body.getBoundingClientRect()
				const fromTop = press.lastY - rect.top
				const fromBottom = rect.bottom - press.lastY
				let delta = 0
				if (fromTop < EDGE_ZONE) delta = -Math.ceil((1 - Math.max(fromTop, 0) / EDGE_ZONE) * SCROLL_STEP)
				else if (fromBottom < EDGE_ZONE) delta = Math.ceil((1 - Math.max(fromBottom, 0) / EDGE_ZONE) * SCROLL_STEP)
				if (delta !== 0) {
					const before = body.scrollTop
					body.scrollTop = before + delta
					if (body.scrollTop !== before) show(press, press.lastY)
				}
			}
			frameId = requestAnimationFrame(tick)
		}
		frameId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frameId)
	}, [dragging, bodyRef, show])

	function pressColumn(event: ReactPointerEvent<HTMLDivElement>, date: string) {
		if (!enabled || !onSlot || event.target !== event.currentTarget) return
		if (event.button !== 0 || !event.isPrimary) return
		const column = event.currentTarget
		const top = column.getBoundingClientRect().top
		const anchor = slotAt(event.clientY, top, SLOT_HEIGHT)
		const press: Press = {
			pointerId: event.pointerId,
			date,
			column,
			touch: event.pointerType === 'touch',
			timer: 0,
			startX: event.clientX,
			startY: event.clientY,
			lastY: event.clientY,
			offset: event.clientY - top,
			anchor,
			start: anchor,
			end: anchor + 1,
			started: false,
		}
		pressRef.current = press
		if (press.touch) {
			press.timer = window.setTimeout(() => {
				if (pressRef.current !== press) return
				press.started = true
				heldRef.current = true
				try {
					column.setPointerCapture(press.pointerId)
				} catch {}
				vibrate()
				show(press, press.lastY)
			}, HOLD_MS)
			return
		}
		try {
			column.setPointerCapture(event.pointerId)
		} catch {}
	}

	function moveColumn(event: ReactPointerEvent<HTMLDivElement>) {
		const press = pressRef.current
		if (!press || event.pointerId !== press.pointerId) return
		if (!enabled) return cancelDrag()
		press.lastY = event.clientY
		const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY)
		if (!press.started) {
			if (press.touch) {
				if (distance > HOLD_SLOP) cancelDrag()
				return
			}
			if (distance < DRAG_THRESHOLD) return
			press.started = true
		}
		show(press, event.clientY)
	}

	function releaseColumn(event: ReactPointerEvent<HTMLDivElement>) {
		const press = pressRef.current
		if (!press || event.pointerId !== press.pointerId) return
		if (!enabled) return cancelDrag()
		const { start, end, started } = press
		cancelDrag()
		if (!started) {
			onSlot?.({
				...gridSlot(press.date, press.anchor * SLOT_MINUTES),
				durationMinutes: CLICK_FRAME_MINUTES,
				dragged: false,
			})
			return
		}
		onSlot?.({
			...gridSlot(press.date, start * SLOT_MINUTES),
			durationMinutes: (end - start) * SLOT_MINUTES,
			dragged: true,
		})
	}

	return { drag: enabled ? drag : null, dragging, cancelDrag, pressColumn, moveColumn, releaseColumn }
}
