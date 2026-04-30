import { AsyncLocalStorage } from 'node:async_hooks'

import { createDb, findOrCreateTeacherProfile, type DB } from '@teacher-crm/db'

import { databaseUrl } from '../config/env'
import type { StoreScope } from './store-scope'

let dbHandle: ReturnType<typeof createDb> | undefined
const scopedDbContext = new AsyncLocalStorage<{ db?: DB | null; databaseUrl?: string | null }>()
const scopedDbHandles = new Map<string, ReturnType<typeof createDb>>()

export type DbContextOptions = {
	db?: DB | null
	databaseUrl?: string | null
}

export async function runWithDbContext<T>(options: DbContextOptions, run: () => Promise<T>) {
	return scopedDbContext.run(options, run)
}

function dbForUrl(url: string) {
	const existing = scopedDbHandles.get(url)
	if (existing) return existing.db

	const created = createDb(url)
	scopedDbHandles.set(url, created)
	return created.db
}

export function getDb(): DB | null {
	const scoped = scopedDbContext.getStore()
	if (scoped && 'db' in scoped) return scoped.db ?? null
	if (scoped && 'databaseUrl' in scoped) return scoped.databaseUrl ? dbForUrl(scoped.databaseUrl) : null
	if (!databaseUrl) return null
	if (dbHandle === undefined) dbHandle = createDb(databaseUrl)
	return dbHandle.db
}

export async function teacherProfileId(db: DB, scope: StoreScope) {
	return findOrCreateTeacherProfile(db, {
		authUserId: scope.teacherId,
		email: scope.email,
	})
}
