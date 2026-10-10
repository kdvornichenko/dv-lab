import { eq } from 'drizzle-orm'

import type { StudentAccount } from '@dv-lab/contracts'
import { type Database, type DbExecutor, students } from '@dv-lab/db'

import {
	type CreateStudentResult,
	type DeactivateStudentResult,
	type LinkStudentAccountResult,
	createStudent,
	deactivateStudent,
	linkStudentAccount,
	listUnlinkedStudentAccounts,
} from '../auth/accounts.ts'

type CreateCardAccountInput = { login: string; password: string | null }

export type CreateCardAccountResult = CreateStudentResult | { kind: 'not_found' }

async function lockCardName(executor: DbExecutor, cardId: string): Promise<string | null> {
	const [row] = await executor
		.select({ displayName: students.displayName })
		.from(students)
		.where(eq(students.id, cardId))
		.for('share')
	return row ? row.displayName : null
}

export function createCardAccount(
	db: Database,
	cardId: string,
	input: CreateCardAccountInput
): Promise<CreateCardAccountResult> {
	return db.transaction(async (tx): Promise<CreateCardAccountResult> => {
		const displayName = await lockCardName(tx, cardId)
		if (displayName === null) return { kind: 'not_found' }
		return createStudent(tx, { login: input.login, displayName, password: input.password, studentId: cardId })
	})
}

export function linkCardAccount(db: Database, cardId: string, accountId: string): Promise<LinkStudentAccountResult> {
	return db.transaction(async (tx): Promise<LinkStudentAccountResult> => {
		if ((await lockCardName(tx, cardId)) === null) return { kind: 'not_found' }
		return linkStudentAccount(tx, { accountId, studentId: cardId })
	})
}

export async function cardAccountCandidates(db: Database, cardId: string): Promise<StudentAccount[] | null> {
	const [card] = await db.select({ id: students.id }).from(students).where(eq(students.id, cardId))
	if (!card) return null
	return listUnlinkedStudentAccounts(db)
}

export function deactivateCardAccount(
	db: Database,
	cardId: string,
	accountId: string
): Promise<DeactivateStudentResult> {
	return deactivateStudent(db, { accountId, studentId: cardId })
}
