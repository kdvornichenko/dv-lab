'use client'

import { StudentsPanel } from '@/components/students/StudentsPanel'
import { TeacherCrmPageShell } from '@/components/workspace/TeacherCrmPageShell'

export function StudentsPageClient() {
	return (
		<TeacherCrmPageShell>
			{(crm, now) => (
				<StudentsPanel
					visibleStudents={crm.visibleStudents}
					lessons={crm.state.lessons}
					filter={crm.studentFilter}
					now={now}
					onFilterChange={crm.setStudentFilter}
					onAddStudent={crm.addStudent}
					onArchiveStudent={crm.archiveStudent}
					onRecordPayment={crm.recordPayment}
				/>
			)}
		</TeacherCrmPageShell>
	)
}
