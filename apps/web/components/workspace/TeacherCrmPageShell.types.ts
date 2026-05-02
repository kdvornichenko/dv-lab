import type { ReactNode } from 'react'

import type { useTeacherCrm } from '@/hooks/useTeacherCrm'

export type TeacherCrm = ReturnType<typeof useTeacherCrm>

export type TeacherCrmPageShellProps = {
	children: (crm: TeacherCrm, now: Date) => ReactNode
	skeletonRows?: number
	classNames?: { main?: string; container?: string }
}

export type WorkspaceSkeletonProps = {
	rows: number
}
