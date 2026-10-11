import { eq, sql } from 'drizzle-orm'

import { type TeacherSettings, type UpdateSettingsRequest, timeZoneIdentity } from '@dv-lab/contracts'
import { PAYS_SOON_LESSONS_DEFAULT, SCHEDULE_TIME_ZONE } from '@dv-lab/core'
import { type Database, type DbExecutor, accounts, teacherSettings } from '@dv-lab/db'

export type TeacherTimeContext = { now: Date; defaultTimeZone: string }

type TimeContextFailure = { ok: false; error: 'default_time_zone_changed' }

type TimeContextResult = { ok: true; context: TeacherTimeContext; settings: TeacherSettings } | TimeContextFailure

type SaveSettingsResult = { ok: true; settings: TeacherSettings } | TimeContextFailure

export async function readTeacherSettings(executor: DbExecutor, accountId: string): Promise<TeacherSettings> {
	const [row] = await executor
		.select({ paysSoonLessons: teacherSettings.paysSoonLessons, defaultTimeZone: teacherSettings.defaultTimeZone })
		.from(teacherSettings)
		.where(eq(teacherSettings.accountId, accountId))
	return row ?? { paysSoonLessons: PAYS_SOON_LESSONS_DEFAULT, defaultTimeZone: SCHEDULE_TIME_ZONE }
}

export async function lockTeacherTimeContext(
	tx: DbExecutor,
	accountId: string,
	expectedDefaultTimeZone?: string,
	now = new Date()
): Promise<TimeContextResult> {
	const [account] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).for('update')
	if (!account) throw new Error('Teacher account missing while locking settings')
	const settings = await readTeacherSettings(tx, accountId)
	if (
		expectedDefaultTimeZone !== undefined &&
		timeZoneIdentity(expectedDefaultTimeZone) !== timeZoneIdentity(settings.defaultTimeZone)
	)
		return { ok: false, error: 'default_time_zone_changed' }
	return { ok: true, context: { now, defaultTimeZone: settings.defaultTimeZone }, settings }
}

export function saveTeacherSettings(
	db: Database,
	accountId: string,
	input: UpdateSettingsRequest
): Promise<SaveSettingsResult> {
	return db.transaction(async (tx): Promise<SaveSettingsResult> => {
		const locked = await lockTeacherTimeContext(tx, accountId, input.expectedDefaultTimeZone)
		if (!locked.ok) return locked
		const [row] = await tx
			.insert(teacherSettings)
			.values({
				accountId,
				paysSoonLessons: input.paysSoonLessons ?? PAYS_SOON_LESSONS_DEFAULT,
				defaultTimeZone: input.defaultTimeZone ?? SCHEDULE_TIME_ZONE,
			})
			.onConflictDoUpdate({
				target: teacherSettings.accountId,
				set: {
					...(input.paysSoonLessons === undefined ? {} : { paysSoonLessons: input.paysSoonLessons }),
					...(input.defaultTimeZone === undefined ? {} : { defaultTimeZone: input.defaultTimeZone }),
					updatedAt: sql`now()`,
				},
			})
			.returning({
				paysSoonLessons: teacherSettings.paysSoonLessons,
				defaultTimeZone: teacherSettings.defaultTimeZone,
			})
		if (!row) throw new Error('Teacher settings upsert returned no row')
		return { ok: true, settings: row }
	})
}
