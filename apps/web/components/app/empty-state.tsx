import type { ReactNode } from 'react'

import type { IconComponent } from '@/lib/icon-context'

interface EmptyStateProps {
	icon: IconComponent
	title: string
	description?: string
	action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
	return (
		<div data-slot="empty-state" className="flex flex-col items-center gap-3 px-4 py-12 text-center">
			<span className="flex size-10 items-center justify-center rounded-full bg-hover text-muted-foreground">
				<Icon size={20} strokeWidth={1.5} />
			</span>
			<div className="flex flex-col gap-1">
				<p className="text-body font-semibold text-foreground">{title}</p>
				{description ? <p className="max-w-96 text-body text-muted-foreground">{description}</p> : null}
			</div>
			{action}
		</div>
	)
}
