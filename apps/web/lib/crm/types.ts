import type {
	AttendanceRecord,
	CalendarConnection,
	CalendarListEntry,
	CalendarSyncRecord,
	Currency,
	Lesson,
	Payment,
	Student,
	StudentBalance,
} from '@teacher-crm/api-types'

export type TeacherCrmState = {
	students: Student[]
	lessons: Lesson[]
	attendance: AttendanceRecord[]
	payments: Payment[]
	studentBalances: StudentBalance[]
	calendarConnection: CalendarConnection
	calendarOptions: CalendarListEntry[]
	calendarSyncRecords: CalendarSyncRecord[]
}

export type TeacherCrmSummary = {
	activeStudents: number
	todayLessons: number
	missingAttendance: number
	overdueStudents: number
	monthIncome: number
	monthIncomeByCurrency: Record<Currency, number>
}

export type StudentWithBalance = Student & {
	balance: StudentBalance
}
