'use client'

import { teacherCrmSettingsApi } from '@/lib/crm/api'

import type { PetSettings } from '@teacher-crm/api-types'

import { setPetSettingsSnapshot } from './pet-settings-store'

export {
	DEFAULT_PET_SETTINGS,
	getPetSettingsSnapshot,
	setPetSettingsSnapshot,
	subscribePetSettings,
	usePetSettingsSnapshot,
} from './pet-settings-store'

export async function loadPersistedPetSettings(): Promise<PetSettings> {
	const response = await teacherCrmSettingsApi.getPetSettings()
	setPetSettingsSnapshot(response.settings)
	return response.settings
}
