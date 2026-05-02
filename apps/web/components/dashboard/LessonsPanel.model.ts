import type { Lesson } from '@teacher-crm/api-types'

import type { LessonTone } from './LessonsPanel.types'

export function lessonTone(lesson: Lesson): LessonTone {
	if (lesson.status === 'completed') {
		return { badge: 'green', rail: 'bg-success', frame: 'border-success-line bg-success-soft/35' }
	}
	if (lesson.status === 'cancelled') {
		return { badge: 'red', rail: 'bg-danger', frame: 'border-danger-line bg-danger-soft/35' }
	}
	if (lesson.status === 'rescheduled') {
		return { badge: 'amber', rail: 'bg-warning', frame: 'border-warning-line bg-warning-soft/45' }
	}
	if (lesson.status === 'no_show') {
		return { badge: 'amber', rail: 'bg-warning', frame: 'border-warning-line bg-warning-soft/45' }
	}
	return { badge: 'neutral', rail: 'bg-sage', frame: 'border-line-soft bg-surface-muted' }
}

export const absentFreeTone: LessonTone = {
	badge: 'amber',
	rail: 'bg-warning',
	frame: 'border-warning-line bg-warning-soft/45',
}
