import {
	DEFAULT_SIDEBAR_ITEMS,
	sidebarItemSchema,
	type SidebarItem,
	type UpdateSidebarSettingsInput,
} from '@teacher-crm/api-types'
import { getSidebarSettingsRow, upsertSidebarSettingsRow, type SidebarSettingsItem } from '@teacher-crm/db'

import { getDb, teacherProfileId } from './db-context'
import { memoryStore } from './memory-store'
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
	return items.map((item) => ({ ...item }))
}

export const settingsService = {
	async listSidebarItems(scope: StoreScope) {
		const db = getDb()
		if (!db) return memoryStore.listSidebarItems(scope)

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
		if (!db) return memoryStore.saveSidebarItems(scope, items)

		const teacherId = await teacherProfileId(db, scope)
		return normalizeSidebarItems((await upsertSidebarSettingsRow(db, teacherId, toRepositoryItems(items))).items)
	},
}
