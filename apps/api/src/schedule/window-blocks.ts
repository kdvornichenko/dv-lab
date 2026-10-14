import type { ScheduleBlock } from '@dv-lab/contracts'
import { scheduleWindow } from '@dv-lab/core'
import type { DbExecutor } from '@dv-lab/db'

import { readNextLessons } from '../calendar/read-model.ts'
import { filterHistoryBlocks, loadScheduleRows } from './rows.ts'
import { wireBlocks } from './schedule.ts'

export type WindowContext = { accountId: string; now: Date; defaultTimeZone: string }

export type WindowCoverage = 'complete' | 'partial' | 'unread'

export type WindowBlocks = { blocks: ScheduleBlock[]; coverage: WindowCoverage }

export type WindowRange = { from: Date; to: Date; studentIds: readonly string[] }

async function readCoverage(
	executor: DbExecutor,
	context: WindowContext,
	studentIds: readonly string[]
): Promise<WindowCoverage> {
	const reads = await readNextLessons(executor, context, studentIds)
	let coverage: WindowCoverage = 'complete'
	for (const id of studentIds) {
		const state = reads.get(id)?.status.state
		if (state === 'fresh') continue
		if (state === 'last_known') coverage = 'partial'
		else return 'unread'
	}
	return coverage
}

export async function readWindowBlocks(
	executor: DbExecutor,
	context: WindowContext,
	range: WindowRange
): Promise<WindowBlocks> {
	const { from, to, studentIds } = range
	const wanted = new Set(studentIds)
	const rows = await loadScheduleRows(executor, { from, to, studentIds })
	const blocks = (await wireBlocks(executor, scheduleWindow({ ...rows, from, to }), context.now)).filter((block) =>
		wanted.has(block.studentId)
	)
	const now = context.now.getTime()
	const past = blocks.filter((block) => Date.parse(block.startsAt) <= now)
	const kept = new Set((await filterHistoryBlocks(executor, context.accountId, past)).map((block) => block.key))
	const read = blocks.filter((block) => Date.parse(block.startsAt) > now || kept.has(block.key))
	const dropped = past.some((block) => !kept.has(block.key))
	return { blocks: read, coverage: dropped ? await readCoverage(executor, context, studentIds) : 'complete' }
}
