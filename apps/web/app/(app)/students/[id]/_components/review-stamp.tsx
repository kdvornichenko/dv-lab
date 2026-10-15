'use client'

import { useEffect } from 'react'

import { CircleCheck, Info, LoaderCircle } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { formatDay, formatTime } from '@/lib/schedule-format'
import { zoneLabel } from '@/lib/time-zones'

import { zonedParts } from '@dv-lab/core'

const DAY_MS = 86400000

const POLL_MS = 4000

function dayIndex(date: string): number {
	return Date.parse(`${date}T00:00:00Z`) / DAY_MS
}

export function reviewAge(reviewed: Date, now: Date, zone: string): string {
	const days = Math.max(0, Math.round(dayIndex(zonedParts(now, zone).date) - dayIndex(zonedParts(reviewed, zone).date)))
	if (days === 0) return 'today'
	if (days === 1) return 'yesterday'
	if (days < 30) return `${days} days ago`
	const months = Math.floor(days / 30)
	return months === 1 ? '1 month ago' : `${months} months ago`
}

export function ReviewStampLoading() {
	return <Skeleton className="h-4 w-40" data-slot="review-stamp-loading" />
}

interface ReviewStampProps {
	studentId: string
	reviewedAt: string | null
	reviewRunning: { conversationId: string } | null
	timeZone: string
	now: Date
	onPoll: () => void
}

function Status({
	reviewedAt,
	running,
	timeZone,
	now,
}: { reviewedAt: string | null; running: boolean } & Pick<ReviewStampProps, 'timeZone' | 'now'>) {
	if (running) {
		return (
			<span
				role="status"
				data-slot="review-stamp"
				data-state="running"
				className="inline-flex items-center gap-1.5 text-body text-foreground"
			>
				<LoaderCircle
					aria-hidden
					size={16}
					strokeWidth={1.5}
					className="shrink-0 animate-spin motion-reduce:animate-none"
				/>
				Review in progress
			</span>
		)
	}
	if (reviewedAt === null) {
		return (
			<span
				data-slot="review-stamp"
				data-state="never"
				className="inline-flex items-center gap-1.5 text-body text-muted-foreground"
			>
				<Info aria-hidden size={16} strokeWidth={1.5} className="shrink-0" />
				Never reviewed
			</span>
		)
	}
	const at = new Date(reviewedAt)
	const exact = `Last review: ${formatDay(at, timeZone, 0)}, ${formatTime(at, timeZone)} ${zoneLabel(timeZone, at)}`
	return (
		<Tooltip content={exact}>
			<span
				tabIndex={0}
				data-slot="review-stamp"
				data-state="reviewed"
				className="inline-flex items-center gap-1.5 rounded-sm text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
			>
				<CircleCheck aria-hidden size={16} strokeWidth={1.5} className="shrink-0 text-success" />
				Reviewed {reviewAge(at, now, timeZone)}
			</span>
		</Tooltip>
	)
}

export function ReviewStamp({ studentId, reviewedAt, reviewRunning, timeZone, now, onPoll }: ReviewStampProps) {
	const running = reviewRunning !== null

	useEffect(() => {
		if (!running) return
		const timer = window.setInterval(onPoll, POLL_MS)
		return () => window.clearInterval(timer)
	}, [running, onPoll])

	return (
		<div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-slot="review-row">
			<Status reviewedAt={reviewedAt} running={running} timeZone={timeZone} now={now} />
			{reviewRunning === null ? (
				<Button
					variant="secondary"
					size="compact"
					data-slot="review-now"
					nativeButton={false}
					render={<Link href={`/chat?new=1&student=${studentId}&review=1`} />}
				>
					Review now
				</Button>
			) : (
				<Button
					variant="secondary"
					size="compact"
					data-slot="review-open-chat"
					nativeButton={false}
					render={<Link href={`/chat?c=${reviewRunning.conversationId}`} />}
				>
					Open chat
				</Button>
			)}
		</div>
	)
}
