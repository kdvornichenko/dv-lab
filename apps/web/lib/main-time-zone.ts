'use client'

import { useSyncExternalStore } from 'react'

import { apiRequest, DEVICE_CACHE_PREFIX, peekApi } from '@/lib/api-client'

import { timeZoneIdentity, type SettingsResponse } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

const ZONE_KEY = `${DEVICE_CACHE_PREFIX}schedule-zone`

let loaded: string | null = null
const listeners = new Set<() => void>()

export function knownMainTimeZone(): string {
	try {
		return timeZoneIdentity(localStorage.getItem(ZONE_KEY) ?? SCHEDULE_TIME_ZONE) ?? SCHEDULE_TIME_ZONE
	} catch {
		return SCHEDULE_TIME_ZONE
	}
}

export function rememberMainTimeZone(zone: string) {
	try {
		localStorage.setItem(ZONE_KEY, zone)
	} catch {}
}

function cachedSettingsZone(): string | null {
	const cached = peekApi<SettingsResponse>('/settings')
	return cached !== null && cached.ok ? timeZoneIdentity(cached.data.settings.defaultTimeZone) : null
}

function refresh() {
	void apiRequest<SettingsResponse>('GET', '/settings').then((result) => {
		if (!result.ok) return
		const identity = timeZoneIdentity(result.data.settings.defaultTimeZone)
		if (identity === null || identity === loaded) return
		loaded = identity
		rememberMainTimeZone(identity)
		for (const listener of listeners) listener()
	})
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	if (listeners.size === 1) refresh()
	return () => {
		listeners.delete(listener)
	}
}

function snapshot(): string {
	return loaded ?? cachedSettingsZone() ?? knownMainTimeZone()
}

function serverSnapshot(): string {
	return SCHEDULE_TIME_ZONE
}

export function useMainTimeZone(): string {
	return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
