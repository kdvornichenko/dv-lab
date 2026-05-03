import type { Dispatch, SetStateAction } from 'react'

import type { TeacherCrmState } from '@/lib/crm/types'

import type { Lesson } from '@teacher-crm/api-types'

export type RefreshTeacherCrm = (options?: {
	showLoading?: boolean
	awaitSupplements?: boolean
	force?: boolean
}) => Promise<void>

export type RunCrmAction = (source: string, action: () => Promise<void>) => Promise<void>

export type UseTeacherCrmCommandsInput = {
	lessons: Lesson[]
	refresh: RefreshTeacherCrm
	setState: Dispatch<SetStateAction<TeacherCrmState>>
}

export type TeacherCrmCommandBaseDeps = {
	runCrmAction: RunCrmAction
	refreshAfterMutation: () => Promise<void>
	setState: Dispatch<SetStateAction<TeacherCrmState>>
}

export type TeacherCrmCalendarCommandDeps = TeacherCrmCommandBaseDeps & {
	ensureCalendarTokens: () => Promise<void>
}

export type TeacherCrmLessonCommandDeps = TeacherCrmCalendarCommandDeps & {
	lessons: Lesson[]
}
