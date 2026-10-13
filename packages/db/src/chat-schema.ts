import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { accounts } from './schema.ts'

export const chatConversations = pgTable(
	'chat_conversations',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		accountId: uuid('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		title: text('title').notNull(),
		revision: integer('revision').notNull().default(1),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
		deletedAt: timestamp('deleted_at', { withTimezone: true }),
	},
	(table) => [
		index('chat_conversations_account_updated_idx')
			.on(table.accountId, table.updatedAt.desc(), table.id)
			.where(sql`${table.deletedAt} is null`),
		check('chat_conversations_title_ck', sql`char_length(${table.title}) between 1 and 160`),
		check('chat_conversations_revision_ck', sql`${table.revision} >= 1`),
	]
)
