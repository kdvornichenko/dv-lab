import { and, eq, sql } from 'drizzle-orm'

import { accounts } from '@dv-lab/db'
import type { Database } from '@dv-lab/db'

const ONE_ACTIVE_TEACHER_CONSTRAINT = 'accounts_one_active_teacher_uq'
const CAUSE_DEPTH = 5

type CreateTeacherInput = { login: string; displayName: string; passwordHash: string }

export type CreateTeacherResult = { kind: 'created'; login: string } | { kind: 'teacher_exists' }

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
