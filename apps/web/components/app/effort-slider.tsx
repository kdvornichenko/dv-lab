'use client'

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'

import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { CHAT_EFFORTS, type ChatEffort } from '@dv-lab/contracts'

export const EFFORT_LABEL: Record<ChatEffort, string> = {
	low: 'Low',
	medium: 'Medium',
	high: 'High',
	xhigh: 'Extra high',
	max: 'Max',
}

const LAST = CHAT_EFFORTS.length - 1
const THUMB = 16
const EASE = 'ease-[cubic-bezier(0.23,1,0.32,1)]'
const DRAG_THRESHOLD = 3
const KEY_PAUSE = 400

const KEYS = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'Home', 'End']

const rank = (level: ChatEffort) => CHAT_EFFORTS.indexOf(level)

export function clampEffort(supported: readonly ChatEffort[], wanted: ChatEffort): ChatEffort {
	const sorted = [...supported].sort((left, right) => rank(left) - rank(right))
	let chosen: ChatEffort | undefined
	for (const level of sorted) if (rank(level) <= rank(wanted)) chosen = level
	return chosen ?? sorted[0] ?? wanted
}

export function highestEffort(supported: readonly ChatEffort[]): ChatEffort {
	return [...supported].sort((left, right) => rank(left) - rank(right)).at(-1) ?? 'medium'
}

export function EffortMeter({ level, className }: { level: ChatEffort; className?: string }) {
	const filled = rank(level)
	return (
		<svg width="14" height="14" viewBox="0 0 16 14" aria-hidden className={cn('shrink-0', className)}>
			{CHAT_EFFORTS.map((name, index) => (
				<rect
					key={name}
					x={1 + index * 3}
					y={11 - index * 2}
					width="2"
					height={2 + index * 2}
					rx="1"
					fill="currentColor"
					className={cn('transition-opacity duration-160 motion-reduce:transition-none', EASE)}
					style={{ opacity: index <= filled ? 1 : 0.3 }}
				/>
			))}
		</svg>
	)
}

const position = (index: number) => `calc(${THUMB / 2}px + ${index} * (100% - ${THUMB}px) / ${LAST})`

