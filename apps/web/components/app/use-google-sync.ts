'use client'

import { useSyncExternalStore } from 'react'

import { apiRequest } from '@/lib/api-client'

import { googleSyncSnapshot, type GoogleSyncSnapshot } from '@dv-lab/contracts'

const POLL_MS = 20_000

const listeners = new Set<() => void>()
let snapshot: GoogleSyncSnapshot | null = null
let timer: ReturnType<typeof setInterval> | null = null
let pending = false

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
