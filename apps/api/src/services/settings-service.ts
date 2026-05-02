import {
	DEFAULT_CRM_THEME_SETTINGS,
	DEFAULT_PET_SETTINGS,
	DEFAULT_SIDEBAR_ITEMS,
	crmThemeSettingsSchema,
	petSettingsSchema,
	sidebarItemSchema,
	type CrmThemeSettings,
	type PetSettings,
	type SidebarItem,
	type UpdateSidebarSettingsInput,
} from '@teacher-crm/api-types'
import {
	getPetSettingsRow,
	getSidebarSettingsRow,
	getThemeSettingsRow,
	upsertPetSettingsRow,
	upsertSidebarSettingsRow,
	upsertThemeSettingsRow,
	type PetSettingsValue,
	type SidebarSettingsItem,
	type ThemeSettingsValue,
} from '@teacher-crm/db'

import { getDb, teacherProfileId } from './db-context'
import { getMemoryStore } from './storage-context'
import type { StoreScope } from './store-scope'

const defaultSidebarItems: SidebarItem[] = DEFAULT_SIDEBAR_ITEMS.map((item) => ({ ...item }))

function normalizeSidebarItems(items: readonly unknown[]): SidebarItem[] {
	const defaultById = new Map(defaultSidebarItems.map((item) => [item.id, item]))
	const seen = new Set<string>()
	const normalized: SidebarItem[] = []

	for (const item of items) {
		const parsed = sidebarItemSchema.safeParse(item)
		if (!parsed.success || seen.has(parsed.data.id)) continue

		const defaultItem = defaultById.get(parsed.data.id)
		if (defaultItem?.locked) {
			normalized.push({ ...defaultItem })
		} else {
			normalized.push({
				...parsed.data,
				locked: defaultItem?.locked,
			})
		}
		seen.add(parsed.data.id)
	}

	for (const item of defaultSidebarItems) {
		if (!seen.has(item.id)) normalized.push({ ...item })
	}

	return normalized
}

function toRepositoryItems(items: readonly SidebarItem[]): SidebarSettingsItem[] {
	return items.map((item) => ({
		id: item.id,
		title: item.title,
		href: item.href,
		icon: item.icon,
		visible: item.visible,
		locked: item.locked,
	}))
}

function normalizeThemeSettings(value: unknown): CrmThemeSettings {
	const candidate = value && typeof value === 'object' ? (value as Partial<CrmThemeSettings>) : {}
	const merged = {
		...DEFAULT_CRM_THEME_SETTINGS,
		...candidate,
		colors: {
			...DEFAULT_CRM_THEME_SETTINGS.colors,
			...(candidate.colors ?? {}),
		},
		fontSizes: {
			...DEFAULT_CRM_THEME_SETTINGS.fontSizes,
			...(candidate.fontSizes ?? {}),
		},
	}
	const parsed = crmThemeSettingsSchema.safeParse(merged)
	return parsed.success ? parsed.data : DEFAULT_CRM_THEME_SETTINGS
}

function toRepositoryTheme(theme: CrmThemeSettings): ThemeSettingsValue {
	return {
		radius: theme.radius,
		headingFont: theme.headingFont,
		bodyFont: theme.bodyFont,
		numberFont: theme.numberFont,
		fontSizes: { ...theme.fontSizes },
		colors: { ...theme.colors },
	}
}

function normalizePetSettings(value: unknown): PetSettings {
	const candidate = value && typeof value === 'object' ? (value as Partial<PetSettings>) : {}
	const parsed = petSettingsSchema.safeParse({
		...DEFAULT_PET_SETTINGS,
		...candidate,
	})
	return parsed.success ? parsed.data : DEFAULT_PET_SETTINGS
}

function toRepositoryPetSettings(settings: PetSettings): PetSettingsValue {
	return {
		enabled: settings.enabled,
		soundEnabled: settings.soundEnabled,
		activityLevel: settings.activityLevel,
	}
}

export const settingsService = {
	async listSidebarItems(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().listSidebarItems(scope)

		const teacherId = await teacherProfileId(db, scope)
		const existing = await getSidebarSettingsRow(db, teacherId)

		if (!existing) {
			const items = normalizeSidebarItems(defaultSidebarItems)
			await upsertSidebarSettingsRow(db, teacherId, toRepositoryItems(items))
			return items
		}

		const items = normalizeSidebarItems(existing.items)
		return items
	},

	async saveSidebarItems(scope: StoreScope, input: UpdateSidebarSettingsInput) {
		const items = normalizeSidebarItems(input.items)
		const db = getDb()
		if (!db) return getMemoryStore().saveSidebarItems(scope, items)

		const teacherId = await teacherProfileId(db, scope)
		return normalizeSidebarItems((await upsertSidebarSettingsRow(db, teacherId, toRepositoryItems(items))).items)
	},

	async getTheme(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().getTheme(scope)

		const teacherId = await teacherProfileId(db, scope)
		const existing = await getThemeSettingsRow(db, teacherId)

		if (!existing) {
			await upsertThemeSettingsRow(db, teacherId, toRepositoryTheme(DEFAULT_CRM_THEME_SETTINGS))
			return DEFAULT_CRM_THEME_SETTINGS
		}

		return normalizeThemeSettings(existing.theme)
	},

	async saveTheme(scope: StoreScope, input: CrmThemeSettings) {
		const theme = normalizeThemeSettings(input)
		const db = getDb()
		if (!db) return getMemoryStore().saveTheme(scope, theme)

		const teacherId = await teacherProfileId(db, scope)
		return normalizeThemeSettings((await upsertThemeSettingsRow(db, teacherId, toRepositoryTheme(theme))).theme)
	},

	async getPetSettings(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().getPetSettings(scope)

		const teacherId = await teacherProfileId(db, scope)
		const existing = await getPetSettingsRow(db, teacherId)

		if (!existing) {
			await upsertPetSettingsRow(db, teacherId, toRepositoryPetSettings(DEFAULT_PET_SETTINGS))
			return DEFAULT_PET_SETTINGS
		}

		return normalizePetSettings(existing)
	},

	async savePetSettings(scope: StoreScope, input: PetSettings) {
		const settings = normalizePetSettings(input)
		const db = getDb()
		if (!db) return getMemoryStore().savePetSettings(scope, settings)

		const teacherId = await teacherProfileId(db, scope)
		return normalizePetSettings(await upsertPetSettingsRow(db, teacherId, toRepositoryPetSettings(settings)))
	},
}
