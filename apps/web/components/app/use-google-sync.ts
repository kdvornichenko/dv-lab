'use client'

import { useSyncExternalStore } from 'react'

import { apiRequest } from '@/lib/api-client'

import { googleSyncSnapshot, type GoogleSyncSnapshot } from '@dv-lab/contracts'

const POLL_MS = 20_000

const listeners = new Set<() => void>()
let snapshot: GoogleSyncSnapshot | null = null
let timer: ReturnType<typeof setInterval> | null = null
let pending = false

export type SyncHistory = { from: string; status: 'loading' | 'failed' }
let history: SyncHistory | null = null

function publishHistory(next: SyncHistory | null) {
	history = next
	for (const listener of listeners) listener()
}

function publish(next: GoogleSyncSnapshot) {
	snapshot = next
	for (const listener of listeners) listener()
}

async function poll() {
	if (pending || document.visibilityState !== 'visible') return
	pending = true
	try {
		const result = await apiRequest<unknown>('GET', '/google/sync')
		if (!result.ok || listeners.size === 0) return
		const parsed = googleSyncSnapshot.safeParse(result.data)
		if (parsed.success) publish(parsed.data)
	} finally {
		pending = false
	}
}

const FOLLOW_MS = 1500
const FOLLOW_LIMIT_MS = 60_000

export async function requestSyncHistory(from: string) {
	publishHistory({ from, status: 'loading' })
	const result = await apiRequest<unknown>('POST', '/google/sync/history', { from })
	if (!result.ok) {
		publishHistory({ from, status: 'failed' })
		return
	}
	const parsed = googleSyncSnapshot.safeParse(result.data)
	if (parsed.success && listeners.size > 0) publish(parsed.data)
	const until = Date.now() + FOLLOW_LIMIT_MS
	const follow = async () => {
		if (history?.from !== from) return
		await poll()
		const current = snapshot
		if (current === null) return
		if (current.windowStart !== null && current.windowStart <= from) {
			publishHistory(null)
			return
		}
		if (Date.now() > until || current.state === 'failed') {
			publishHistory({ from, status: 'failed' })
			return
		}
		setTimeout(() => void follow(), FOLLOW_MS)
	}
	setTimeout(() => void follow(), FOLLOW_MS)
}

export function useSyncHistory(): SyncHistory | null {
	return useSyncExternalStore(
		subscribe,
		() => history,
		() => null
	)
}

function becameVisible() {
	if (document.visibilityState === 'visible') void poll()
}

function start() {
	document.addEventListener('visibilitychange', becameVisible)
	timer = setInterval(() => void poll(), POLL_MS)
	void poll()
}

function stop() {
	document.removeEventListener('visibilitychange', becameVisible)
	if (timer !== null) clearInterval(timer)
	timer = null
	snapshot = null
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	if (listeners.size === 1) start()
	return () => {
		listeners.delete(listener)
		if (listeners.size === 0) stop()
	}
}

function getSnapshot() {
	return snapshot
}

function getServerSnapshot(): GoogleSyncSnapshot | null {
	return null
}

export function refreshGoogleSync(): Promise<void> {
	return poll()
}

export function useGoogleSync(): GoogleSyncSnapshot | null {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
