import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const appInfo = pgTable('app_info', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
