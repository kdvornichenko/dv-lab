'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

import { animate, useMotionValue, useReducedMotion, type AnimationPlaybackControls } from 'motion/react'

import { spring } from '@/lib/springs'

import { addDays } from '@dv-lab/core'

const LOCK_DISTANCE = 8
const LOCK_RATIO = 1.2
const EDGE_ZONE = 24
const COMMIT_SHARE = 0.25
const COMMIT_SPEED = 0.3
const SAMPLE_WINDOW_MS = 100
const FADE_SECONDS = 0.06
const WEEK_MS = 7 * 86400000
const SETTLE = { type: spring.slow.type, duration: spring.slow.duration, bounce: 0 } as const

interface Gesture {
	id: number
	startX: number
	startY: number
	rest: number
	locked: boolean
	rejected: boolean
	samples: { time: number; x: number }[]
}

function weeksBetween(from: string, to: string): number {
	return Math.round((Date.parse(to) - Date.parse(from)) / WEEK_MS)
}

export function useWeekPager({
	monday,
	enabled,
	onTurn,
}: {
	monday: string
	enabled: boolean
	onTurn: (monday: string) => void
}) {
	const reduced = useReducedMotion() ?? false
	const x = useMotionValue(0)
	const opacity = useMotionValue(1)
	const [base, setBase] = useState(monday)
	const [settled, setSettled] = useState(monday)
	const [wasEnabled, setWasEnabled] = useState(enabled)
	if (wasEnabled !== enabled) {
		setWasEnabled(enabled)
		setBase(monday)
		setSettled(monday)
	}
	const baseRef = useRef(monday)
	const clipRef = useRef<HTMLDivElement | null>(null)
	const token = useRef(0)
	const playing = useRef<AnimationPlaybackControls | null>(null)
	const target = useRef<{ monday: string; fade: boolean } | null>(null)
	const shift = useRef(0)
	const after = useRef<(() => void) | null>(null)
	const gesture = useRef<Gesture | null>(null)
	const suppress = useRef(false)
	const turn = useRef(onTurn)
	useEffect(() => {
		turn.current = onTurn
	}, [onTurn])

	const width = useCallback(() => clipRef.current?.clientWidth ?? 0, [])

	const moveBase = useCallback(
		(next: string, then?: () => void) => {
			if (next === baseRef.current) {
				if (shift.current !== 0 && then) after.current = then
				else then?.()
				return
			}
			shift.current += weeksBetween(baseRef.current, next) * width()
			baseRef.current = next
			after.current = then ?? null
			setBase(next)
			setSettled(next)
		},
		[width]
	)

	const swapBase = useCallback(
		(next: string, then?: () => void) => {
			shift.current = 0
			x.set(0)
			if (next === baseRef.current) {
				then?.()
				return
			}
			baseRef.current = next
			after.current = then ?? null
			setBase(next)
			setSettled(next)
		},
		[x]
	)

	useLayoutEffect(() => {
		if (shift.current !== 0) {
			x.set(x.get() + shift.current)
			shift.current = 0
		}
		const run = after.current
		after.current = null
		run?.()
	}, [base, x])

	const stop = useCallback(() => {
		token.current++
		playing.current?.stop()
		playing.current = null
		opacity.set(1)
		const pending = target.current
		target.current = null
		if (pending === null) return
		if (pending.fade) swapBase(pending.monday)
		else moveBase(pending.monday)
	}, [opacity, swapBase, moveBase])

	const fadeTo = useCallback(
		(next: string) => {
			const id = ++token.current
			target.current = { monday: next, fade: true }
			const out = animate(opacity, 0, { duration: FADE_SECONDS, ease: 'linear' })
			playing.current = out
			void out.then(() => {
				if (id !== token.current) return
				target.current = null
				swapBase(next, () => {
					const back = animate(opacity, 1, { duration: FADE_SECONDS, ease: 'linear' })
					playing.current = back
				})
			})
		},
		[opacity, swapBase]
	)

	const slide = useCallback(
		(direction: 1 | -1, velocity: number) => {
			const next = addDays(baseRef.current, 7 * direction)
			const id = ++token.current
			target.current = { monday: next, fade: false }
			const controls = animate(x, -direction * width(), { ...SETTLE, velocity })
			playing.current = controls
			void controls.then(() => {
				if (id !== token.current) return
				playing.current = null
				target.current = null
				moveBase(next)
			})
		},
		[x, width, moveBase]
	)

	const springBack = useCallback(
		(velocity: number) => {
			const id = ++token.current
			const controls = animate(x, 0, reduced ? { duration: 0.12, ease: 'easeOut' } : { ...SETTLE, velocity })
			playing.current = controls
			void controls.then(() => {
				if (id === token.current) playing.current = null
			})
		},
		[x, reduced]
	)

	const commit = useCallback(
		(direction: 1 | -1, velocity: number) => {
			const next = addDays(baseRef.current, 7 * direction)
			turn.current(next)
			if (reduced) fadeTo(next)
			else slide(direction, velocity)
		},
		[reduced, fadeTo, slide]
	)

	useEffect(() => {
		if (!enabled) {
			stop()
			x.set(0)
			shift.current = 0
			baseRef.current = monday
			return
		}
		const heading = target.current?.monday ?? baseRef.current
		if (monday === heading) return
		const resume = target.current
		stop()
		const diff = weeksBetween(resume === null ? baseRef.current : resume.monday, monday)
		const origin = resume === null ? baseRef.current : resume.monday
		if (Math.abs(diff) === 1 && !reduced) moveBase(origin, () => slide(diff > 0 ? 1 : -1, 0))
		else fadeTo(monday)
	}, [monday, enabled, reduced, stop, x, moveBase, slide, fadeTo])

	useEffect(() => stop, [stop])

	function release(current: Gesture, clientX: number, cancelled: boolean) {
		gesture.current = null
		const span = width()
		const first = current.samples[0]
		const last = current.samples[current.samples.length - 1]
		const speed =
			!cancelled && first !== undefined && last !== undefined && last.time > first.time
				? (last.x - first.x) / (last.time - first.time)
				: 0
		const moved = x.get()
		const pulled = clientX - current.startX
		let direction: 1 | -1 | 0 = 0
		if (!cancelled && span > 0) {
			if (Math.abs(moved) >= span * COMMIT_SHARE) direction = moved < 0 ? 1 : -1
			else if (Math.abs(speed) >= COMMIT_SPEED && Math.sign(speed) === Math.sign(pulled)) direction = speed < 0 ? 1 : -1
		}
		if (direction === 0) springBack(speed * 1000)
		else commit(direction, speed * 1000)
	}

	const frameProps = enabled
		? {
				style: { touchAction: 'pan-y' as const },
				onPointerDown: (event: PointerEvent<HTMLElement>) => {
					if (event.button !== 0 || !event.isPrimary) return
					suppress.current = false
					if (event.clientX < EDGE_ZONE || event.clientX > window.innerWidth - EDGE_ZONE) return
					stop()
					gesture.current = {
						id: event.pointerId,
						startX: event.clientX,
						startY: event.clientY,
						rest: x.get() + shift.current,
						locked: false,
						rejected: false,
						samples: [],
					}
				},
				onPointerMove: (event: PointerEvent<HTMLElement>) => {
					const current = gesture.current
					if (current === null || event.pointerId !== current.id || current.rejected) return
					const dx = event.clientX - current.startX
					const dy = event.clientY - current.startY
					if (!current.locked) {
						if (Math.hypot(dx, dy) < LOCK_DISTANCE) return
						if (Math.abs(dx) <= LOCK_RATIO * Math.abs(dy)) {
							current.rejected = true
							return
						}
						current.locked = true
						suppress.current = true
						try {
							event.currentTarget.setPointerCapture(event.pointerId)
						} catch {}
					}
					const span = width()
					x.set(Math.max(-span, Math.min(span, current.rest + dx)))
					current.samples.push({ time: event.timeStamp, x: event.clientX })
					while (current.samples.length > 1 && event.timeStamp - current.samples[0].time > SAMPLE_WINDOW_MS)
						current.samples.shift()
				},
				onPointerUp: (event: PointerEvent<HTMLElement>) => {
					const current = gesture.current
					if (current === null || event.pointerId !== current.id) return
					if (!current.locked) {
						gesture.current = null
						return
					}
					release(current, event.clientX, false)
					setTimeout(() => {
						suppress.current = false
					}, 80)
				},
				onPointerCancel: (event: PointerEvent<HTMLElement>) => {
					const current = gesture.current
					if (current === null || event.pointerId !== current.id) return
					if (!current.locked) {
						gesture.current = null
						return
					}
					release(current, event.clientX, true)
					setTimeout(() => {
						suppress.current = false
					}, 80)
				},
				onClickCapture: (event: MouseEvent<HTMLElement>) => {
					if (!suppress.current) return
					suppress.current = false
					event.preventDefault()
					event.stopPropagation()
				},
			}
		: {}

	return { base: enabled ? base : monday, settled: enabled ? settled : monday, x, opacity, clipRef, frameProps }
}
