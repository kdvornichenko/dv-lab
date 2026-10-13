'use client'

import { useEffect, useRef } from 'react'

import { isShown, prefersReducedMotion, scrollToMiddle, startMark, type MarkPart } from '@/lib/arrival-mark'

import type { ProfileMark } from './profile-arrival'

const SETTLE_MS = 200
const PULSE_AFTER_SCROLL_MS = 80
const MARK_RADIUS = '8px'

function markPart(mark: ProfileMark): MarkPart | null {
	if (mark.entry !== null) {
		const entry = document.querySelector<HTMLElement>(`[data-note-id="${mark.entry}"]`)
		if (entry !== null && isShown(entry)) return { el: entry, kind: 'ring', fill: true, raise: false }
	}
	if (mark.section !== null) {
		const heading = document.getElementById(`section-${mark.section}`)
		if (heading !== null && isShown(heading)) return { el: heading, kind: 'ring', fill: false, raise: false }
	}
	return null
}

export function useNotesArrival(mark: ProfileMark | null, ready: boolean, onDone: () => void) {
	const applied = useRef(false)
	const end = useRef<(() => void) | null>(null)
	const done = useRef(onDone)
	useEffect(() => {
		done.current = onDone
	})

	useEffect(() => {
		if (mark === null || !ready || applied.current) return
		const timer = window.setTimeout(() => {
			applied.current = true
			done.current()
			const part = markPart(mark)
			if (part === null) return
			const reduce = prefersReducedMotion()
			const radius = part.el.style.borderRadius
			part.el.style.borderRadius = MARK_RADIUS
			void scrollToMiddle(part.el, reduce).then(async () => {
				if (!reduce) await new Promise((resolve) => window.setTimeout(resolve, PULSE_AFTER_SCROLL_MS))
				if (!part.el.isConnected) return
				end.current = startMark([part], reduce, () => {
					part.el.style.borderRadius = radius
					end.current = null
				})
			})
		}, SETTLE_MS)
		return () => window.clearTimeout(timer)
	}, [mark, ready])

	useEffect(
		() => () => {
			end.current?.()
		},
		[]
	)
}
