'use client'

import { useEffect, useRef } from 'react'

import { motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, RefreshCw, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Elevated } from '@/lib/elevated'
import { spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

export type PopupItem =
	| { kind: 'student'; id: string; name: string; detail: string | null }
	| { kind: 'command'; id: string; name: string; detail: string }

export type PopupState = 'loading' | 'error' | 'ready'

export function popupOptionId(listId: string, index: number): string {
	return `${listId}-option-${index}`
}

function initials(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((word) => Array.from(word)[0])
		.join('')
		.toUpperCase()
}

function keepFocus(event: React.MouseEvent) {
	event.preventDefault()
}

function StudentRow({ item }: { item: Extract<PopupItem, { kind: 'student' }> }) {
	return (
		<>
			<span
				aria-hidden
				className="flex size-6 shrink-0 items-center justify-center rounded-full bg-active text-micro font-semibold text-foreground"
			>
				{initials(item.name)}
			</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-body text-foreground">{item.name}</span>
				{item.detail ? <span className="truncate text-micro text-muted-foreground">{item.detail}</span> : null}
			</span>
		</>
	)
}

function CommandRow({ item }: { item: Extract<PopupItem, { kind: 'command' }> }) {
	return (
		<>
			<span className="w-24 shrink-0 text-body font-medium text-foreground">{item.name}</span>
			<span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">{item.detail}</span>
		</>
	)
}

function LoadingRows() {
	return (
		<div role="status" aria-label="Loading students" className="flex flex-col gap-2.5 px-3 py-2">
			{[120, 90, 140].map((width) => (
				<div key={width} className="flex items-center gap-2.5">
					<Skeleton className="size-6 rounded-full" />
					<Skeleton className="h-3" style={{ width }} />
				</div>
			))}
		</div>
	)
}

export function MentionPopup({
	listId,
	label,
	state,
	items,
	activeIndex,
	onChoose,
	onRetry,
}: {
	listId: string
	label: string
	state: PopupState
	items: readonly PopupItem[]
	activeIndex: number
	onChoose: (index: number) => void
	onRetry: () => void
}) {
	const scroller = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const row = scroller.current?.querySelector<HTMLElement>(`#${CSS.escape(popupOptionId(listId, activeIndex))}`)
		row?.scrollIntoView({ block: 'nearest' })
	}, [activeIndex, listId])

	const reduceMotion = useReducedMotion() ?? false

	return (
		<motion.div
			className="absolute bottom-full left-0 z-20 mb-2 w-80 max-w-full"
			initial={reduceMotion ? false : { opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, transition: { duration: spring.fast.exit.duration } }}
			transition={{ type: 'spring', duration: spring.fast.duration, bounce: 0 }}
			onMouseDown={keepFocus}
		>
			<Elevated offset={3} shadowLevel={4} data-slot="mention-popup" className="flex flex-col rounded-xl p-1">
				{state === 'loading' ? <LoadingRows /> : null}
				{state === 'error' ? (
					<div role="alert" className="flex items-center gap-2 px-3 py-2.5">
						<AlertCircle aria-hidden className="size-3.5 shrink-0 text-destructive" />
						<p className="min-w-0 flex-1 text-body text-foreground">Could not load students. Try again.</p>
						<Button variant="ghost" size="compact" leadingIcon={RefreshCw} onClick={onRetry}>
							Try again
						</Button>
					</div>
				) : null}
				{state === 'ready' && items.length === 0 ? (
					<div role="status" className="flex items-start gap-2 px-3 py-2.5">
						<Users aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
						<div className="flex min-w-0 flex-col">
							<p className="text-body font-semibold text-foreground">No students found</p>
							<p className="text-micro text-muted-foreground">Try a student name.</p>
						</div>
					</div>
				) : null}
				{state === 'ready' && items.length > 0 ? (
					<div
						ref={scroller}
						id={listId}
						role="listbox"
						aria-label={label}
						className="scroll-fade flex max-h-60 scroll-py-6 flex-col overflow-y-auto overscroll-contain [--scroll-fade-size:var(--scroll-fade-size-compact)]"
					>
						{items.map((item, index) => (
							<div
								key={item.id}
								id={popupOptionId(listId, index)}
								role="option"
								aria-selected={index === activeIndex}
								data-active={index === activeIndex ? '' : undefined}
								className={cn(
									'flex min-h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-md px-3 py-1.5 pointer-coarse:min-h-11',
									index === activeIndex ? 'bg-hover' : 'hover:bg-hover'
								)}
								onClick={() => onChoose(index)}
							>
								{item.kind === 'student' ? <StudentRow item={item} /> : <CommandRow item={item} />}
							</div>
						))}
					</div>
				) : null}
			</Elevated>
		</motion.div>
	)
}
