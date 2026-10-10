import type { ComponentProps } from 'react'

import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type StatusTone = 'red' | 'amber' | 'blue' | 'green' | 'gray'

type StudentStatus = 'active' | 'archived' | 'deactivated'

const TONE_CLASS: Record<StatusTone, string> = {
	red: 'bg-destructive',
	amber: 'bg-warning',
	blue: 'bg-info',
	green: 'bg-success',
	gray: 'bg-muted-foreground',
}

const STUDENT: Record<StudentStatus, { tone: StatusTone; label: string }> = {
	active: { tone: 'green', label: 'Active' },
	archived: { tone: 'gray', label: 'Archived' },
	deactivated: { tone: 'gray', label: 'Deactivated' },
}

export function DotShape({ tone, className, ...rest }: { tone: StatusTone } & ComponentProps<'i'>) {
	return (
		<i {...rest} aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', TONE_CLASS[tone], className)} />
	)
}

type StatusDotProps = { status: StudentStatus } | { tone: StatusTone; label: string; passive?: boolean }

export function StatusDot(props: StatusDotProps) {
	const { tone, label } = 'status' in props ? STUDENT[props.status] : props
	const passive = 'passive' in props && props.passive === true
	if (passive) {
		return (
			<span role="img" aria-label={label} className="inline-flex size-2 shrink-0">
				<DotShape tone={tone} />
			</span>
		)
	}
	return (
		<Tooltip content={label} delayDuration={0}>
			<span
				role="img"
				aria-label={label}
				tabIndex={0}
				className="-m-2 inline-flex size-6 shrink-0 cursor-default items-center justify-center rounded-full outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
			>
				<DotShape tone={tone} />
			</span>
		</Tooltip>
	)
}
