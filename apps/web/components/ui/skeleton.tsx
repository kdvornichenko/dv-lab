import type { ReactNode } from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Elevated } from '@/lib/elevated'
import { cn } from '@/lib/utils'

const skeletonShape =
	'animate-[shimmer_1.6s_linear_infinite] rounded-sm bg-hover bg-[linear-gradient(90deg,var(--hover)_0%,var(--active)_25%,var(--hover)_50%,var(--active)_75%,var(--hover)_100%)] bg-[length:200%_100%] motion-reduce:animate-none motion-reduce:bg-none'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
	return <div data-slot="skeleton" className={cn(skeletonShape, className)} {...props} />
}

function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
	return (
		<div className={cn('flex flex-col gap-2', className)}>
			{Array.from({ length: lines }, (_, index) => (
				<Skeleton key={index} className={cn('h-4', lines > 1 && index === lines - 1 ? 'w-3/5' : 'w-full')} />
			))}
		</div>
	)
}

function SkeletonAvatar({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
	return <Skeleton className={cn('shrink-0 rounded-full', size === 'lg' ? 'size-14' : 'size-7')} />
}

function SkeletonLine({ box = 'h-5', className }: { box?: string; className?: string }) {
	return (
		<div className={cn('flex items-center', box)}>
			<Skeleton className={cn('h-3', className)} />
		</div>
	)
}

function SkeletonCount({ className }: { className?: string }) {
	return <span aria-hidden className={cn(skeletonShape, 'inline-block h-2.5 w-3.5 align-middle', className)} />
}

interface SkeletonTableColumn {
	title: ReactNode
	cell: ReactNode
	cellClassName?: string
}

function SkeletonTable({ columns, rows = 5 }: { columns: SkeletonTableColumn[]; rows?: number }) {
	return (
		<Elevated offset={1} shadowLevel={2} className="w-0 min-w-full overflow-hidden rounded-2xl">
			<Table className="text-body">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						{columns.map((column, index) => (
							<TableHead key={index} className="px-4 text-body font-normal text-muted-foreground">
								{column.title}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: rows }, (_, row) => (
						<TableRow key={row} className="hover:bg-transparent">
							{columns.map((column, index) => (
								<TableCell key={index} className={cn('px-4 py-2', column.cellClassName)}>
									{column.cell}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Elevated>
	)
}

function SkeletonStat() {
	return (
		<Elevated offset={1} shadowLevel={1} className="flex min-w-0 flex-col gap-1 rounded-2xl p-4">
			<SkeletonLine box="h-(--lh-caption)" className="h-2.5 w-3/5" />
			<SkeletonLine box="h-(--lh-display)" className="h-6 w-2/5" />
			<SkeletonLine box="h-(--lh-caption)" className="h-2.5 w-[70%]" />
		</Elevated>
	)
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonLine, SkeletonCount, SkeletonTable, SkeletonStat }
export type { SkeletonTableColumn }
