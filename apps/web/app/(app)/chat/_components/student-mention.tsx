'use client'

import { PreviewCard } from '@base-ui/react/preview-card'

import { Children, useEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react'

import { ArrowRight, CircleAlert } from 'lucide-react'
import Link from 'next/link'

import { Avatar } from '@/components/app/avatar'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Elevated } from '@/lib/elevated'
import { formatWhen, yearInZone } from '@/lib/schedule-format'
import { cachedStudentRecords, readStudentRecords, type StudentRecords } from '@/lib/student-records'
import { zoneLabel } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import { TEXT_LINK_LOOK } from './agent-links'
import { BalanceFact, Fact, NextLessonFact } from './student-facts'

const OPEN_DELAY = 300
const CLOSE_DELAY = 150
const QUICK_MS = 200
const TOUCH_QUERY = '(hover: none)'

let recentlyClosed = false
let recentTimer: number | null = null
const recentListeners = new Set<() => void>()

function markClosed() {
	recentlyClosed = true
	for (const listener of recentListeners) listener()
	if (recentTimer !== null) window.clearTimeout(recentTimer)
	recentTimer = window.setTimeout(() => {
		recentTimer = null
		recentlyClosed = false
		for (const listener of recentListeners) listener()
	}, QUICK_MS)
}

function subscribeRecent(listener: () => void) {
	recentListeners.add(listener)
	return () => {
		recentListeners.delete(listener)
	}
}

function subscribeTouch(listener: () => void) {
	const query = window.matchMedia(TOUCH_QUERY)
	query.addEventListener('change', listener)
	return () => query.removeEventListener('change', listener)
}

function useTouch(): boolean {
	return useSyncExternalStore(
		subscribeTouch,
		() => window.matchMedia(TOUCH_QUERY).matches,
		() => false
	)
}

function labelOf(children: ReactNode): string {
	return Children.toArray(children)
		.filter((child): child is string => typeof child === 'string')
		.join('')
		.replace(/^@/, '')
}

type CardState = StudentRecords | { kind: 'loading' }

function CardFacts({ state, onRefresh, refreshing }: { state: CardState; onRefresh: () => void; refreshing: boolean }) {
	if (state.kind === 'loading') {
		return (
			<div role="status" aria-label="Reading the student's records" className="flex flex-col gap-3">
				<Fact label="Balance">
					<Skeleton className="h-5 w-28" />
				</Fact>
				<Fact label="Next lesson">
					<Skeleton className="h-5 w-36" />
				</Fact>
			</div>
		)
	}
	if (state.kind === 'missing') {
		return <p className="text-body text-muted-foreground">This student is no longer available.</p>
	}
	if (state.kind === 'error') {
		return (
			<div role="alert" className="flex flex-col gap-2">
				<p className="flex items-start gap-2 text-body text-foreground">
					<CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0 text-destructive" />
					<span className="min-w-0 flex-1">Could not read the student&apos;s records.</span>
				</p>
				<Button
					variant="secondary"
					size="compact"
					className="self-start"
					disabled={refreshing}
					aria-busy={refreshing}
					onClick={onRefresh}
				>
					{refreshing ? 'Refreshing…' : 'Refresh records'}
				</Button>
			</div>
		)
	}
	return <ReadyFacts facts={state.facts} />
}

function ReadyFacts({ facts }: { facts: Extract<StudentRecords, { kind: 'ready' }>['facts'] }) {
	const [secondZone] = useSecondZone(facts.defaultTimeZone)
	return (
		<div className="flex flex-col gap-3 tabular-nums">
			<BalanceFact facts={facts} />
			<NextLessonFact facts={facts} secondZone={secondZone} />
		</div>
	)
}

function MentionCard({ studentId, label, touch }: { studentId: string; label: string; touch: boolean }) {
	const [state, setState] = useState<CardState>(() => cachedStudentRecords(studentId) ?? { kind: 'loading' })
	const [refreshing, setRefreshing] = useState(false)
	const card = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (state.kind !== 'loading') return
		let live = true
		void readStudentRecords(studentId).then((next) => {
			if (live) setState(next)
		})
		return () => {
			live = false
		}
	}, [state.kind, studentId])

	useEffect(() => {
		if (touch) card.current?.querySelector<HTMLElement>('a[data-profile]')?.focus()
	}, [touch])

	async function refresh() {
		setRefreshing(true)
		const next = await readStudentRecords(studentId)
		setState(next)
		setRefreshing(false)
	}

	const facts = state.kind === 'ready' ? state.facts : null
	const name = facts?.student.displayName ?? label
	const checked = facts === null ? null : new Date(facts.asOf)
	return (
		<div ref={card} className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<span className="flex shrink-0 [&>span]:size-6 [&>span]:text-micro">
					<Avatar name={name} />
				</span>
				<div className="flex min-w-0 flex-1 flex-col">
					<p className="truncate text-body font-semibold text-foreground">{name}</p>
					{facts !== null && checked !== null ? (
						<p className="text-caption text-muted-foreground tabular-nums">
							Checked {formatWhen(checked, facts.defaultTimeZone, yearInZone(checked, facts.defaultTimeZone))}{' '}
							{zoneLabel(facts.defaultTimeZone, checked)}
						</p>
					) : null}
				</div>
			</div>
			<CardFacts state={state} onRefresh={() => void refresh()} refreshing={refreshing} />
			{state.kind === 'missing' ? null : (
				<Button
					data-profile=""
					variant="secondary"
					size="compact"
					trailingIcon={ArrowRight}
					className="w-full"
					nativeButton={false}
					render={<Link href={`/students/${studentId}`} />}
				>
					Open profile
				</Button>
			)}
		</div>
	)
}

export function StudentMention({ studentId, children }: { studentId: string; children: ReactNode }) {
	const [open, setOpen] = useState(false)
	const touch = useTouch()
	const quick = useSyncExternalStore(
		subscribeRecent,
		() => recentlyClosed,
		() => false
	)
	const label = labelOf(children)

	function change(next: boolean) {
		if (next) {
			if (!touch) setOpen(true)
			return
		}
		setOpen(false)
		markClosed()
	}

	function click(event: MouseEvent<HTMLAnchorElement>) {
		if (!touch) {
			setOpen(false)
			return
		}
		event.preventDefault()
		setOpen((value) => !value)
	}

	return (
		<PreviewCard.Root open={open} onOpenChange={change}>
			<PreviewCard.Trigger
				delay={quick ? 0 : OPEN_DELAY}
				closeDelay={CLOSE_DELAY}
				render={<Link href={`/students/${studentId}`} />}
				data-slot="student-mention"
				className={cn('font-semibold', TEXT_LINK_LOOK)}
				onClick={click}
			>
				{children}
			</PreviewCard.Trigger>
			<PreviewCard.Portal>
				<PreviewCard.Positioner side="bottom" align="start" sideOffset={8} className="isolate z-50">
					<PreviewCard.Popup
						role="dialog"
						aria-label={`Facts: ${label}`}
						render={<Elevated offset={2} shadowLevel={4} />}
						className="data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.97] data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.97] motion-reduce:data-closed:zoom-out-100 motion-reduce:data-open:zoom-in-100 z-50 w-[min(288px,calc(100vw-24px))] origin-(--transform-origin) rounded-xl p-3 text-popover-foreground outline-hidden duration-120 data-closed:duration-100"
					>
						<MentionCard studentId={studentId} label={label} touch={touch} />
					</PreviewCard.Popup>
				</PreviewCard.Positioner>
			</PreviewCard.Portal>
		</PreviewCard.Root>
	)
}
