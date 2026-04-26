import { and, desc, eq, sql } from 'drizzle-orm'

import type { DB } from './factory'
import { crmErrorLogs } from './schema'

export type CrmErrorLogRow = typeof crmErrorLogs.$inferSelect
export type CrmErrorLogInsertValues = Omit<typeof crmErrorLogs.$inferInsert, 'id' | 'createdAt'>

export async function listCrmErrorLogRows(db: DB, teacherId: string): Promise<CrmErrorLogRow[]> {
	return db
		.select()
		.from(crmErrorLogs)
		.where(eq(crmErrorLogs.teacherId, teacherId))
		.orderBy(desc(crmErrorLogs.createdAt))
}

export async function insertCrmErrorLogRow(db: DB, values: CrmErrorLogInsertValues): Promise<CrmErrorLogRow> {
	const [entry] = await db.insert(crmErrorLogs).values(values).returning()
	return entry
}

export async function deleteCrmErrorLogRow(
	db: DB,
	teacherId: string,
	errorId: string
): Promise<CrmErrorLogRow | null> {
	const [entry] = await db
		.delete(crmErrorLogs)
		.where(and(eq(crmErrorLogs.teacherId, teacherId), eq(crmErrorLogs.id, errorId)))
		.returning()

	return entry ?? null
}

export async function clearCrmErrorLogRows(db: DB, teacherId: string): Promise<void> {
	await db.delete(crmErrorLogs).where(eq(crmErrorLogs.teacherId, teacherId))
}

export async function pruneCrmErrorLogRows(db: DB, teacherId: string, keep: number): Promise<void> {
	await db.execute(sql`
		delete from ${crmErrorLogs}
		where ${crmErrorLogs.teacherId} = ${teacherId}
		and ${crmErrorLogs.id} not in (
			select ${crmErrorLogs.id}
			from ${crmErrorLogs}
			where ${crmErrorLogs.teacherId} = ${teacherId}
			order by ${crmErrorLogs.createdAt} desc
			limit ${keep}
		)
	`)
}
