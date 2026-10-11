import type { Api, Reply, SqlRow, ScheduleBlock } from '../schedule-api/types.ts'

export type {
	Api,
	Reply,
	SqlRow,
	RequestBody,
	WeekPayload,
	TodayPayload,
	ScheduleBlock,
	ScheduleLessonActions,
	StudentRow,
	Refusal,
} from '../schedule-api/types.ts'

export type Context = { api: Api; cookie: string; ids: string[]; today: string; before: number }
export type PastTarget = {
	label: string
	key: string
	date: string
	startsAt: string
	moveTime: string
	block: () => Promise<ScheduleBlock>
	markRow: () => SqlRow[]
	path: (action: string) => string
	cancelOutcome: (res: Reply) => string
}
