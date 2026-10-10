import { eq, sql } from 'drizzle-orm'

import { PAYS_SOON_LESSONS_DEFAULT } from '@dv-lab/core'
import { type DbExecutor, teacherSettings } from '@dv-lab/db'

export async function readPaysSoonLessons(executor: DbExecutor, accountId: string): Promise<number> {
	const [row] = await executor
		.select({ paysSoonLessons: teacherSettings.paysSoonLessons })
		.from(teacherSettings)
		.where(eq(teacherSettings.accountId, accountId))
	return row?.paysSoonLessons ?? PAYS_SOON_LESSONS_DEFAULT
}

export async function savePaysSoonLessons(
	executor: DbExecutor,
	accountId: string,
	paysSoonLessons: number
): Promise<number> {
	const [row] = await executor
		.insert(teacherSettings)
		.values({ accountId, paysSoonLessons })
		.onConflictDoUpdate({
			target: teacherSettings.accountId,
			set: { paysSoonLessons, updatedAt: sql`now()` },
		})
		.returning({ paysSoonLessons: teacherSettings.paysSoonLessons })
	if (!row) throw new Error('teacher settings upsert returned no row')
	return row.paysSoonLessons
}
