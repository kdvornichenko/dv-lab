import type { CrmErrorLogEntry, SaveCrmErrorInput } from '@teacher-crm/api-types'
import {
	clearCrmErrorLogRows,
	deleteCrmErrorLogRow,
	insertCrmErrorLogRow,
	listCrmErrorLogRows,
	pruneCrmErrorLogRows,
	type CrmErrorLogRow,
} from '@teacher-crm/db'

import { getDb, teacherProfileId } from './db-context'
import { getMemoryStore } from './storage-context'
import type { StoreScope } from './store-scope'

const MAX_ERRORS = 100

function dateToIso(value: Date | string) {
	return value instanceof Date ? value.toISOString() : value
}

function mapErrorLogRow(row: CrmErrorLogRow): CrmErrorLogEntry {
	return {
		id: row.id,
		source: row.source,
		message: row.message,
		createdAt: dateToIso(row.createdAt),
	}
}

export const errorLogService = {
	async listErrors(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().listCrmErrors(scope)

		const teacherId = await teacherProfileId(db, scope)
		return (await listCrmErrorLogRows(db, teacherId)).map(mapErrorLogRow)
	},

	async saveError(scope: StoreScope, input: SaveCrmErrorInput) {
		const db = getDb()
		if (!db) return getMemoryStore().saveCrmError(scope, input)

		const teacherId = await teacherProfileId(db, scope)
		const entry = mapErrorLogRow(
			await insertCrmErrorLogRow(db, {
				teacherId,
				source: input.source.trim(),
				message: input.message.trim(),
			})
		)
		await pruneCrmErrorLogRows(db, teacherId, MAX_ERRORS)
		return entry
	},

	async deleteError(scope: StoreScope, errorId: string) {
		const db = getDb()
		if (!db) return getMemoryStore().deleteCrmError(scope, errorId)

		const teacherId = await teacherProfileId(db, scope)
		const entry = await deleteCrmErrorLogRow(db, teacherId, errorId)
		return entry ? mapErrorLogRow(entry) : null
	},

	async clearErrors(scope: StoreScope) {
		const db = getDb()
		if (!db) return getMemoryStore().clearCrmErrors(scope)

		const teacherId = await teacherProfileId(db, scope)
		await clearCrmErrorLogRows(db, teacherId)
	},
}
