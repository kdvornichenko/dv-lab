'use client'

import type { FC } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTeacherCrm } from '@/hooks/useTeacherCrm'
import { cn } from '@/lib/utils'
import type { TeacherCrmPageShellProps, WorkspaceSkeletonProps } from './TeacherCrmPageShell.types'

export type { TeacherCrm } from './TeacherCrmPageShell.types'

export const TeacherCrmPageShell: FC<TeacherCrmPageShellProps> = ({
	children,
	skeletonRows = 7,
	classNames,
}) => {
	const crm = useTeacherCrm()
	const now = new Date()

	return (
		<main className={cn('p-unit min-h-full', classNames?.main)}>
			<div className={cn('w-full space-y-5', classNames?.container)}>
				{crm.loadError ? (
					<div role="alert" className="border-warning-line bg-warning-soft rounded-lg border p-3 text-sm text-ink">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<p className="font-heading font-semibold">
									{crm.loadError.source === 'core' ? 'CRM data failed to load' : 'Billing data failed to refresh'}
								</p>
								<p className="mt-1 text-xs text-ink-muted">{crm.loadError.message}</p>
							</div>
							<Button type="button" variant="secondary" size="sm" onClick={() => void crm.refresh()}>
								Retry
							</Button>
						</div>
					</div>
				) : null}
				{crm.isLoading ? <WorkspaceSkeleton rows={skeletonRows} /> : children(crm, now)}
			</div>
		</main>
	)
}

const WorkspaceSkeleton: FC<WorkspaceSkeletonProps> = ({ rows }) => {
	return (
		<div className="grid content-start gap-5">
			<div className="border-line bg-surface rounded-lg border p-4">
				<div className="flex items-start justify-between gap-3">
					<div className="grid gap-2">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-6 w-48" />
					</div>
					<Skeleton className="h-9 w-24 rounded-lg" />
				</div>
				<div className="mt-5 grid gap-3">
					{Array.from({ length: rows }).map((_, index) => (
						<Skeleton key={index} className="h-16 rounded-lg" />
					))}
				</div>
			</div>
		</div>
	)
}
