import type { APIRequestContext } from '@playwright/test'

import type { ScheduleBlock } from '../../packages/contracts/src/schedule.ts'
import { BASE } from './data.ts'
import { flag, integer, list, record, text, uuid } from './input.ts'

export type StudentFacts = { id: string; balanceMinutes: number | null }
export type BlockFacts = Pick<ScheduleBlock, 'key' | 'studentId' | 'startsAt' | 'outcome' | 'mark' | 'actions'>
export type TodayFacts = {
	lessons: BlockFacts[]
	earlier: BlockFacts[]
	paysSoon: StudentFacts[]
	paysSoonLessons: number
}
export type Body = Record<string, string | number | boolean | null>

export async function api(
	request: APIRequestContext,
	method: string,
	path: string,
	body?: Body,
	expectedStatus?: number
): Promise<unknown> {
	const response = await request
		.fetch(`${BASE}/api${path}`, {
			method,
			headers: { origin: BASE },
			data: body,
			failOnStatusCode: false,
		})
		.catch(() => {
			throw new Error('Public API request failed; request details suppressed')
		})
	try {
		const accepted = expectedStatus === undefined ? response.ok() : response.status() === expectedStatus
		if (!accepted) throw new Error(`Public API ${method} failed with status ${response.status()}`)
		if (response.status() === 204) return null
		const value: unknown = await response.json().catch(() => {
			throw new Error('Public API returned invalid JSON')
		})
		return value
	} finally {
		await response.dispose()
	}
}

export function studentFacts(value: unknown): StudentFacts {
	const row = record(value)
	return { id: uuid(row.id), balanceMinutes: row.balanceMinutes === null ? null : integer(row.balanceMinutes) }
}

function blockFacts(value: unknown): BlockFacts {
	const row = record(value)
	const outcome = text(row.outcome)
	const mark = row.mark === null ? null : text(row.mark)
	if (!['planned', 'done', 'no_show', 'cancelled', 'moved'].includes(outcome))
		throw new Error('Invalid schedule outcome')
	if (mark !== null && !['done', 'no_show', 'none'].includes(mark)) throw new Error('Invalid lesson mark')
	return {
		key: text(row.key),
		studentId: uuid(row.studentId),
		startsAt: text(row.startsAt),
		outcome: outcome as BlockFacts['outcome'],
		mark: mark as BlockFacts['mark'],
		actions: actionsFacts(row.actions),
	}
}

function actionsFacts(value: unknown): ScheduleBlock['actions'] {
	const row = record(value)
	return {
		move: flag(row.move),
		cancel: flag(row.cancel),
		restore: flag(row.restore),
		mark: flag(row.mark),
		series: flag(row.series),
	}
}

export async function readToday(request: APIRequestContext): Promise<TodayFacts> {
	const row = record(await api(request, 'GET', '/today'))
	return {
		lessons: list(row.lessons).map(blockFacts),
		earlier: list(row.earlier).map(blockFacts),
		paysSoon: list(row.paysSoon).map(studentFacts),
		paysSoonLessons: integer(row.paysSoonLessons),
	}
}

export async function readWeek(request: APIRequestContext, start: string): Promise<BlockFacts[]> {
	return list(record(await api(request, 'GET', `/schedule/week?start=${start}`)).blocks).map(blockFacts)
}

export async function readStudent(request: APIRequestContext, id: string): Promise<StudentFacts> {
	return studentFacts(record(await api(request, 'GET', `/students/${uuid(id)}`)).student)
}

export async function readStudents(request: APIRequestContext): Promise<StudentFacts[]> {
	return list(record(await api(request, 'GET', '/students')).students).map(studentFacts)
}

export async function readSettings(request: APIRequestContext): Promise<number> {
	return integer(record(record(await api(request, 'GET', '/settings')).settings).paysSoonLessons)
}

export async function teacherId(request: APIRequestContext): Promise<string> {
	const account = record(record(await api(request, 'GET', '/auth/me')).account)
	if (text(account.role) !== 'teacher') throw new Error('E2E requires the teacher role')
	return uuid(account.id)
}

export async function readNoShowFlag(request: APIRequestContext, id: string): Promise<boolean> {
	return flag(record(record(await api(request, 'GET', `/students/${uuid(id)}`)).student).noShowDeducts)
}
