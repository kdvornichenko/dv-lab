'use client'

import { useMemo, useSyncExternalStore } from 'react'

function subscribeMinute(callback: () => void) {
	let timer: ReturnType<typeof setTimeout>
	const schedule = () => {
		timer = setTimeout(
			() => {
				callback()
				schedule()
			},
			60000 - (Date.now() % 60000) + 50
		)
	}
	schedule()
	window.addEventListener('focus', callback)
	document.addEventListener('visibilitychange', callback)
	return () => {
		clearTimeout(timer)
		window.removeEventListener('focus', callback)
		document.removeEventListener('visibilitychange', callback)
	}
}

const minuteNow = () => Math.floor(Date.now() / 60000)
const serverNow = () => null

export function useMinuteNow(): Date | null {
	const minute = useSyncExternalStore(subscribeMinute, minuteNow, serverNow)
	return useMemo(() => (minute === null ? null : new Date(minute * 60000)), [minute])
}
