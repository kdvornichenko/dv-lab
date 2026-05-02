'use client'

import { useMemo } from 'react'

import { useTeacherCrmCalendar } from '@/hooks/useTeacherCrmCalendar'
import { useTeacherCrmCommands } from '@/hooks/useTeacherCrmCommands'
import { useTeacherCrmData } from '@/hooks/useTeacherCrmData'

export function useTeacherCrm() {
	const data = useTeacherCrmData()
	const commands = useTeacherCrmCommands({
		lessons: data.state.lessons,
		refresh: data.refresh,
		setState: data.setState,
	})
	const calendar = useTeacherCrmCalendar({
		calendarOptionsRef: data.calendarOptionsRef,
		refresh: data.refresh,
		setCalendarOptions: data.setCalendarOptions,
		state: data.state,
	})

	return useMemo(
		() => ({
			state: data.state,
			summary: data.summary,
			calendarOptions: data.calendarOptions,
			isCalendarImporting: calendar.isCalendarImporting,
			visibleStudents: data.visibleStudents,
			studentRows: data.studentRows,
			studentFilter: data.studentFilter,
			setStudentFilter: data.setStudentFilter,
			isLoading: data.isLoading,
			addStudent: commands.addStudent,
			updateStudent: commands.updateStudent,
			archiveStudent: commands.archiveStudent,
			deleteStudent: commands.deleteStudent,
			addLesson: commands.addLesson,
			updateLesson: commands.updateLesson,
			deleteLesson: commands.deleteLesson,
			addCalendarBlock: commands.addCalendarBlock,
			updateCalendarBlock: commands.updateCalendarBlock,
			deleteCalendarBlock: commands.deleteCalendarBlock,
			markAttendance: commands.markAttendance,
			markGroupAttended: commands.markGroupAttended,
			recordPayment: commands.recordPayment,
			deletePayment: commands.deletePayment,
			connectCalendar: calendar.connectCalendar,
			selectCalendar: calendar.selectCalendar,
			syncLesson: calendar.syncLesson,
			checkCalendarConflicts: calendar.checkCalendarConflicts,
			refresh: data.refresh,
		}),
		[
			calendar.checkCalendarConflicts,
			calendar.connectCalendar,
			calendar.isCalendarImporting,
			calendar.selectCalendar,
			calendar.syncLesson,
			commands.addLesson,
			commands.addCalendarBlock,
			commands.addStudent,
			commands.archiveStudent,
			commands.deleteCalendarBlock,
			commands.deleteLesson,
			commands.deletePayment,
			commands.deleteStudent,
			commands.markAttendance,
			commands.markGroupAttended,
			commands.recordPayment,
			commands.updateCalendarBlock,
			commands.updateLesson,
			commands.updateStudent,
			data.calendarOptions,
			data.isLoading,
			data.refresh,
			data.setStudentFilter,
			data.state,
			data.studentFilter,
			data.studentRows,
			data.summary,
			data.visibleStudents,
		]
	)
}
