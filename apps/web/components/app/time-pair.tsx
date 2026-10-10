import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface TimePairProps {
	main: ReactNode
	second: string | null
	as?: 'div' | 'span'
	className?: string
	mainClassName?: string
}

export function TimePair({ main, second, as: Tag = 'div', className, mainClassName }: TimePairProps) {
	return (
		<Tag data-slot="time-pair" className={cn('flex flex-col', className)}>
			<span data-slot="time-main" className={mainClassName}>
				{main}
			</span>
			{second === null ? null : (
				<span data-slot="time-second" className="text-micro text-muted-foreground tabular-nums">
					{second}
				</span>
			)}
		</Tag>
	)
}
