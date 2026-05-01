import { lessonService } from './lesson-service'
import { lessonWorkflowService } from './lesson-workflow-service'
import type { StoreScope } from './store-scope'
import { studentService } from './student-service'

type StudentWorkflowDeps = {
	students: typeof studentService
	lessons: typeof lessonService
	lessonWorkflow: typeof lessonWorkflowService
}

export function createStudentWorkflowService(
	deps: StudentWorkflowDeps = {
		students: studentService,
		lessons: lessonService,
		lessonWorkflow: lessonWorkflowService,
	}
) {
	return {
		async deleteStudent(actor: StoreScope, studentId: string) {
			const relatedLessons = await deps.lessons.listLessons(actor, {
				status: 'all',
				studentId,
				dateFrom: '',
				dateTo: '',
			})

			for (const lesson of relatedLessons) {
				const remainingStudentIds = lesson.studentIds.filter((id) => id !== studentId)
				if (remainingStudentIds.length === 0) {
					await deps.lessonWorkflow.deleteLesson(actor, lesson.id)
				} else {
					await deps.lessonWorkflow.updateLesson(actor, lesson.id, { studentIds: remainingStudentIds })
				}
			}

			return deps.students.deleteStudent(actor, studentId)
		},
	}
}

export const studentWorkflowService = createStudentWorkflowService()
