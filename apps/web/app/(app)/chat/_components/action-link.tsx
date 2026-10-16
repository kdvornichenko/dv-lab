'use client'

import {
	ArrowRight,
	BookOpen,
	CalendarDays,
	SlidersHorizontal,
	StickyNote,
	Users,
	Wallet,
	type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'

import { useMainTimeZone } from '@/lib/main-time-zone'
import { dayMonthShort, formatDate, yearInZone } from '@/lib/schedule-format'
import { actionLinkHref } from '@/lib/schedule-links'
import { surfaceClasses } from '@/lib/surface-classes'
import { useSurface } from '@/lib/surface-context'
import { cn } from '@/lib/utils'

import type { ChatActionLinkBlock } from '@dv-lab/contracts'
import { mondayOf } from '@dv-lab/core'

const SETTINGS_PART = { general: 'General', calendar: 'Calendar', assistant: 'Assistant' } as const

const ICONS = {
	payments: Wallet,
	notes: StickyNote,
	overview: Users,
	vocabulary: BookOpen,
	schedule_day: CalendarDays,
	settings: SlidersHorizontal,
} satisfies Record<ChatActionLinkBlock['kind'], LucideIcon>

function words(block: ChatActionLinkBlock, zone: string): { title: string; line: string } {
	const name = block.studentName ?? ''
	const possessive = `${name}'s`
	switch (block.kind) {
		case 'payments':
			return {
				title: `Open ${possessive} payments`,
				line: block.dialog === 'payment' ? 'Payments · Record payment' : `Payments · ${name}`,
			}
		case 'notes':
			return { title: `Open ${possessive} notes`, line: `Notes · ${name}` }
		case 'overview':
			return {
				title: `Open ${possessive} profile`,
				line: block.dialog === 'details' ? 'Overview · Edit details' : `Overview · ${name}`,
			}
		case 'vocabulary':
			return { title: `Open ${possessive} vocabulary`, line: `Vocabulary · ${name}` }
		case 'schedule_day': {
			const date = block.date ?? ''
			const year = yearInZone(new Date(), zone)
			return {
				title: `Open ${formatDate(date, year)} in the Schedule`,
				line: `Schedule · Week of ${dayMonthShort(mondayOf(date))}`,
			}
		}
		case 'settings':
			return {
				title: 'Open Settings',
				line: block.tab === null ? 'Settings' : `Settings · ${SETTINGS_PART[block.tab]}`,
			}
	}
}

export function ActionLink({ block }: { block: ChatActionLinkBlock }) {
	const level = useSurface() + 1
	const zone = useMainTimeZone()
	const href = actionLinkHref(block)
	if (href === null) return null
	const { title, line } = words(block, zone)
	const Icon = ICONS[block.kind]
	return (
		<Link
			href={href}
			data-slot="chat-action-link"
			data-kind={block.kind}
			className={cn(
				'group/action relative flex min-h-14 min-w-0 items-center gap-3 rounded-2xl px-4 py-3 outline-none',
				surfaceClasses(level, 2),
				'before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-foreground before:opacity-0 before:transition-opacity before:duration-80',
				'hover:before:opacity-5 active:before:opacity-[0.09]',
				'focus-visible:ring-2 focus-visible:ring-focus-ring'
			)}
		>
			<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-active text-foreground">
				<Icon size={16} aria-hidden />
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="line-clamp-2 text-body font-semibold wrap-anywhere text-foreground">{title}</span>
				<span className="truncate text-caption text-muted-foreground">{line}</span>
			</span>
			<ArrowRight
				size={16}
				aria-hidden
				className="shrink-0 text-muted-foreground transition-colors duration-80 group-hover/action:text-foreground"
			/>
		</Link>
	)
}
