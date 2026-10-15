import { useEffect, useRef, type RefObject } from 'react'

export const HOLD_MS = 450
export const HOLD_SLOP = 8

export function useTouchHold(bodyRef: RefObject<HTMLDivElement | null>) {
	const heldRef = useRef(false)
	useEffect(() => {
		const body = bodyRef.current
		if (!body) return
		let touching = false
		const down = (event: PointerEvent) => {
			touching = event.pointerType === 'touch'
		}
		const block = (event: TouchEvent) => {
			if (heldRef.current && event.cancelable) event.preventDefault()
		}
		const menu = (event: Event) => {
			if (touching) event.preventDefault()
		}
		body.addEventListener('pointerdown', down, true)
		body.addEventListener('touchmove', block, { passive: false })
		body.addEventListener('contextmenu', menu)
		return () => {
			body.removeEventListener('pointerdown', down, true)
			body.removeEventListener('touchmove', block)
			body.removeEventListener('contextmenu', menu)
		}
	}, [bodyRef])
	return heldRef
}

export function vibrate() {
	if (typeof navigator.vibrate === 'function') navigator.vibrate(10)
}
