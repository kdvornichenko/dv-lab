'use client'

import { useLayoutEffect, useState, type ComponentProps, type RefObject } from 'react'

import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export type StatusTone = 'red' | 'amber' | 'blue' | 'green' | 'gray' | 'amber-ringed' | 'hollow'

export type AttentionKind = 'pays_soon' | 'none_left' | 'owes'

export type AttentionMode = 'loop' | 'pulse'

type StudentStatus = 'active' | 'archived' | 'deactivated'

const TONE_CLASS: Record<StatusTone, string> = {
	red: 'bg-destructive',
	amber: 'bg-warning',
	blue: 'bg-info',
	green: 'bg-success',
	gray: 'bg-muted-foreground',
	'amber-ringed': 'bg-warning shadow-[0_0_0_3px_color-mix(in_srgb,var(--warning)_35%,transparent)]',
	hollow: 'bg-transparent shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]',
}

const STUDENT: Record<StudentStatus, { tone: StatusTone; label: string }> = {
	active: { tone: 'green', label: 'Active' },
	archived: { tone: 'gray', label: 'Archived' },
	deactivated: { tone: 'gray', label: 'Deactivated' },
}

export function DotShape({ tone, className, ...rest }: { tone: StatusTone } & ComponentProps<'i'>) {
	return (
		<i {...rest} aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', TONE_CLASS[tone], className)} />
	)
}

const loopStarts = new Map<string, number>()
const LOOP_DELAY_MS = 300

export function useAttentionClock(container: RefObject<HTMLElement | null>) {
	useLayoutEffect(() => {
		const root = container.current
		if (root === null) return
		const base = Number(document.timeline.currentTime) + LOOP_DELAY_MS
		for (const animation of root.getAnimations({ subtree: true })) {
			const target =
				animation instanceof CSSAnimation && animation.effect instanceof KeyframeEffect ? animation.effect.target : null
			if (!(target instanceof HTMLElement) || target.dataset.attentionMode !== 'loop') continue
			const key = `${target.dataset.attentionId ?? ''}:${target.dataset.attention ?? ''}`
			let start = loopStarts.get(key)
			if (start === undefined) {
				start = base
				loopStarts.set(key, start)
			}
			animation.startTime = start
		}
	})
}

function AttentionRing({ kind, mode, id }: { kind: AttentionKind; mode: AttentionMode; id?: string }) {
	const [done, setDone] = useState(false)
	if (done) return null
	return (
		<i
			aria-hidden
			data-attention={kind}
			data-attention-mode={mode}
			data-attention-id={id}
			onAnimationEnd={mode === 'pulse' ? () => setDone(true) : undefined}
			className="pointer-events-none absolute top-1/2 left-1/2 -z-10 -mt-1 -ml-1 size-2 rounded-full"
		/>
	)
}

export interface Attention {
	kind: AttentionKind
	mode: AttentionMode
	id?: string
}

type StatusDotProps =
	| { status: StudentStatus }
	| { tone: StatusTone; label: string; hint?: string; passive?: boolean; attention?: Attention }

export function StatusDot(props: StatusDotProps) {
	const { tone, label } = 'status' in props ? STUDENT[props.status] : props
	const passive = 'passive' in props && props.passive === true
	const hint = 'hint' in props && props.hint !== undefined ? props.hint : label
	const attention = 'attention' in props ? props.attention : undefined
	if (passive) {
		return (
			<span role="img" aria-label={label} className="inline-flex size-2 shrink-0">
				<DotShape tone={tone} />
			</span>
		)
	}
	return (
		<Tooltip content={hint} delayDuration={0}>
			<span
				role="img"
				aria-label={label}
				tabIndex={0}
				className="relative isolate -m-2 inline-flex size-6 shrink-0 cursor-default items-center justify-center rounded-full outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring"
			>
				<DotShape tone={tone} />
				{attention ? (
					<AttentionRing key={attention.kind} kind={attention.kind} mode={attention.mode} id={attention.id} />
				) : null}
			</span>
		</Tooltip>
	)
}
