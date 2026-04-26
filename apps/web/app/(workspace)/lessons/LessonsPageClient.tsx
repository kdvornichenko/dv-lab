'use client'

import { LessonsCalendarPanel } from '@/components/dashboard/LessonsCalendarPanel'
import { TeacherCrmPageShell } from '@/components/workspace/TeacherCrmPageShell'

export function LessonsPageClient() {
	return (
		<TeacherCrmPageShell>
			{(crm) => (
				<LessonsCalendarPanel
					lessons={crm.state.lessons}
					students={crm.state.students}
					calendarSyncRecords={crm.state.calendarSyncRecords}
					onAddLesson={crm.addLesson}
					onUpdateLesson={crm.updateLesson}
					onCheckCalendarConflicts={crm.checkCalendarConflicts}
				/>
			)}
		</TeacherCrmPageShell>
	)
}
