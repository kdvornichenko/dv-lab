import { eq } from 'drizzle-orm'

import { type Database, type DbExecutor, students } from '@dv-lab/db'

import { type CreateStudentResult, createStudent } from '../auth/accounts.ts'

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
