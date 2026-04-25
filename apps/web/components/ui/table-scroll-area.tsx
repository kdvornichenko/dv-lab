import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { ScrollArea, ScrollBar } from './scroll-area'
import { Skeleton } from './skeleton'
import { Table, TableBody, TableCell, TableRow } from './table'

type Props = {
	children: ReactNode
	className?: string
	loading?: boolean
	skeletonRows?: number
	skeletonCols?: number
	layout?: 'content' | 'sidebar'
}

export function TableScrollArea({
	children,
	className,
	loading,
	skeletonRows = 5,
	skeletonCols = 4,
	layout = 'content',
}: Props) {
	const viewportClassName =
		layout === 'sidebar'
			? 'w-[calc(100vw-var(--sidebar-width-current)-var(--spacing-unit)*2)] tab:w-[calc(100vw-var(--sidebar-width-current)-var(--spacing-unit)*2)]'
			: 'w-full'

	return (
		<ScrollArea className={viewportClassName}>
			<div className={cn('min-w-6xl', className)}>
				{loading ? (
					<div className="w-full overflow-hidden rounded-lg border">
						<Table>
							<TableBody>
								{Array.from({ length: skeletonRows }).map((_, i) => (
									<TableRow key={`sk-${i}`} className="h-14">
										{Array.from({ length: skeletonCols }).map((_, j) => (
											<TableCell key={`sk-${i}-${j}`}>
												<Skeleton className="h-4 w-[70%]" />
											</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				) : (
					children
				)}
			</div>
			<ScrollBar orientation="horizontal" className="z-10" />
		</ScrollArea>
	)
}