export function EffortSlider({
	value,
	supported,
	modelName,
	marker,
	markerAt,
	disabled = false,
	label,
	thumbRef,
	commit: mode = 'change',
	onPreview,
	onChange,
}: {
	value: ChatEffort
	supported: readonly ChatEffort[]
	modelName: string
	marker: string | null
	markerAt: ChatEffort | null
	disabled?: boolean
	label: string
	thumbRef?: RefObject<HTMLDivElement | null>
	commit?: 'change' | 'release'
	onPreview?: (level: ChatEffort) => void
	onChange: (level: ChatEffort) => unknown
}) {
	const reachable = CHAT_EFFORTS.map((level, at) => (supported.includes(level) ? at : -1)).filter((at) => at >= 0)
	const lowest = reachable[0] ?? 0
	const highest = reachable.at(-1) ?? LAST
	const markerIndex = markerAt === null ? null : rank(markerAt)
	const [shown, setShown] = useState(rank(value))
	const [drag, setDrag] = useState<number | null>(null)
	const track = useRef<HTMLDivElement>(null)
	const ownThumb = useRef<HTMLDivElement>(null)
	const thumb = thumbRef ?? ownThumb
	const sent = useRef(value)
	const busy = useRef(false)
	const queued = useRef<ChatEffort | null>(null)
	const press = useRef<{ id: number; x: number; moved: boolean; last: number } | null>(null)
	const hold = useRef<{ at: number; timer: ReturnType<typeof setTimeout> } | null>(null)

	useEffect(() => {
		sent.current = value
		if (!busy.current) setShown(rank(value))
	}, [value])

	useEffect(
		() => () => {
			if (hold.current) clearTimeout(hold.current.timer)
		},
		[]
	)

	const nearest = (target: number) => {
		let chosen = reachable[0] ?? 0
		let distance = Number.POSITIVE_INFINITY
		for (const at of reachable) {
			const gap = Math.abs(at - target)
			if (gap < distance) {
				distance = gap
				chosen = at
			}
		}
		return chosen
	}

	const shownIndex = drag === null ? shown : nearest(Math.round(drag))
	const fraction = (drag ?? shown) / LAST

	useEffect(() => {
		const level = CHAT_EFFORTS[shownIndex]
		if (level !== undefined) onPreview?.(level)
	}, [shownIndex, onPreview])

	async function commit(at: number) {
		const level = CHAT_EFFORTS[at]
		if (level === undefined) return
		if (busy.current) {
			queued.current = level
			return
		}
		busy.current = true
		let next: ChatEffort | null = level
		while (next !== null) {
			queued.current = null
			const current: ChatEffort = next
			if (current !== sent.current) {
				const result = await onChange(current)
				if (result === false) {
					queued.current = null
					setShown(rank(sent.current))
				} else sent.current = current
			}
			next = queued.current
		}
		busy.current = false
	}

	function cancelHold() {
		if (!hold.current) return
		clearTimeout(hold.current.timer)
		hold.current = null
	}

	function flushHold() {
		const current = hold.current
		if (!current) return
		cancelHold()
		void commit(current.at)
	}

	function select(at: number) {
		if (at === shown) return
		setShown(at)
		if (mode === 'change') {
			void commit(at)
			return
		}
		cancelHold()
		hold.current = { at, timer: setTimeout(flushHold, KEY_PAUSE) }
	}

	function pointerIndex(clientX: number) {
		const rect = track.current?.getBoundingClientRect()
		if (!rect || rect.width <= THUMB) return shown
		const raw = ((clientX - rect.left - THUMB / 2) / (rect.width - THUMB)) * LAST
		return Math.min(highest, Math.max(lowest, raw))
	}

	function onPointerDown(event: PointerEvent<HTMLDivElement>) {
		if (disabled || event.button !== 0) return
		event.preventDefault()
		event.currentTarget.setPointerCapture(event.pointerId)
		thumb.current?.focus({ preventScroll: true })
		const at = nearest(Math.round(pointerIndex(event.clientX)))
		press.current = { id: event.pointerId, x: event.clientX, moved: false, last: at }
		if (mode === 'change') select(at)
		else {
			cancelHold()
			setShown(at)
		}
	}

	function onPointerMove(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.id !== event.pointerId) return
		if (!current.moved && Math.abs(event.clientX - current.x) < DRAG_THRESHOLD) return
		current.moved = true
		const raw = pointerIndex(event.clientX)
		setDrag(raw)
		const at = nearest(Math.round(raw))
		if (at !== current.last) {
			current.last = at
			setShown(at)
			if (mode === 'change') void commit(at)
		}
	}

	function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
		const current = press.current
		if (!current || current.id !== event.pointerId) return
		press.current = null
		if (mode === 'release') void commit(current.last)
		if (event.currentTarget.hasPointerCapture(event.pointerId))
			event.currentTarget.releasePointerCapture(event.pointerId)
		setDrag(null)
	}

	function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (disabled || event.altKey || event.ctrlKey || event.metaKey) return
		let target: number | undefined
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') target = reachable.find((at) => at > shown)
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
			target = [...reachable].reverse().find((at) => at < shown)
		else if (event.key === 'Home') target = lowest
		else if (event.key === 'End') target = highest
		else return
		event.preventDefault()
		if (target !== undefined) select(target)
	}

	function onKeyUp(event: KeyboardEvent<HTMLDivElement>) {
		if (mode === 'release' && KEYS.includes(event.key)) flushHold()
	}

	const move = cn(
		'transition-transform duration-160 motion-reduce:transition-none',
		EASE,
		drag !== null && 'transition-none'
	)

	return (
		<div className="flex w-full flex-col" data-slot="effort-slider">
			<div className="relative mb-1 h-3.5" aria-hidden={marker === null}>
				{marker !== null && markerIndex !== null ? (
					<span
						className={cn(
							'absolute top-0 text-micro whitespace-nowrap text-muted-foreground',
							markerIndex === 0 ? '' : markerIndex === LAST ? '-translate-x-full' : '-translate-x-1/2'
						)}
						style={{ left: markerIndex === 0 ? 0 : position(markerIndex) }}
						data-slot="effort-marker"
					>
						{marker}
					</span>
				) : null}
			</div>
			<div
				className={cn(
					'relative flex h-6 w-full touch-none items-center select-none',
					disabled ? 'opacity-50' : 'cursor-pointer'
				)}
				onPointerDown={onPointerDown}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerEnd}
				onPointerCancel={onPointerEnd}
			>
				<div ref={track} className="relative h-1 w-full rounded-sm bg-selected">
					<span aria-hidden className="absolute inset-y-0 left-0 w-2 rounded-l-sm bg-primary" />
					<span
						aria-hidden
						className={cn('absolute inset-y-0 right-2 left-2 origin-left bg-primary', move)}
						style={{ transform: `scaleX(${fraction})` }}
					/>
					{CHAT_EFFORTS.map((level, at) => {
						const reachableLevel = supported.includes(level)
						const dot = (
							<i
								aria-hidden
								className={cn(
									'absolute top-0 size-1 -translate-x-1/2 rounded-full bg-muted-foreground transition-opacity duration-120 motion-reduce:transition-none',
									EASE,
									at <= shownIndex ? 'opacity-0' : reachableLevel ? 'opacity-60' : 'opacity-30'
								)}
								style={{ left: position(at) }}
							/>
						)
						if (reachableLevel) return <span key={level}>{dot}</span>
						return (
							<span key={level}>
								{dot}
								<Tooltip content={`Not available for ${modelName}`} side="top">
									<span
										className="absolute -top-2 size-5 -translate-x-1/2 cursor-default"
										style={{ left: position(at) }}
										data-slot="effort-unavailable"
										data-level={level}
									/>
								</Tooltip>
							</span>
						)
					})}
					<div
						className={cn('pointer-events-none absolute -top-1.5 left-0 h-4 w-[calc(100%-1rem)]', move)}
						style={{ transform: `translateX(${fraction * 100}%)` }}
					>
						<div
							ref={thumb}
							role="slider"
							tabIndex={disabled ? -1 : 0}
							aria-label={label}
							aria-orientation="horizontal"
							aria-valuemin={0}
							aria-valuemax={LAST}
							aria-valuenow={shownIndex}
							aria-valuetext={EFFORT_LABEL[CHAT_EFFORTS[shownIndex] ?? 'medium']}
							aria-disabled={disabled || undefined}
							data-slot="effort-thumb"
							className="pointer-events-auto absolute top-0 left-0 size-4 rounded-full bg-primary-foreground shadow-surface-2 ring-2 ring-primary outline-none focus-visible:ring-[3px]"
							onKeyDown={onKeyDown}
							onKeyUp={onKeyUp}
							onBlur={flushHold}
						/>
					</div>
				</div>
			</div>
			<div className="mt-1.5 flex justify-between text-micro text-muted-foreground">
				<span>Faster</span>
				<span>Smarter</span>
			</div>
		</div>
	)
}
