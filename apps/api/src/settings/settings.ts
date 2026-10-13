import { eq, sql } from 'drizzle-orm'

import {
	type AssistantSettings,
	CHAT_SETTINGS_DEFAULT,
	type ChatModelEntry,
	type SaveAssistantSettingsRequest,
	type TeacherSettings,
	type UpdateSettingsRequest,
	chatEffort,
	chatModels,
	timeZoneIdentity,
} from '@dv-lab/contracts'
import { PAYS_SOON_LESSONS_DEFAULT, SCHEDULE_TIME_ZONE } from '@dv-lab/core'
import { type Database, type DbExecutor, accounts, teacherSettings } from '@dv-lab/db'

export type TeacherTimeContext = { now: Date; defaultTimeZone: string }

type TimeContextFailure = { ok: false; error: 'default_time_zone_changed' }

type TimeContextResult = { ok: true; context: TeacherTimeContext; settings: TeacherSettings } | TimeContextFailure

type SaveAssistantResult = { ok: true; settings: AssistantSettings } | { ok: false; error: 'invalid' }

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

export async function readAssistantSettings(executor: DbExecutor, accountId: string): Promise<AssistantSettings> {
	const [row] = await executor
		.select({
			monthlyCapUsd: teacherSettings.chatMonthlyCapUsd,
			maxInputTokens: teacherSettings.chatMaxInputTokens,
			maxOutputTokens: teacherSettings.chatMaxOutputTokens,
			models: teacherSettings.chatModels,
			model: teacherSettings.chatModel,
			effort: teacherSettings.chatEffort,
		})
		.from(teacherSettings)
		.where(eq(teacherSettings.accountId, accountId))
	if (!row) return CHAT_SETTINGS_DEFAULT
	return {
		monthlyCapUsd: row.monthlyCapUsd,
		maxInputTokens: row.maxInputTokens,
		maxOutputTokens: row.maxOutputTokens,
		models: row.models === null ? CHAT_SETTINGS_DEFAULT.models : chatModels.parse(row.models),
		model: row.model,
		effort: chatEffort.nullable().parse(row.effort),
	}
}

type ModelsColumn = ChatModelEntry[] | null | undefined

function mergeAssistant(
	current: AssistantSettings,
	input: SaveAssistantSettingsRequest
): { settings: AssistantSettings; modelsColumn: ModelsColumn } | null {
	const modelsColumn: ModelsColumn = input.models
	const models = input.models === undefined ? current.models : (input.models ?? CHAT_SETTINGS_DEFAULT.models)
	let model = input.model === undefined ? current.model : input.model
	let effort = input.effort === undefined ? current.effort : input.effort
	if (model !== null && !models.some((entry) => entry.id === model)) {
		if (input.model !== undefined) return null
		model = null
		if (input.effort === undefined) effort = null
	}
	const active = models.find((entry) => entry.id === (model ?? models[0]?.id))
	if (!active) return null
	if (effort !== null && !active.efforts.includes(effort)) {
		if (input.effort !== undefined) return null
		effort = null
	}
	return {
		settings: {
			monthlyCapUsd: input.monthlyCapUsd ?? current.monthlyCapUsd,
			maxInputTokens: input.maxInputTokens ?? current.maxInputTokens,
			maxOutputTokens: input.maxOutputTokens ?? current.maxOutputTokens,
			models,
			model,
			effort,
		},
		modelsColumn,
	}
}

export function saveAssistantSettings(
	db: Database,
	accountId: string,
	input: SaveAssistantSettingsRequest
): Promise<SaveAssistantResult> {
	return db.transaction(async (tx): Promise<SaveAssistantResult> => {
		const [account] = await tx
			.select({ id: accounts.id })
			.from(accounts)
			.where(eq(accounts.id, accountId))
			.for('update')
		if (!account) throw new Error('Teacher account missing while locking settings')
		const current = await readAssistantSettings(tx, accountId)
		const merged = mergeAssistant(current, input)
		if (!merged) return { ok: false, error: 'invalid' }
		const { settings, modelsColumn } = merged
		const changed = {
			chatMonthlyCapUsd: settings.monthlyCapUsd,
			chatMaxInputTokens: settings.maxInputTokens,
			chatMaxOutputTokens: settings.maxOutputTokens,
			chatModel: settings.model,
			chatEffort: settings.effort,
			...(modelsColumn === undefined ? {} : { chatModels: modelsColumn }),
		}
		await tx
			.insert(teacherSettings)
			.values({ accountId, paysSoonLessons: PAYS_SOON_LESSONS_DEFAULT, ...changed })
			.onConflictDoUpdate({ target: teacherSettings.accountId, set: { ...changed, updatedAt: sql`now()` } })
		return { ok: true, settings: await readAssistantSettings(tx, accountId) }
	})
}
