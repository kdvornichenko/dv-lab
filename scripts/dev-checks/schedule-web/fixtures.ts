import { sql } from '../browser-context.ts'
import { removeStudentCards } from '../fixture-cleanup.mjs'

export const fixtureWhere = (like: string) => `display_name like '${like}' and import_key is null`

export function cleanupFixtures(label: string, like = 'Alex Example 20%') {
	const before = sql<{ n: number }>(`select count(*)::int as n from students where ${fixtureWhere(like)}`)
	const found = before.rows?.[0]?.n ?? 0
	removeStudentCards(sql, fixtureWhere(like))
	console.log(`${label}: fixture cards removed ${found}`)
	return found
}
