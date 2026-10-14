'use client'

import { useEffect } from 'react'

const SCROLLERS = '.scroll-fade, .scroll-fade-x'
const DIVIDERS = '.scroll-divider'
const DEFAULT_SIZE = 48

function clamp(value: number): number {
	return Math.min(1, Math.max(0, value))
}

function fadeSize(element: HTMLElement): number {
	const size = parseFloat(getComputedStyle(element).getPropertyValue('--scroll-fade-size'))
	return Number.isFinite(size) && size > 0 ? size : DEFAULT_SIZE
}

function reading(element: HTMLElement): { start: number; end: number } {
	const horizontal = element.classList.contains('scroll-fade-x')
	const offset = horizontal ? element.scrollLeft : element.scrollTop
	const max = horizontal ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight
	if (max <= 0) return { start: 1, end: 1 }
	const size = fadeSize(element)
	return {
		start: 1 - clamp(offset / size),
		end: clamp((offset - (max - size)) / size),
	}
}

function write(element: HTMLElement, start: number, end: number) {
	const nextStart = String(start)
	const nextEnd = String(end)
	if (element.style.getPropertyValue('--sf-start') !== nextStart) element.style.setProperty('--sf-start', nextStart)
	if (element.style.getPropertyValue('--sf-end') !== nextEnd) element.style.setProperty('--sf-end', nextEnd)
}

function apply(scroller: HTMLElement) {
	const { start, end } = reading(scroller)
	write(scroller, start, end)
	const divider = scroller.closest<HTMLElement>(DIVIDERS)
	if (divider && divider.querySelector('.scroll-fade') === scroller) write(divider, start, end)
}

export function ScrollFadeFallback() {
	useEffect(() => {
		if (CSS.supports('animation-timeline: scroll()')) return

		const observed = new Set<HTMLElement>()
		const dirty = new Set<HTMLElement>()
		let frame = 0
		let rescan = false

		const resize = new ResizeObserver((entries) => {
			for (const entry of entries) dirty.add(entry.target as HTMLElement)
			schedule()
		})

		function flush() {
			frame = 0
			if (rescan) {
				rescan = false
				const found = new Set(document.querySelectorAll<HTMLElement>(SCROLLERS))
				for (const element of observed) {
					if (found.has(element)) continue
					resize.unobserve(element)
					observed.delete(element)
				}
				for (const element of found) {
					if (observed.has(element)) continue
					observed.add(element)
					resize.observe(element)
				}
				for (const element of observed) dirty.add(element)
			}
			for (const element of dirty) if (element.isConnected) apply(element)
			dirty.clear()
		}

		function schedule() {
			if (frame === 0) frame = requestAnimationFrame(flush)
		}

		function onScroll(event: Event) {
			const target = event.target
			if (!(target instanceof HTMLElement) || !target.matches(SCROLLERS)) return
			dirty.add(target)
			schedule()
		}

		const mutations = new MutationObserver(() => {
			rescan = true
			schedule()
		})

		document.addEventListener('scroll', onScroll, { capture: true, passive: true })
		mutations.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['class'],
		})
		rescan = true
		schedule()

		return () => {
			document.removeEventListener('scroll', onScroll, { capture: true })
			mutations.disconnect()
			resize.disconnect()
			if (frame !== 0) cancelAnimationFrame(frame)
		}
	}, [])

	return null
}
