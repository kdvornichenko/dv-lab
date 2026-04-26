'use client'

import type { ReactNode } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { useTeacherCrm } from '@/hooks/useTeacherCrm'

export type TeacherCrm = ReturnType<typeof useTeacherCrm>

export function TeacherCrmPageShell({
	children,
	skeletonRows = 7,
}: {
	children: (crm: TeacherCrm, now: Date) => ReactNode
	skeletonRows?: number
}) {
	const crm = useTeacherCrm()
	const now = new Date()

	return (
		<main className="min-h-full p-unit">
			<div className="w-full space-y-5">
				{crm.isLoading ? <WorkspaceSkeleton rows={skeletonRows} /> : children(crm, now)}
			</div>
		</main>
	)
}

function WorkspaceSkeleton({ rows }: { rows: number }) {
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
