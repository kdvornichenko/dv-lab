import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'

const DAY_ROWS = [2, 1, 2] as const

function AgendaRowSkeleton() {
	return (
		<div className="flex items-start gap-3 p-2">
			<Skeleton className="mt-1.5 size-2 shrink-0 rounded-full" />
			<div className="flex w-31 shrink-0 flex-col">
				<SkeletonLine box="h-5" className="w-21 rounded-md" />
				<SkeletonLine box="h-4" className="h-2.5 w-25 rounded-md" />
			</div>
			<SkeletonLine box="h-5" className="h-3.5 w-28 rounded-md" />
		</div>
	)
}

export function AgendaSkeleton() {
	return (
		<div data-slot="calendar-agenda-skeleton" className="space-y-4 lg:hidden">
			{DAY_ROWS.map((rows, day) => (
				<div key={day} className="flex min-w-0 gap-3">
					<div className="flex w-11 shrink-0 flex-col items-center gap-1">
						<SkeletonLine box="h-4" className="h-2.5 w-7 rounded-md" />
						<Skeleton className="size-11 rounded-full" />
					</div>
					<div className="min-w-0 flex-1">
						{Array.from({ length: rows }, (_: undefined, row) => (
							<AgendaRowSkeleton key={row} />
						))}
					</div>
				</div>
			))}
		</div>
	)
}
