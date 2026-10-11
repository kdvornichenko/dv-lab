import type { CalendarReadStatus, GoogleScheduleWindow } from './calendar.ts'
import type { ScheduleBlock, ScheduleSeries } from './schedule.ts'
import type { StudentRow } from './students.ts'

export type TodayResponse = {
	date: string
	defaultTimeZone: string
	asOf: string
	calendarRead: CalendarReadStatus
	calendarWrite: GoogleScheduleWindow['write']
	lessons: ScheduleBlock[]
	earlier: ScheduleBlock[]
	series: ScheduleSeries[]
	paysSoon: StudentRow[]
	paysSoonLessons: number
}
