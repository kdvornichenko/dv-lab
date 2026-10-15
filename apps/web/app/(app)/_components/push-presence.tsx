'use client'

import { useEffect } from 'react'

import { usePathname, useSearchParams } from 'next/navigation'

import { PUSH_CHANGED, resync, sendPresence } from '@/lib/push-client'

import type { PushScreen } from '@dv-lab/contracts'

const PRESENCE_INTERVAL_MS = 45_000
const STUDENT_PATH = /^\/students\/([0-9a-f-]{36})\/?$/i

type Presence = { screen: PushScreen; studentId?: string }

function presenceOf(pathname: string, tab: string | null): Presence {
	if (pathname === '/schedule' || pathname.startsWith('/schedule/')) return { screen: 'schedule' }
	const student = STUDENT_PATH.exec(pathname)
	if (student?.[1] && tab === 'payments') return { screen: 'payments', studentId: student[1] }
	return { screen: 'other' }
}

export function PushPresence() {
	const pathname = usePathname()
	const tab = useSearchParams().get('tab')
	const { screen, studentId } = presenceOf(pathname, tab)

	useEffect(() => {
		void resync()
	}, [])

	useEffect(() => {
		const visible = () => document.visibilityState === 'visible'
		const report = () => {
			if (visible()) void sendPresence(screen, studentId)
		}
		const onVisibility = () => {
			if (visible()) void sendPresence(screen, studentId)
			else void sendPresence('other')
		}
		report()
		const timer = setInterval(report, PRESENCE_INTERVAL_MS)
		document.addEventListener('visibilitychange', onVisibility)
		window.addEventListener(PUSH_CHANGED, report)
		return () => {
			clearInterval(timer)
			document.removeEventListener('visibilitychange', onVisibility)
			window.removeEventListener(PUSH_CHANGED, report)
		}
	}, [screen, studentId])

	return null
}
