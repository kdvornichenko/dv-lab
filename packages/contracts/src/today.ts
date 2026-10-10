import type { ScheduleBlock, ScheduleSeries } from './schedule.ts'
import type { StudentRow } from './students.ts'

export type TodayResponse = {
	date: string
	lessons: ScheduleBlock[]
	earlier: ScheduleBlock[]
	series: ScheduleSeries[]
	paysSoon: StudentRow[]
	paysSoonLessons: number
}
