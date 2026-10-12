import { useCallback, useEffect, useRef, useState, type PointerEvent, type MouseEvent, type RefObject } from 'react'

import type { CalendarEventView } from '@dv-lab/contracts'
import { scheduleDate, zonedInstant } from '@dv-lab/core'

import { clock, SLOT_MINUTES } from './use-slot-drag'
import type { SlotFrame } from './week-grid'

export type MoveSeed = Pick<SlotFrame, 'date' | 'time'>
type Press = {
	pointerId: number
	button: HTMLElement
	event: CalendarEventView
	x: number
	y: number
	lastX: number
	lastY: number
	offset: number
	started: boolean
}
type LessonDrag = { eventKey: string; frame: SlotFrame | null }

const EDGE_ZONE = 48
const SCROLL_STEP = 16

export function useLessonDrag(
	bodyRef: RefObject<HTMLDivElement | null>,
	hourHeight: number,
	events: readonly CalendarEventView[],
	mainTimeZone: string,
	enabled: boolean,
	canMove: (event: CalendarEventView) => boolean,
	onMove: (event: CalendarEventView, seed: MoveSeed) => void
) {
	const press = useRef<Press | null>(null)
	const suppressClick = useRef(false)
	const [drag, setDrag] = useState<LessonDrag | null>(null)
	const fingerprint = JSON.stringify(events)
	const cancel = useCallback(() => {
		const previous = press.current
		press.current = null
		if (previous?.started) suppressClick.current = true
		if (previous?.button.hasPointerCapture(previous.pointerId))
			previous.button.releasePointerCapture(previous.pointerId)
		setDrag(null)
	}, [])
	useEffect(() => cancel, [enabled, fingerprint, mainTimeZone, cancel])
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
	useEffect(() => {
		destinationRef.current = destination
	})
	useEffect(() => {
		if (!moving) return
		let frameId = 0
		const tick = () => {
			const body = bodyRef.current
			const current = press.current
			if (body && current?.started) {
				const rect = body.getBoundingClientRect()
				const fromTop = current.lastY - rect.top
				const fromBottom = rect.bottom - current.lastY
				let delta = 0
				if (fromTop < EDGE_ZONE) delta = -Math.ceil((1 - Math.max(fromTop, 0) / EDGE_ZONE) * SCROLL_STEP)
				else if (fromBottom < EDGE_ZONE) delta = Math.ceil((1 - Math.max(fromBottom, 0) / EDGE_ZONE) * SCROLL_STEP)
				if (delta !== 0) {
					const before = body.scrollTop
					body.scrollTop = before + delta
					if (body.scrollTop !== before) {
						const next = destinationRef.current(current.lastX, current.lastY, current)
						setDrag((previous) => (previous === null ? previous : { ...previous, frame: next }))
					}
				}
			}
			frameId = requestAnimationFrame(tick)
		}
		frameId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frameId)
	}, [moving, bodyRef])

	function down(event: PointerEvent<HTMLDivElement>) {
		suppressClick.current = false
		if (!enabled || event.button !== 0 || event.pointerType === 'touch' || !event.isPrimary) return
		const button = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-event-key]') : null
		const source = events.find((item) => item.eventKey === button?.dataset.eventKey)
		if (!button || !source || source.when.kind !== 'timed' || !canMove(source)) return
		const column = button.closest<HTMLElement>('[data-slot="week-grid-column"]')
		if (column?.dataset.date !== scheduleDate(new Date(source.when.startsAt), mainTimeZone)) return
		press.current = {
			pointerId: event.pointerId,
			button,
			event: source,
			x: event.clientX,
			y: event.clientY,
			lastX: event.clientX,
			lastY: event.clientY,
			offset: event.clientY - button.getBoundingClientRect().top,
			started: false,
		}
		button.setPointerCapture(event.pointerId)
	}

	function destination(x: number, y: number, current: Press): SlotFrame | null {
		if (current.event.when.kind !== 'timed') return null
		const body = bodyRef.current
		if (!body) return null
		const viewport = body.getBoundingClientRect()
		if (y < viewport.top || y >= viewport.bottom) return null
		const column = Array.from(body.querySelectorAll<HTMLElement>('[data-slot="week-grid-column"]')).find((item) => {
			const rect = item.getBoundingClientRect()
			return x >= rect.left && x < rect.right
		})
		const date = column?.dataset.date
		if (!column || !date) return null
		const durationMinutes = (Date.parse(current.event.when.endsAt) - Date.parse(current.event.when.startsAt)) / 60000
		const snapped =
			Math.round((y - column.getBoundingClientRect().top - current.offset) / (hourHeight / 60) / SLOT_MINUTES) *
			SLOT_MINUTES
		const latest = Math.floor((1440 - durationMinutes) / SLOT_MINUTES) * SLOT_MINUTES
		if (latest < 0) return null
		const minutes = Math.min(Math.max(snapped, 0), latest)
		const time = clock(minutes)
		try {
			if (zonedInstant(date, time, mainTimeZone).getTime() <= Date.now()) return null
		} catch {
			return null
		}
		return { date, time, durationMinutes }
	}

	function move(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.pointerId !== event.pointerId) return
		if (!enabled || !canMove(current.event)) return cancel()
		current.lastX = event.clientX
		current.lastY = event.clientY
		if (!current.started && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return
		current.started = true
		event.preventDefault()
		event.stopPropagation()
		const next = destination(event.clientX, event.clientY, current)
		setDrag({ eventKey: current.event.eventKey, frame: next })
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
		if (Math.hypot(event.clientX - current.x, event.clientY - current.y) < 4) return
		const source = events.find((item) => item.eventKey === current.event.eventKey)
		if (!enabled || !source || !canMove(source) || JSON.stringify(source) !== JSON.stringify(current.event)) return
		if (!seed || source.when.kind !== 'timed') return
		if (zonedInstant(seed.date, seed.time, mainTimeZone).toISOString() === new Date(source.when.startsAt).toISOString())
			return
		onMove(source, seed)
	}

	function click(event: MouseEvent<HTMLDivElement>) {
		if (!suppressClick.current) return
		suppressClick.current = false
		event.preventDefault()
		event.stopPropagation()
	}
	return {
		drag: enabled ? drag : null,
		handlers: {
			onPointerDownCapture: down,
			onPointerMoveCapture: move,
			onPointerUpCapture: up,
			onPointerCancelCapture: cancel,
			onLostPointerCapture: cancel,
			onClickCapture: click,
		},
	}
}
