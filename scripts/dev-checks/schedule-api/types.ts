import type {
	ScheduleBlock,
	ScheduleLessonActions,
	ScheduleLessonResponse,
	ScheduleSeriesResponse,
	ScheduleOccurrenceResponse,
	ScheduleMarkResponse,
	ScheduleWeekResponse,
} from '../../../packages/contracts/src/schedule.ts'
import type { StudentResponse, StudentsResponse, StudentRow } from '../../../packages/contracts/src/students.ts'
import type { TodayResponse } from '../../../packages/contracts/src/today.ts'

export type { ScheduleBlock, ScheduleLessonActions, StudentRow }

export type Api = { base: string; port: number; logs: () => string; stop: () => Promise<unknown> }
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type RequestBody = { [key: string]: JsonValue }
export type ApiPayload = StudentResponse &
	StudentsResponse &
	ScheduleLessonResponse &
	ScheduleSeriesResponse &
	ScheduleOccurrenceResponse &
	ScheduleMarkResponse & { error: { code: string } }
export type WeekPayload = Omit<ApiPayload, 'series'> & ScheduleWeekResponse
export type TodayPayload = Omit<ApiPayload, 'series'> & TodayResponse
export type Reply<T = ApiPayload> = { status: number; json: T; headers: Headers }
export type CallOptions = { cookie?: string; body?: RequestBody; origin?: boolean; headers?: Record<string, string> }
export type SqlRow = {
	id: string
	kind: string
	n: number
	t: string
	starts_at: string
	status: string
	series_id: string | null
	lesson_id: string | null
	original_on: string | null
	weekday: number
	start_time: string
	duration_minutes: number
	starts_on: string
	ends_on: string
	series: number
	lessons: number
	exceptions: number
}
export type Counts = Pick<SqlRow, 'series' | 'lessons' | 'exceptions'>
export type ChangeContext = {
	api: Api
	cookie: string
	ids: string[]
	studentId: string
	today: string
	thisMonday: string
	s1: string
	dW: string
	counts: Counts[]
	snapshot?: string
}
export type Refusal = [string, () => Promise<Reply<ApiPayload | WeekPayload>>, number, string?]
export type Helpers = {
	call: <T = ApiPayload>(api: Api, method: string, path: string, options?: CallOptions) => Promise<Reply<T>>
	quote: (value: string | number | null) => string
	sql: (text: string, role?: string) => { rows: SqlRow[]; rowCount: number }
	startApi: (options: { port: number }) => Promise<Api>
	teacherCookie: (api: Api) => Promise<string>
	studentCookie: (api: Api) => Promise<string>
	TEACHER_LOGIN: string
}
