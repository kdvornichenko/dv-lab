'use client'

import { useSyncExternalStore } from 'react'

import { DEFAULT_PET_SETTINGS as API_DEFAULT_PET_SETTINGS, type PetSettings } from '@teacher-crm/api-types'

export const DEFAULT_PET_SETTINGS: PetSettings = { ...API_DEFAULT_PET_SETTINGS }

let snapshot: PetSettings = { ...DEFAULT_PET_SETTINGS }
const listeners = new Set<() => void>()

export function getPetSettingsSnapshot() {
	return snapshot
}

export function setPetSettingsSnapshot(settings: PetSettings) {
	snapshot = { ...settings }
	for (const listener of listeners) listener()
}

export function subscribePetSettings(listener: () => void) {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

export function usePetSettingsSnapshot() {
	return useSyncExternalStore(subscribePetSettings, getPetSettingsSnapshot, getPetSettingsSnapshot)
}
