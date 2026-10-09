import { Elevated } from '@/lib/elevated'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="skeleton"
			className={cn(
				'animate-[shimmer_1.6s_linear_infinite] rounded-sm bg-hover bg-[linear-gradient(90deg,var(--hover)_0%,var(--active)_25%,var(--hover)_50%,var(--active)_75%,var(--hover)_100%)] bg-[length:200%_100%] motion-reduce:animate-none motion-reduce:bg-none',
				className
			)}
			{...props}
		/>
	)
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

function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
	return (
		<Elevated offset={1} shadowLevel={2} className={cn('overflow-hidden rounded-2xl', className)}>
			<div className="flex flex-col gap-1 p-2">
				{Array.from({ length: rows }, (_, index) => (
					<Skeleton key={index} className="h-9 w-full" />
				))}
			</div>
		</Elevated>
	)
}

function SkeletonStat() {
	return (
		<Elevated offset={1} shadowLevel={1} className="flex min-w-0 flex-col gap-1 rounded-2xl p-4">
			<Skeleton className="h-4 w-16" />
			<Skeleton className="h-6 w-24" />
		</Elevated>
	)
}

function SkeletonProfileHeader() {
	return (
		<div className="flex items-center gap-4">
			<SkeletonAvatar size="lg" />
			<SkeletonText lines={2} className="w-full max-w-xs" />
		</div>
	)
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonTable, SkeletonStat, SkeletonProfileHeader }
