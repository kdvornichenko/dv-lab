import {
	CURRENCIES,
	type Currency,
	GENDERS,
	type Gender,
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
	noShowDeducts: students.noShowDeducts,
	gender: students.gender,
	archivedAt: students.archivedAt,
	revision: students.revision,
}

export type CardRecord = Pick<typeof students.$inferSelect, keyof typeof cardColumns>

function toStudentStatus(value: string): StudentStatus {
	if (value === 'active' || value === 'archived') return value
	throw new Error('unexpected student status')
}

export function toCurrency(value: string | null): Currency | null {
	if (value === null) return null
	const known = CURRENCIES.find((currency) => currency === value)
	if (!known) throw new Error('unexpected student currency')
	return known
}

export function toGender(value: string | null): Gender | null {
	if (value === null) return null
	const known = GENDERS.find((gender) => gender === value)
	if (!known) throw new Error('unexpected student gender')
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
		nextLessonAt: facts.nextLesson.startsAt,
		nextLesson: facts.nextLesson,
		lastPayment: facts.lastPayment,
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
		noShowDeducts: row.noShowDeducts,
		gender: toGender(row.gender),
		archivedAt: row.archivedAt === null ? null : row.archivedAt.toISOString(),
		account,
		revision: row.revision,
	}
}
