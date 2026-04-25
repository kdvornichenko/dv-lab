import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

export type TaskStatusChipViewModel = {
	label: string
	badgeStyle?: CSSProperties
}

type TaskStatusChipProps = {
	className?: string
} & (
	| {
			status: TaskStatusChipViewModel
			view?: never
	  }
	| {
			view: TaskStatusChipViewModel
			status?: never
	  }
)

export function TaskStatusChip(props: TaskStatusChipProps) {
	const resolvedStatus = props.status ?? props.view
	if (!resolvedStatus) return null

	const { className } = props

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-2 py-0.5 text-[11px] font-medium',
				className
			)}
			style={resolvedStatus.badgeStyle}
		>
			<span>{resolvedStatus.label}</span>
		</span>
	)
}
