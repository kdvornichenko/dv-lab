'use client'

import type { ReactNode } from 'react'

import { ArrowUpRight, CalendarDays } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const TEXT_LINK_LOOK = cn(
	'rounded-sm underline decoration-1 underline-offset-[3px] outline-none',
	'decoration-[color-mix(in_oklab,currentColor_45%,transparent)] decoration-dotted',
	'transition-colors duration-120 hover:decoration-solid data-[popup-open]:decoration-solid',
	'hover:bg-[color-mix(in_oklab,currentColor_8%,transparent)] data-[popup-open]:bg-[color-mix(in_oklab,currentColor_8%,transparent)]',
	'active:bg-[color-mix(in_oklab,currentColor_14%,transparent)]',
	'focus-visible:ring-2 focus-visible:ring-focus-ring'
)

export function TextLink({
	href,
	children,
	className,
	title,
}: {
	href: string
	children: ReactNode
	className?: string
	title?: string
}) {
	return (
		<Link href={href} title={title} data-slot="agent-link" className={cn(TEXT_LINK_LOOK, className)}>
			{children}
		</Link>
	)
}

export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
	return (
		<Link href={href} data-slot="agent-source-link" className={cn('inline-flex items-center gap-0.5', TEXT_LINK_LOOK)}>
			{children}
			<ArrowUpRight aria-hidden size={12} className="shrink-0" />
		</Link>
	)
}

export function CalendarLink({ href }: { href: string | null }) {
	if (href === null) return null
	return (
		<Tooltip side="top" content="Open in calendar">
			<Button
				variant="ghost"
				size="icon-compact"
				aria-label="Open in calendar"
				data-slot="agent-calendar-link"
				className="shrink-0 pointer-coarse:size-9"
				nativeButton={false}
				render={<Link href={href} />}
			>
				<CalendarDays />
			</Button>
		</Tooltip>
	)
}
