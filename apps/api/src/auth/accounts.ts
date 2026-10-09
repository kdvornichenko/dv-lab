import { and, desc, eq, sql } from 'drizzle-orm'

import type { AccountSummary, StudentAccount } from '@dv-lab/contracts'
import { accounts, violatesUnique } from '@dv-lab/db'
import type { Database, DbExecutor } from '@dv-lab/db'

import { studentAccountColumns, toStudentAccount } from './account-rows.ts'
import { generatePassword, hashPassword, verifyPassword } from './passwords.ts'
import { issueSession, revokeAccountSessions } from './sessions.ts'
import type { CredentialCheck, SignIn } from './sign-in.ts'

const ONE_ACTIVE_TEACHER_CONSTRAINT = 'accounts_one_active_teacher_uq'
const ACTIVE_LOGIN_CONSTRAINT = 'accounts_active_login_uq'
const STUDENT_CARD_CONSTRAINT = 'accounts_student_uq'

type CreateTeacherInput = { login: string; displayName: string; passwordHash: string }

export type CreateTeacherResult = { kind: 'created'; login: string } | { kind: 'teacher_exists' }

type CreateStudentInput = { login: string; displayName: string; password: string | null; studentId: string | null }

export type CreateStudentResult =
	| { kind: 'created'; account: StudentAccount; generatedPassword: string | null }
	| { kind: 'login_taken' }
	| { kind: 'card_has_account' }

export type DeactivateStudentResult = { kind: 'deactivated'; student: StudentAccount } | { kind: 'not_found' }

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

export async function createStudent(executor: DbExecutor, input: CreateStudentInput): Promise<CreateStudentResult> {
	const password = input.password ?? generatePassword()
	const generatedPassword = input.password === null ? password : null
	const passwordHash = await hashPassword(password)
	try {
		const account = await executor.transaction(async (tx) => {
			const [row] = await tx
				.insert(accounts)
				.values({
					login: input.login,
					displayName: input.displayName,
					role: 'student',
					passwordHash,
					studentId: input.studentId,
				})
				.returning(studentAccountColumns)
			if (!row) throw new Error('student insert returned no row')
			return toStudentAccount(row)
		})
		return { kind: 'created', account, generatedPassword }
	} catch (error) {
		if (violatesUnique(error, ACTIVE_LOGIN_CONSTRAINT)) return { kind: 'login_taken' }
		if (violatesUnique(error, STUDENT_CARD_CONSTRAINT)) return { kind: 'card_has_account' }
		throw error
	}
}

export async function findStudentAccount(executor: DbExecutor, studentId: string): Promise<StudentAccount | null> {
	const [row] = await executor
		.select(studentAccountColumns)
		.from(accounts)
		.where(and(eq(accounts.studentId, studentId), eq(accounts.role, 'student')))
		.orderBy(sql`${accounts.status} = 'active' desc`, desc(accounts.updatedAt), desc(accounts.createdAt))
		.limit(1)
	return row ? toStudentAccount(row) : null
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
			.returning(studentAccountColumns)
		if (!row) throw new Error('student update returned no row')
		await revokeAccountSessions(tx, locked.id)
		return { kind: 'deactivated', student: toStudentAccount(row) }
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
