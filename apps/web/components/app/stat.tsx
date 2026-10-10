import type { ReactNode } from 'react'

import { Elevated } from '@/lib/elevated'
import { cn } from '@/lib/utils'

interface StatProps {
	label: string
	value: ReactNode
	hint?: ReactNode
	size?: 'display' | 'title'
	className?: string
}

export function Stat({ label, value, hint, size = 'display', className }: StatProps) {
	return (
		<Elevated
			offset={1}
			shadowLevel={1}
			data-slot="stat"
			className={cn('flex min-w-0 flex-col gap-1 rounded-2xl p-4', className)}
		>
			<span data-slot="stat-label" className="truncate text-caption text-muted-foreground">
				{label}
			</span>
			<span
				data-slot="stat-value"
				className={cn(
					'truncate font-semibold tracking-tight text-foreground tabular-nums',
					size === 'display' ? 'text-display' : 'text-title'
				)}
			>
				{value}
			</span>
			{hint ? (
				<span data-slot="stat-hint" className="truncate text-caption text-muted-foreground">
					{hint}
				</span>
			) : null}
		</Elevated>
	)
}
