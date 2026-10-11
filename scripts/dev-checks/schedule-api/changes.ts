import * as core from '../../../packages/core/src/index.ts'
import {
	CHANGES_NAME,
	check,
	countRows,
	createCard,
	failures,
	firstAfter,
	insertSeries,
	pastSnapshot,
	todayVn,
} from './context.ts'
import { partEndKeepsMoved } from './end.ts'
import { partMoveAnywhere } from './moves.ts'
import { partOccurrence } from './occurrences.ts'
import { partSeries } from './series.ts'
import { partSingle } from './singles.ts'
import type { ChangeContext, ScheduleBlock } from './types.ts'
import type { Api } from './types.ts'

export const CHANGE_PARTS = [partOccurrence, partSingle, partSeries, partEndKeepsMoved, partMoveAnywhere]

export async function sectionChanges(api: Api, cookie: string, ids: string[]) {
	const studentId = await createCard(api, cookie, ids, `${CHANGES_NAME} A`)
	const today = todayVn()
	const thisMonday = core.mondayOf(today)
	const s1 = insertSeries(studentId, 3, '18:00', core.addDays(thisMonday, -19), null)
	console.log(`series S1 ${s1}`)
	const ctx: ChangeContext = {
		api,
		cookie,
		ids,
		studentId,
		today,
		thisMonday,
		s1,
		dW: firstAfter(today, 3),
		counts: [],
	}
	ctx.snapshot = await pastSnapshot(ctx)
	check(
		'past weeks snapshot holds one S1 block per week',
		(JSON.parse(ctx.snapshot) as unknown as ScheduleBlock[][]).flat().length === 3
	)
	countRows(ctx)
	for (const part of CHANGE_PARTS) {
		const before = failures
		const token = await part(ctx)
		if (failures === before) console.log(token)
	}
	const shrank = ctx.counts.some(
		(row, index) =>
			index > 0 &&
			(row.series < ctx.counts[index - 1].series ||
				row.lessons < ctx.counts[index - 1].lessons ||
				row.exceptions < ctx.counts[index - 1].exceptions)
	)
	check(`row counts never decreased over ${ctx.counts.length} samples`, !shrank)
	return 'SCHEDULE_API_CHANGES_OK'
}
