import type { AccountStatus, AccountSummary, Role, StudentAccount } from '@dv-lab/contracts'
import { accounts } from '@dv-lab/db'

type AccountRecord = typeof accounts.$inferSelect

export const accountSummaryColumns = {
	id: accounts.id,
	login: accounts.login,
	displayName: accounts.displayName,
	role: accounts.role,
}

export const studentAccountColumns = {
	id: accounts.id,
	login: accounts.login,
	displayName: accounts.displayName,
	status: accounts.status,
	createdAt: accounts.createdAt,
}

function toRole(value: string): Role {
	if (value === 'teacher' || value === 'student') return value
	throw new Error('unexpected account role')
}

function toStatus(value: string): AccountStatus {
	if (value === 'active' || value === 'deactivated') return value
	throw new Error('unexpected account status')
}

export function toAccountSummary(row: Pick<AccountRecord, 'id' | 'login' | 'displayName' | 'role'>): AccountSummary {
	return { id: row.id, login: row.login, displayName: row.displayName, role: toRole(row.role) }
}

export function toStudentAccount(
	row: Pick<AccountRecord, 'id' | 'login' | 'displayName' | 'status' | 'createdAt'>
): StudentAccount {
	return {
		id: row.id,
		login: row.login,
		displayName: row.displayName,
		status: toStatus(row.status),
		createdAt: row.createdAt.toISOString(),
	}
}
