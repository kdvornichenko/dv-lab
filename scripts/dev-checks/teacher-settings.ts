import { check, env, sql } from './browser-context.ts'

type Snapshot =
	{ accountId: string; existed: false } | { accountId: string; existed: true; value: number; updatedAt: string }
type SettingsRow = { accountId: string; value: number | null; updatedAt: string | null }

function quote(value: string): string {
	return `'${value.replaceAll("'", "''")}'`
}

function readSettings(accountId?: string): Snapshot {
	const login = env.DEV_TEACHER_LOGIN
	if (!login) throw new Error('Dev teacher login is unavailable')
	const where = accountId ? `a.id = ${quote(accountId)}` : `a.login = ${quote(login)}`
	const result = sql<SettingsRow>(`select a.id as "accountId", s.pays_soon_lessons as value,
s.updated_at::text as "updatedAt" from accounts a left join teacher_settings s on s.account_id = a.id
where ${where} and a.role = 'teacher'`)
	if (result.rows.length !== 1) throw new Error('Teacher settings snapshot requires one teacher')
	const row = result.rows[0]
	if (typeof row.accountId !== 'string' || !/^[a-f0-9-]{36}$/i.test(row.accountId))
		throw new Error('Teacher settings snapshot has an invalid account')
	if (row.value === null && row.updatedAt === null) return { accountId: row.accountId, existed: false }
	if (
		!Number.isInteger(row.value) ||
		row.value === null ||
		row.value < 0 ||
		row.value > 20 ||
		typeof row.updatedAt !== 'string' ||
		!row.updatedAt
	)
		throw new Error('Teacher settings snapshot is invalid')
	return { accountId: row.accountId, existed: true, value: row.value, updatedAt: row.updatedAt }
}

function sameSettings(left: Snapshot, right: Snapshot): boolean {
	if (left.accountId !== right.accountId || left.existed !== right.existed) return false
	if (!left.existed || !right.existed) return true
	return left.value === right.value && left.updatedAt === right.updatedAt
}

function restoreSettings(original: Snapshot): void {
	if (sameSettings(original, readSettings(original.accountId))) return
	const id = quote(original.accountId)
	if (original.existed) {
		sql(`insert into teacher_settings (account_id, pays_soon_lessons, updated_at)
values (${id}, ${original.value}, ${quote(original.updatedAt)}::timestamptz)
on conflict (account_id) do update set pays_soon_lessons = excluded.pays_soon_lessons, updated_at = excluded.updated_at`)
	} else {
		sql(`delete from teacher_settings where account_id = ${id}`)
	}
	const same = sameSettings(original, readSettings(original.accountId))
	check('teacher settings are back to the state before the run', same)
	if (!same) throw new Error('Teacher settings restoration did not match the snapshot')
}

export async function withTeacherSettings(run: () => Promise<void>): Promise<void> {
	const original = readSettings()
	console.log(`teacher settings before: row ${original.existed ? 'present' : 'absent'}`)
	const errors: unknown[] = []
	try {
		await run()
	} catch (error) {
		errors.push(error)
	} finally {
		try {
			restoreSettings(original)
		} catch (error) {
			errors.push(error)
		}
	}
	if (errors.length === 1) throw errors[0]
	if (errors.length > 1) throw new AggregateError(errors, 'Journey and teacher settings restoration failed')
}
