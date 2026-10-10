import {
	CURRENCIES,
	type Currency,
	type StudentAccount,
	type StudentDetail,
	type StudentRow,
	type StudentStatus,
} from '@dv-lab/contracts'
import { students } from '@dv-lab/db'

import type { CardFacts } from './card-facts.ts'

export const cardColumns = {
	id: students.id,
	displayName: students.displayName,
	status: students.status,
	rateMinor: students.rateMinor,
	currency: students.currency,
	defaultLessonMinutes: students.defaultLessonMinutes,
	parent: students.parent,
	level: students.level,
	goals: students.goals,
	timeZone: students.timeZone,
	openingBalanceMinutes: students.openingBalanceMinutes,
	openingBalanceOn: students.openingBalanceOn,
	archivedAt: students.archivedAt,
}

export type CardRecord = Pick<typeof students.$inferSelect, keyof typeof cardColumns>

function toStudentStatus(value: string): StudentStatus {
	if (value === 'active' || value === 'archived') return value
	throw new Error('unexpected student status')
}

function toCurrency(value: string | null): Currency | null {
	if (value === null) return null
	const known = CURRENCIES.find((currency) => currency === value)
	if (!known) throw new Error('unexpected student currency')
	return known
}

export function toCardRow(row: CardRecord, facts: CardFacts): StudentRow {
	return {
		id: row.id,
		displayName: row.displayName,
		status: toStudentStatus(row.status),
		rateMinor: row.rateMinor,
		currency: toCurrency(row.currency),
		defaultLessonMinutes: row.defaultLessonMinutes,
		balanceMinutes: facts.balanceMinutes,
		nextLessonAt: facts.nextLessonAt,
	}
}

export function toStudentDetail(row: CardRecord, facts: CardFacts, account: StudentAccount | null): StudentDetail {
	return {
		...toCardRow(row, facts),
		parent: row.parent,
		level: row.level,
		goals: row.goals,
		timeZone: row.timeZone,
		openingBalance:
			row.openingBalanceMinutes === null || row.openingBalanceOn === null
				? null
				: { minutes: row.openingBalanceMinutes, on: row.openingBalanceOn },
		archivedAt: row.archivedAt === null ? null : row.archivedAt.toISOString(),
		account,
	}
}
