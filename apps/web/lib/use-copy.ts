'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'failed'

const RESULT_MS = 1500

export function useCopy() {
	const [state, setState] = useState<CopyState>('idle')
	const timer = useRef<number | null>(null)

	useEffect(
		() => () => {
			if (timer.current !== null) window.clearTimeout(timer.current)
		},
		[]
	)

	const copy = useCallback(async (text: string) => {
		let next: CopyState = 'copied'
		try {
			await navigator.clipboard.writeText(text)
		} catch {
			next = 'failed'
		}
		if (timer.current !== null) window.clearTimeout(timer.current)
		setState(next)
		timer.current = window.setTimeout(() => {
			timer.current = null
			setState('idle')
		}, RESULT_MS)
	}, [])

	const reset = useCallback(() => {
		if (timer.current !== null) window.clearTimeout(timer.current)
		timer.current = null
		setState('idle')
	}, [])

	return { state, copy, reset }
}

export function copyTooltip(state: CopyState, rest: string): string {
	if (state === 'copied') return 'Copied'
	if (state === 'failed') return 'Could not copy'
	return rest
}
