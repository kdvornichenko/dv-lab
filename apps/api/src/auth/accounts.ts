import { and, desc, eq, sql } from 'drizzle-orm'

import type { AccountSummary, StudentRow } from '@dv-lab/contracts'
import { accounts } from '@dv-lab/db'
import type { Database } from '@dv-lab/db'

import { studentRowColumns, toStudentRow } from './account-rows.ts'
import { generatePassword, hashPassword, verifyPassword } from './passwords.ts'
import { issueSession, revokeAccountSessions } from './sessions.ts'
import type { CredentialCheck, SignIn } from './sign-in.ts'

const ONE_ACTIVE_TEACHER_CONSTRAINT = 'accounts_one_active_teacher_uq'
const ACTIVE_LOGIN_CONSTRAINT = 'accounts_active_login_uq'
const CAUSE_DEPTH = 5

type CreateTeacherInput = { login: string; displayName: string; passwordHash: string }

export type CreateTeacherResult = { kind: 'created'; login: string } | { kind: 'teacher_exists' }

type CreateStudentInput = { login: string; displayName: string; password: string | null }

export type CreateStudentResult =
	{ kind: 'created'; student: StudentRow; generatedPassword: string | null } | { kind: 'login_taken' }

export type DeactivateStudentResult = { kind: 'deactivated'; student: StudentRow } | { kind: 'not_found' }

type ChangePasswordInput = {
	account: AccountSummary
	currentPassword: string
	newPassword: string
	ip: string | null | undefined
}

export type ChangePasswordResult =
	| { kind: 'changed'; token: string }
	| { kind: 'wrong_current_password' }
	| { kind: 'password_unchanged' }
	| Exclude<CredentialCheck, { kind: 'ok' | 'invalid_credentials' }>

export type ResetTeacherPasswordResult = { kind: 'reset'; login: string } | { kind: 'not_found' }

export function violatesUnique(error: unknown, constraint: string): boolean {
	let current: unknown = error
	for (let depth = 0; depth < CAUSE_DEPTH && current instanceof Error; depth += 1) {
		const candidate = current as Error & { code?: unknown; constraint?: unknown }
		if (candidate.code === '23505' && candidate.constraint === constraint) return true
		current = candidate.cause
	}
	return false
}

export async function createTeacher(db: Database, input: CreateTeacherInput): Promise<CreateTeacherResult> {
	try {
		return await db.transaction(async (tx): Promise<CreateTeacherResult> => {
			await tx.execute(sql`select pg_advisory_xact_lock(hashtext('dvlab_bootstrap_teacher'))`)
			const [existing] = await tx
				.select({ id: accounts.id })
				.from(accounts)
				.where(and(eq(accounts.role, 'teacher'), eq(accounts.status, 'active')))
				.limit(1)
			if (existing) return { kind: 'teacher_exists' }
			const [row] = await tx
				.insert(accounts)
				.values({
					login: input.login,
					displayName: input.displayName,
					role: 'teacher',
					passwordHash: input.passwordHash,
				})
				.returning({ login: accounts.login })
			if (!row) throw new Error('teacher insert returned no row')
			return { kind: 'created', login: row.login }
		})
	} catch (error) {
		if (violatesUnique(error, ONE_ACTIVE_TEACHER_CONSTRAINT)) return { kind: 'teacher_exists' }
		throw error
	}
}

export async function createStudent(db: Database, input: CreateStudentInput): Promise<CreateStudentResult> {
	const password = input.password ?? generatePassword()
	const generatedPassword = input.password === null ? password : null
	const passwordHash = await hashPassword(password)
	try {
		const [row] = await db
			.insert(accounts)
			.values({ login: input.login, displayName: input.displayName, role: 'student', passwordHash })
			.returning(studentRowColumns)
		if (!row) throw new Error('student insert returned no row')
		return { kind: 'created', student: toStudentRow(row), generatedPassword }
	} catch (error) {
		if (violatesUnique(error, ACTIVE_LOGIN_CONSTRAINT)) return { kind: 'login_taken' }
		throw error
	}
}

export async function listStudents(db: Database): Promise<StudentRow[]> {
	const rows = await db
		.select(studentRowColumns)
		.from(accounts)
		.where(eq(accounts.role, 'student'))
		.orderBy(desc(accounts.createdAt))
	return rows.map(toStudentRow)
}

export function deactivateStudent(db: Database, studentId: string): Promise<DeactivateStudentResult> {
	return db.transaction(async (tx): Promise<DeactivateStudentResult> => {
		const [locked] = await tx
			.select({ id: accounts.id })
			.from(accounts)
			.where(and(eq(accounts.id, studentId), eq(accounts.role, 'student'), eq(accounts.status, 'active')))
			.for('update')
		if (!locked) return { kind: 'not_found' }
		const [row] = await tx
			.update(accounts)
			.set({ status: 'deactivated', updatedAt: sql`now()` })
			.where(eq(accounts.id, locked.id))
			.returning(studentRowColumns)
		if (!row) throw new Error('student update returned no row')
		await revokeAccountSessions(tx, locked.id)
		return { kind: 'deactivated', student: toStudentRow(row) }
	})
}

export async function changePassword(
	db: Database,
	signIn: Pick<SignIn, 'verifyCredentials'>,
	{ account, currentPassword, newPassword, ip }: ChangePasswordInput
): Promise<ChangePasswordResult> {
	const check = await signIn.verifyCredentials({
		accountId: account.id,
		login: account.login,
		password: currentPassword,
		ip,
	})
	if (check.kind === 'invalid_credentials') return { kind: 'wrong_current_password' }
	if (check.kind !== 'ok') return check
	if (await verifyPassword(newPassword, check.passwordHash)) return { kind: 'password_unchanged' }
	const nextHash = await hashPassword(newPassword)
	return db.transaction(async (tx): Promise<ChangePasswordResult> => {
		const [row] = await tx
			.select({ passwordHash: accounts.passwordHash })
			.from(accounts)
			.where(and(eq(accounts.id, account.id), eq(accounts.status, 'active')))
			.for('update')
		if (!row || row.passwordHash !== check.passwordHash) return { kind: 'wrong_current_password' }
		await tx
			.update(accounts)
			.set({ passwordHash: nextHash, updatedAt: sql`now()` })
			.where(eq(accounts.id, account.id))
		const epoch = await revokeAccountSessions(tx, account.id)
		const token = await issueSession(tx, { accountId: account.id, authEpoch: epoch })
		return { kind: 'changed', token }
	})
}

export function resetTeacherPassword(
	db: Database,
	{ login, passwordHash }: { login: string; passwordHash: string }
): Promise<ResetTeacherPasswordResult> {
	return db.transaction(async (tx): Promise<ResetTeacherPasswordResult> => {
		const [locked] = await tx
			.select({ id: accounts.id, login: accounts.login })
			.from(accounts)
			.where(and(eq(accounts.login, login), eq(accounts.role, 'teacher'), eq(accounts.status, 'active')))
			.for('update')
		if (!locked) return { kind: 'not_found' }
		await tx
			.update(accounts)
			.set({ passwordHash, updatedAt: sql`now()` })
			.where(eq(accounts.id, locked.id))
		await revokeAccountSessions(tx, locked.id)
		return { kind: 'reset', login: locked.login }
	})
}
