'use server'

import { eq } from 'drizzle-orm'

import { db } from '@/libs/db'
import { wishlistItems } from '@/libs/db/schema'

export async function getWishlistItems() {
	return db.select().from(wishlistItems).orderBy(wishlistItems.created_at)
}

export async function bookWishlistItem(itemId: string) {
	await db.update(wishlistItems).set({ booked: true }).where(eq(wishlistItems.id, itemId))
}

export async function updateWishlistItem(
	itemId: string,
	data: { description: string; price: number; href: string; image_url: string | null }
) {
	await db.update(wishlistItems).set(data).where(eq(wishlistItems.id, itemId))
}

export async function addWishlistItem(data: { description: string; price: number; href: string }) {
	const [item] = await db.insert(wishlistItems).values(data).returning()
	return item
}

export async function updateWishlistItemImageUrl(itemId: string, imageUrl: string) {
	await db.update(wishlistItems).set({ image_url: imageUrl }).where(eq(wishlistItems.id, itemId))
}

export async function deleteWishlistItem(itemId: string) {
	await db.delete(wishlistItems).where(eq(wishlistItems.id, itemId))
}

export async function toggleWishlistItemHidden(itemId: string, hidden: boolean) {
	await db.update(wishlistItems).set({ hidden }).where(eq(wishlistItems.id, itemId))
}
