import { Skeleton, SkeletonLine } from '@/components/ui/skeleton'

const DAY_ROWS = [2, 1, 2] as const

function AgendaRowSkeleton() {
	return (
		<div className="flex h-9 items-center gap-3 px-2">
			<Skeleton className="size-3 shrink-0 rounded-full" />
			<div className="flex w-31 shrink-0 flex-col">
				<SkeletonLine box="h-4" className="w-21 rounded-md" />
				<SkeletonLine box="h-4" className="h-2.5 w-25 rounded-md" />
			</div>
			<Skeleton className="h-3.5 w-28 rounded-md" />
		</div>
	)
}

export function AgendaSkeleton() {
	return (
		<div data-slot="calendar-agenda-skeleton" className="flex flex-col gap-2 lg:hidden">
			{DAY_ROWS.map((rows, day) => (
				<div key={day} className="flex gap-4 border-t border-gcal-line py-2">
					<div className="flex w-12 shrink-0 flex-col items-center">
						<SkeletonLine box="h-4" className="h-2.5 w-7 rounded-md" />
						<Skeleton className="size-9 rounded-full" />
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
