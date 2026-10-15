import type { ReactNode, Ref } from 'react'

import { PageActions } from '@/components/app/topbar-slot'
import { WorkspaceTile } from '@/components/sidebar-app/workspace-header'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Elevated } from '@/lib/elevated'
import { cn } from '@/lib/utils'

export function CenteredPanel({ children }: { children: ReactNode }) {
	return (
		<main className="grid min-h-svh place-items-center bg-surface-1 px-4 py-8">
			<Elevated offset={1} shadowLevel={2} className="w-full max-w-sm rounded-2xl p-unit-1.5">
				<div className="flex flex-col gap-unit-1.5">
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
		<ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade [&>div]:!min-w-0">
			<div className="mx-auto flex w-full flex-col gap-3 px-4 pt-3 pb-16 min-[1920px]:max-w-384 md:gap-4 md:px-6 md:pt-4 md:pb-8">
				{children}
			</div>
		</ScrollArea>
	)
}

export function WorkspacePage({ children }: { children: ReactNode }) {
	return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
}

interface PanelProps {
	title?: ReactNode
	description?: ReactNode
	action?: ReactNode
	children: ReactNode
	className?: string
	id?: string
}

export function Panel({ title, description, action, children, className, id }: PanelProps) {
	return (
		<Elevated offset={1} shadowLevel={2} className={cn('flex min-w-0 flex-col rounded-2xl', className)}>
			<section aria-labelledby={id && title ? id : undefined} className="flex min-w-0 flex-col">
				{title ? (
					<div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2 pointer-coarse:pb-3">
						<div className="flex min-w-0 flex-col gap-1">
							<h2 id={id} className="text-title font-semibold text-foreground">
								{title}
							</h2>
							{description ? <p className="text-caption text-muted-foreground">{description}</p> : null}
						</div>
						{action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
					</div>
				) : null}
				{children}
			</section>
		</Elevated>
	)
}

interface PageHeaderProps {
	title: ReactNode
	eyebrow?: ReactNode
	description?: ReactNode
	actions?: ReactNode
	aside?: ReactNode
	titleRef?: Ref<HTMLHeadingElement>
}

export function PageHeader({ title, eyebrow, description, actions, aside, titleRef }: PageHeaderProps) {
	const heading = (
		<h1
			ref={titleRef}
			tabIndex={titleRef === undefined ? undefined : -1}
			className={cn(
				'text-display font-semibold tracking-tight text-foreground outline-none',
				aside !== undefined && 'min-w-0 flex-1'
			)}
		>
			{title}
		</h1>
	)
	return (
		<header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
			<div className={cn('flex min-w-0 flex-col gap-1', aside !== undefined && 'flex-1')}>
				{eyebrow ? <p className="text-caption text-muted-foreground">{eyebrow}</p> : null}
				{aside !== undefined ? (
					<div className="flex min-w-0 items-center gap-2">
						{heading}
						{aside}
					</div>
				) : (
					heading
				)}
				{description ? <div className="text-body text-muted-foreground">{description}</div> : null}
			</div>
			{actions ? <PageActions>{actions}</PageActions> : null}
		</header>
	)
}
