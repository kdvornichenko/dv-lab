'use client'

import type { PetSettings } from '@teacher-crm/api-types'

import { teacherCrmSettingsApi } from '@/lib/crm/api'

export {
	DEFAULT_PET_SETTINGS,
	getPetSettingsSnapshot,
	setPetSettingsSnapshot,
	subscribePetSettings,
	usePetSettingsSnapshot,
} from './pet-settings-store'
import { setPetSettingsSnapshot } from './pet-settings-store'

export async function loadPersistedPetSettings(): Promise<PetSettings> {
	const response = await teacherCrmSettingsApi.getPetSettings()
	setPetSettingsSnapshot(response.settings)
	return response.settings
}
