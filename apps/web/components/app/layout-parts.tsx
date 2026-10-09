import type { ReactNode } from 'react'

import { WorkspaceTile } from '@/components/sidebar-app/workspace-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Elevated } from '@/lib/elevated'

export function CenteredPanel({ children }: { children: ReactNode }) {
	return (
		<main className="grid min-h-svh place-items-center bg-surface-1 px-4 py-8">
			<Elevated offset={1} shadowLevel={2} className="w-full max-w-sm rounded-2xl p-6">
				<div className="flex flex-col gap-6">
					<div className="flex items-center gap-2">
						<WorkspaceTile>D</WorkspaceTile>
						<span className="text-title font-semibold text-foreground">dv-lab</span>
					</div>
					{children}
				</div>
			</Elevated>
		</main>
	)
}

export function PageScroll({ children }: { children: ReactNode }) {
	return (
		<ScrollArea className="min-h-0 flex-1">
			<div className="mx-auto flex w-full flex-col gap-4 px-4 pt-4 pb-16 min-[1920px]:max-w-384 md:gap-6 md:px-8 md:pt-6">
				{children}
			</div>
		</ScrollArea>
	)
}

interface PageHeaderProps {
	title: ReactNode
	description?: ReactNode
	actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div className="flex min-w-0 flex-col gap-1">
				<h1 className="text-display font-semibold tracking-tight text-foreground">{title}</h1>
				{description ? <p className="text-body text-muted-foreground">{description}</p> : null}
			</div>
			{actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
		</header>
	)
}
