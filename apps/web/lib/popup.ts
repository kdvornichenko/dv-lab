import { useEffect, useState, type RefObject } from 'react'

export const popupMotionClass =
	'origin-top [--popup-enter-y:-4px] ' +
	'data-[side=top]:origin-bottom data-[side=top]:[--popup-enter-y:4px] ' +
	'[[data-side=top]_&]:origin-bottom [[data-side=top]_&]:[--popup-enter-y:4px] ' +
	'data-[side=left]:origin-right data-[side=left]:[--popup-enter-y:0px] ' +
	'[[data-side=left]_&]:origin-right [[data-side=left]_&]:[--popup-enter-y:0px] ' +
	'data-[side=right]:origin-left data-[side=right]:[--popup-enter-y:0px] ' +
	'[[data-side=right]_&]:origin-left [[data-side=right]_&]:[--popup-enter-y:0px]'
export const popupScrollAreaClass = 'min-h-0 flex-1 max-h-[inherit]'
export const popupCompactFadeClass = '[--scroll-fade-size:var(--scroll-fade-size-compact)]'
const POPUP_COMPACT_BELOW = 200
export function useCompactFade(ref: RefObject<HTMLElement | null>, open: boolean): boolean {
	const [compact, setCompact] = useState(false)
	useEffect(() => {
		if (!open) return
		let frame = 0
		let attempts = 0
		let observer: ResizeObserver | null = null
		const attach = () => {
			const node = ref.current
			if (!node) {
				attempts += 1
				if (attempts < 30) frame = requestAnimationFrame(attach)
				return
			}
			const update = () => setCompact(node.offsetHeight < POPUP_COMPACT_BELOW)
			update()
			observer = new ResizeObserver(update)
			observer.observe(node)
		}
		frame = requestAnimationFrame(attach)
		return () => {
			cancelAnimationFrame(frame)
			observer?.disconnect()
		}
	}, [ref, open])
	return compact
}
export const popupViewportClass = '!h-auto max-h-[inherit] [&>div[style]]:!block [&>div[style]]:!min-w-0'
export const POPUP_NAV_KEYS = [
	'ArrowDown',
	'ArrowUp',
	'ArrowLeft',
	'ArrowRight',
	'Home',
	'End',
	'PageUp',
	'PageDown',
	'Tab',
]
export function isDisabledRow(el: HTMLElement): boolean {
	return el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled')
}
