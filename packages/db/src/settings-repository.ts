import { eq, sql } from 'drizzle-orm'

import type { DB } from './factory'
import { sidebarSettings } from './schema'

export type SidebarSettingsRow = typeof sidebarSettings.$inferSelect
export type SidebarSettingsItem = SidebarSettingsRow['items'][number]

export async function getSidebarSettingsRow(db: DB, teacherId: string): Promise<SidebarSettingsRow | null> {
	const [settings] = await db
		.select()
		.from(sidebarSettings)
		.where(eq(sidebarSettings.teacherId, teacherId))
		.limit(1)

	return settings ?? null
}

export async function upsertSidebarSettingsRow(
	db: DB,
	teacherId: string,
	items: SidebarSettingsItem[]
): Promise<SidebarSettingsRow> {
	const [settings] = await db
		.insert(sidebarSettings)
		.values({
			teacherId,
			items,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: sidebarSettings.teacherId,
			set: {
				items: sql`excluded.items`,
				updatedAt: new Date(),
			},
		})
		.returning()

	return settings
}
