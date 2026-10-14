import { CURRENCIES, type Currency, type StudentRow } from '@dv-lab/contracts'
import { balanceState, type BalanceState } from '@dv-lab/core'

export const SORT_KEYS = ['student', 'rate', 'balance', 'next'] as const
export const SORT_DIRECTIONS = ['asc', 'desc'] as const
export const PRESENCE_VALUES = ['any', 'has', 'none'] as const
export const BALANCE_STATES = [
	'plenty',
	'pays_soon',
	'none_left',
	'owes',
	'not_set',
] as const satisfies readonly BalanceState[]

export type SortKey = (typeof SORT_KEYS)[number]
export type SortDirection = (typeof SORT_DIRECTIONS)[number]
export type Presence = (typeof PRESENCE_VALUES)[number]

export interface StudentsViewState {
	q: string
	sort: SortKey | null
	dir: SortDirection
	pay: BalanceState[]
	cur: Currency[]
	rate: Presence
	next: Presence
}

export interface StudentsViewCounts {
	pay: Record<BalanceState, number>
	cur: Record<Currency, number>
}

export interface StudentsViewResult {
	rows: StudentRow[]
	counts: StudentsViewCounts
	currencies: Currency[]
}

const collator = new Intl.Collator('en', { sensitivity: 'base' })

function byName(left: StudentRow, right: StudentRow) {
	return collator.compare(left.displayName, right.displayName)
}

function matchesQuery(student: StudentRow, query: string) {
	const text = query.trim().toLowerCase()
	return text === '' || student.displayName.toLowerCase().includes(text)
}

function stateOf(student: StudentRow, threshold: number) {
	return balanceState(student.balanceMinutes, student.defaultLessonMinutes, threshold)
}

function hasLesson(student: StudentRow) {
	return student.nextLesson.result === 'known'
}

function matchesPresence(value: Presence, present: boolean) {
	return value === 'any' || (value === 'has' ? present : !present)
}

function matchesPay(student: StudentRow, state: StudentsViewState, threshold: number) {
	return state.pay.length === 0 || state.pay.includes(stateOf(student, threshold))
}

function matchesCurrency(student: StudentRow, state: StudentsViewState) {
	return state.cur.length === 0 || (student.currency !== null && state.cur.includes(student.currency))
}

function matchesRest(student: StudentRow, state: StudentsViewState) {
	return (
		matchesQuery(student, state.q) &&
		matchesPresence(state.rate, student.rateMinor !== null) &&
		matchesPresence(state.next, hasLesson(student))
	)
}

function lessonsOf(student: StudentRow) {
	return (student.balanceMinutes ?? 0) / student.defaultLessonMinutes
}

function startOf(student: StudentRow) {
	return student.nextLesson.result === 'known' ? Date.parse(student.nextLesson.startsAt) : 0
}

function isEmpty(student: StudentRow, key: SortKey) {
	if (key === 'rate') return student.rateMinor === null
	if (key === 'balance') return student.balanceMinutes === null
	if (key === 'next') return !hasLesson(student)
	return false
}

function compareValues(left: StudentRow, right: StudentRow, key: SortKey, sign: number) {
	if (key === 'student') return sign * byName(left, right)
	if (key === 'rate') {
		const codes = collator.compare(left.currency ?? '', right.currency ?? '')
		return codes !== 0 ? codes : sign * ((left.rateMinor ?? 0) - (right.rateMinor ?? 0))
	}
	if (key === 'balance') return sign * (lessonsOf(left) - lessonsOf(right))
	return sign * (startOf(left) - startOf(right))
}

function sortRows(rows: StudentRow[], state: StudentsViewState) {
	const key = state.sort
	const sign = state.dir === 'desc' ? -1 : 1
	return rows.sort((left, right) => {
		if (key !== null) {
			const leftEmpty = isEmpty(left, key)
			const rightEmpty = isEmpty(right, key)
			if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1
			if (!leftEmpty) {
				const order = compareValues(left, right, key, sign)
				if (order !== 0) return order
			}
		}
		return byName(left, right)
	})
}

export function activeFilterCount(state: StudentsViewState) {
	return (
		(state.pay.length > 0 ? 1 : 0) +
		(state.cur.length > 0 ? 1 : 0) +
		(state.rate !== 'any' ? 1 : 0) +
		(state.next !== 'any' ? 1 : 0)
	)
}

export function studentsView(
	rows: readonly StudentRow[],
	state: StudentsViewState,
	threshold: number
): StudentsViewResult {
	const pay = Object.fromEntries(BALANCE_STATES.map((item) => [item, 0])) as Record<BalanceState, number>
	const cur = Object.fromEntries(CURRENCIES.map((item) => [item, 0])) as Record<Currency, number>
	const present = new Set<Currency>(state.cur)
	const shown: StudentRow[] = []
	for (const student of rows) {
		if (student.currency !== null) present.add(student.currency)
		if (!matchesRest(student, state)) continue
		const currencyOk = matchesCurrency(student, state)
		const payOk = matchesPay(student, state, threshold)
		if (currencyOk) pay[stateOf(student, threshold)] += 1
		if (payOk && student.currency !== null) cur[student.currency] += 1
		if (currencyOk && payOk) shown.push(student)
	}
	return {
		rows: sortRows(shown, state),
		counts: { pay, cur },
		currencies: CURRENCIES.filter((item) => present.has(item)),
	}
}
