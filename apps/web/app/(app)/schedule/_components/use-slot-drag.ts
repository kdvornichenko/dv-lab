import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'

import { lessonDayClock, lessonDaySlot } from '@dv-lab/core'

import type { SlotChoice } from './week-grid'

export const SLOT_MINUTES = 15
const DAY_MINUTES = 24 * 60
const SLOTS_PER_DAY = DAY_MINUTES / SLOT_MINUTES
const DRAG_THRESHOLD = 4
const CLICK_FRAME_MINUTES = 60
const EDGE_ZONE = 48
const SCROLL_STEP = 16

export function clock(minutes: number): string {
	return lessonDayClock(minutes)
}

function slotAt(clientY: number, columnTop: number, slotHeight: number): number {
	return Math.max(0, Math.min(SLOTS_PER_DAY - 1, Math.floor((clientY - columnTop) / slotHeight)))
}

interface DragState {
	date: string
	anchor: number
	slot: number
}

interface Press {
	pointerId: number
	date: string
	column: HTMLElement
	startX: number
	startY: number
	lastY: number
	anchor: number
	slot: number
	started: boolean
}

export function useSlotDrag(
	bodyRef: RefObject<HTMLDivElement | null>,
	hourHeight: number,
	onSlot: ((choice: SlotChoice) => void) | undefined,
	enabled: boolean
) {
	const SLOT_HEIGHT = (hourHeight * SLOT_MINUTES) / 60
	const pressRef = useRef<Press | null>(null)
	const [drag, setDrag] = useState<DragState | null>(null)
	const dragging = enabled && drag !== null

	const cancelDrag = useCallback(() => {
		const press = pressRef.current
		pressRef.current = null
		if (press) {
			try {
				press.column.releasePointerCapture(press.pointerId)
			} catch {}
		}
		setDrag(null)
	}, [])

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
					if (body.scrollTop !== before) {
						const slot = slotAt(press.lastY, press.column.getBoundingClientRect().top, SLOT_HEIGHT)
						press.slot = slot
						setDrag((current) => (current && current.slot !== slot ? { ...current, slot } : current))
					}
				}
			}
			frameId = requestAnimationFrame(tick)
		}
		frameId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frameId)
	}, [dragging, bodyRef, SLOT_HEIGHT])

	function pressColumn(event: ReactPointerEvent<HTMLDivElement>, date: string) {
		if (!enabled || !onSlot || event.target !== event.currentTarget) return
		if (event.button !== 0 || event.pointerType === 'touch') return
		const column = event.currentTarget
		pressRef.current = {
			pointerId: event.pointerId,
			date,
			column,
			startX: event.clientX,
			startY: event.clientY,
			lastY: event.clientY,
			anchor: slotAt(event.clientY, column.getBoundingClientRect().top, SLOT_HEIGHT),
			slot: slotAt(event.clientY, column.getBoundingClientRect().top, SLOT_HEIGHT),
			started: false,
		}
		try {
			column.setPointerCapture(event.pointerId)
		} catch {}
	}

	function moveColumn(event: ReactPointerEvent<HTMLDivElement>) {
		if (!enabled) return cancelDrag()
		const press = pressRef.current
		if (!press || event.pointerId !== press.pointerId) return
		press.lastY = event.clientY
		if (!press.started) {
			if (Math.hypot(event.clientX - press.startX, event.clientY - press.startY) < DRAG_THRESHOLD) return
			press.started = true
		}
		const slot = slotAt(event.clientY, press.column.getBoundingClientRect().top, SLOT_HEIGHT)
		press.slot = slot
		setDrag((current) =>
			current && current.date === press.date && current.anchor === press.anchor && current.slot === slot
				? current
				: { date: press.date, anchor: press.anchor, slot }
		)
	}

	function releaseColumn(event: ReactPointerEvent<HTMLDivElement>) {
		if (!enabled) return cancelDrag()
		const press = pressRef.current
		if (!press || event.pointerId !== press.pointerId) return
		const slot = press.slot
		pressRef.current = null
		try {
			press.column.releasePointerCapture(press.pointerId)
		} catch {}
		setDrag(null)
		if (!press.started) {
			onSlot?.({
				...lessonDaySlot(press.date, press.anchor * SLOT_MINUTES),
				durationMinutes: CLICK_FRAME_MINUTES,
				dragged: false,
			})
			return
		}
		const low = Math.min(press.anchor, slot)
		onSlot?.({
			...lessonDaySlot(press.date, low * SLOT_MINUTES),
			durationMinutes: (Math.abs(slot - press.anchor) + 1) * SLOT_MINUTES,
			dragged: true,
		})
	}

	return { drag: enabled ? drag : null, dragging, cancelDrag, pressColumn, moveColumn, releaseColumn }
}
