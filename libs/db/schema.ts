import { pgTable, uuid, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core'

export const wishlistItems = pgTable('wishlist_items', {
	id: uuid('id').defaultRandom().primaryKey(),
	description: text('description').notNull(),
	price: integer('price').notNull().default(0),
	href: text('href').notNull().default(''),
	booked: boolean('booked').notNull().default(false),
	hidden: boolean('hidden').notNull().default(false),
	image_url: text('image_url'),
	created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})
