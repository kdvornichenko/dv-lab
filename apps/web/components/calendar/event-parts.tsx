import { cn } from '@/lib/utils'

import type { CalendarEventBadge } from './types'

export function EventBadges({ badges }: { badges?: CalendarEventBadge[] }) {
	if (!badges?.length) return null

	return (
		<>
			{badges.map((badge) => (
				<span
					key={badge.label}
					className={cn(
						'rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]',
						badge.tone === 'success' && 'bg-success-soft text-success',
						badge.tone === 'danger' && 'bg-danger-soft text-danger',
						(!badge.tone || badge.tone === 'neutral') && 'bg-surface-muted text-ink-muted'
					)}
				>
					{badge.label}
				</span>
			))}
		</>
	)
}

export function AttendeeStack({ attendees }: { attendees?: string[] }) {
	if (!attendees?.length) return null

	return (
		<div className="flex shrink-0 items-center -space-x-1.5">
			{attendees.slice(0, 4).map((attendee) => (
				<span
					key={attendee}
					className="border-surface bg-surface-muted text-ink-muted grid size-6 place-items-center rounded-full border-2 font-mono text-[9px] font-semibold"
				>
					{attendee}
				</span>
			))}
			{attendees.length > 4 && (
				<span className="border-surface bg-surface-muted text-ink-muted grid size-6 place-items-center rounded-full border-2 font-mono text-[9px] font-semibold">
					+{attendees.length - 4}
				</span>
			)}
		</div>
	)
}
