import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type StatusDotStatus = 'active' | 'archived' | 'deactivated'

const labels: Record<StatusDotStatus, string> = {
	active: 'Active',
	archived: 'Archived',
	deactivated: 'Deactivated',
}

export function StatusDot({ status }: { status: StatusDotStatus }) {
	const label = labels[status]
	return (
		<Tooltip content={label}>
			<span
				role="img"
				aria-label={label}
				className={cn(
					"relative inline-block size-2 rounded-full before:absolute before:-inset-2 before:content-['']",
					status === 'active' ? 'bg-success' : 'bg-muted-foreground'
				)}
			/>
		</Tooltip>
	)
}
