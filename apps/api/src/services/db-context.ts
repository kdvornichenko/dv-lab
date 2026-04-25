import { createDb, findOrCreateTeacherProfile, type DB } from '@teacher-crm/db'

import { databaseUrl } from '../config/env'
import type { StoreScope } from './store-scope'

let dbHandle: ReturnType<typeof createDb> | undefined

export function getDb(): DB | null {
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
