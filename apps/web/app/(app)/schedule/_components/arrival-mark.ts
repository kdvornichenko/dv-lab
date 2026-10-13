const PULSE_MS = 560
const PULSE_GAP_MS = 80
const PULSE_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)'
const FADE_MS = 240
const REST_MS = 4000
const SCROLL_MS = 240
const SCROLL_GRACE_MS = 150

export type MarkPart = { el: HTMLElement; kind: 'ring' | 'wash'; fill: boolean; raise: boolean }

function focusRing(): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue('--focus-ring').trim()
	return value === '' ? '#6b97ff' : value
}

function foreground(): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim()
	return value === '' ? '#000000' : value
}

function mix(color: string, percent: number): string {
	return `color-mix(in oklab, ${color} ${percent}%, transparent)`
}

export function prefersReducedMotion(): boolean {
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isShown(el: Element): boolean {
	return el.getClientRects().length > 0
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export function scrollToMiddle(target: HTMLElement, reduce: boolean): Promise<void> {
	const grid = target.closest<HTMLElement>('[data-slot="week-grid-body"]')
	const rect = target.getBoundingClientRect()
	if (grid === null) {
		const inView = rect.top >= 0 && rect.bottom <= window.innerHeight
		if (inView) return Promise.resolve()
		target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
		return reduce ? Promise.resolve() : sleep(320)
	}
	const frame = grid.getBoundingClientRect()
	if (rect.top >= frame.top && rect.bottom <= frame.bottom) return Promise.resolve()
	const wanted = grid.scrollTop + (rect.top + rect.height / 2) - (frame.top + frame.height / 2)
	const goal = Math.max(0, Math.min(wanted, grid.scrollHeight - grid.clientHeight))
	if (reduce) {
		grid.scrollTop = goal
		return Promise.resolve()
	}
	const from = grid.scrollTop
	return new Promise((resolve) => {
		const began = performance.now()
		const step = (now: number) => {
			const progress = Math.min(1, (now - began) / SCROLL_MS)
			grid.scrollTop = from + (goal - from) * (1 - (1 - progress) ** 3)
			if (progress < 1) requestAnimationFrame(step)
			else resolve()
		}
		requestAnimationFrame(step)
	})
}

export function startMark(parts: MarkPart[], reduce: boolean, onEnd: () => void): () => void {
	const ring = focusRing()
	const ink = foreground()
	const saved = parts.map((part) => ({ shadow: part.el.style.boxShadow, layer: part.el.style.zIndex }))
	const restShadow = (part: MarkPart, visible: boolean) =>
		part.kind === 'wash'
			? `inset 0 0 0 9999px ${mix(ink, visible ? 5 : 0)}`
			: `0 0 0 2px ${mix(ring, visible ? 85 : 0)}`
	const frames = (part: MarkPart): Keyframe[] => {
		const fill = (percent: number) => (part.fill ? `, inset 0 0 0 9999px ${mix(ring, percent)}` : '')
		return [
			{ boxShadow: `0 0 0 1px ${ring}, 0 0 0 0px ${mix(ring, 45)}${fill(22)}` },
			{ boxShadow: `0 0 0 1px ${mix(ring, 0)}, 0 0 0 4px ${mix(ring, 0)}${fill(0)}` },
		]
	}
	let ended = false
	let timer: number | null = null
	const controller = new AbortController()

	for (const part of parts) {
		if (part.raise) part.el.style.zIndex = '21'
		if (part.kind === 'wash') part.el.style.boxShadow = restShadow(part, true)
	}

	function restore() {
		parts.forEach((part, index) => {
			part.el.style.boxShadow = saved[index]?.shadow ?? ''
			part.el.style.zIndex = saved[index]?.layer ?? ''
		})
		onEnd()
	}

	function end() {
		if (ended) return
		ended = true
		controller.abort()
		if (timer !== null) window.clearTimeout(timer)
		if (reduce) {
			restore()
			return
		}
		const fades = parts.map((part) =>
			part.el
				.animate([{ boxShadow: restShadow(part, true) }, { boxShadow: restShadow(part, false) }], {
					duration: FADE_MS,
					easing: 'ease-out',
				})
				.finished.catch(() => undefined)
		)
		void Promise.all(fades).then(restore)
	}

	function rest() {
		if (ended) return
		for (const part of parts) part.el.style.boxShadow = restShadow(part, true)
	}

	async function pulses() {
		for (let index = 0; index < 2; index++) {
			if (ended) return
			const running = parts
				.filter((part) => part.kind === 'ring')
				.map((part) =>
					part.el.animate(frames(part), { duration: PULSE_MS, easing: PULSE_EASING }).finished.catch(() => undefined)
				)
			await Promise.all(running)
			if (index === 0) await sleep(PULSE_GAP_MS)
		}
		rest()
	}

	const options = { capture: true, signal: controller.signal }
	window.addEventListener('pointerdown', end, options)
	window.addEventListener('keydown', end, options)
	window.setTimeout(() => {
		if (!ended) document.addEventListener('scroll', end, options)
	}, SCROLL_GRACE_MS)
	timer = window.setTimeout(end, REST_MS)
	if (reduce) rest()
	else void pulses()
	return end
}
