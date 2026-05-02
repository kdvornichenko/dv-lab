'use client'

import { LessonsCalendarPanel } from '@/components/dashboard/LessonsCalendarPanel'
import { TeacherCrmPageShell } from '@/components/workspace/TeacherCrmPageShell'

export function LessonsPageClient() {
	return (
		<TeacherCrmPageShell classNames={{ main: 'p-0' }}>
			{(crm) => (
				<LessonsCalendarPanel
					lessons={crm.state.lessons}
					students={crm.state.students}
					calendarSyncRecords={crm.state.calendarSyncRecords}
					calendarBlocks={crm.state.calendarBlocks}
					lessonOccurrenceExceptions={crm.state.lessonOccurrenceExceptions}
					onAddLesson={crm.addLesson}
					onUpdateLesson={crm.updateLesson}
					onDeleteLesson={crm.deleteLesson}
					onAddCalendarBlock={crm.addCalendarBlock}
					onUpdateCalendarBlock={crm.updateCalendarBlock}
					onDeleteCalendarBlock={crm.deleteCalendarBlock}
					onCheckCalendarConflicts={crm.checkCalendarConflicts}
				/>
			)}
		</TeacherCrmPageShell>
	)
}
