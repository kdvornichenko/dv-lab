'use client'

import { Slider } from '@base-ui/react/slider'

import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { CHAT_EFFORTS, type ChatEffort } from '@dv-lab/contracts'

export const EFFORT_LABEL: Record<ChatEffort, string> = {
	low: 'Low',
	medium: 'Medium',
	high: 'High',
	xhigh: 'Extra high',
	max: 'Max',
}

const LAST = CHAT_EFFORTS.length - 1
const THUMB = 16

const rank = (level: ChatEffort) => CHAT_EFFORTS.indexOf(level)

export function clampEffort(supported: readonly ChatEffort[], wanted: ChatEffort): ChatEffort {
	const sorted = [...supported].sort((left, right) => rank(left) - rank(right))
	let chosen: ChatEffort | undefined
	for (const level of sorted) if (rank(level) <= rank(wanted)) chosen = level
	return chosen ?? sorted[0] ?? wanted
}

export function highestEffort(supported: readonly ChatEffort[]): ChatEffort {
	return [...supported].sort((left, right) => rank(left) - rank(right)).at(-1) ?? 'medium'
}

export function EffortMeter({ level, className }: { level: ChatEffort; className?: string }) {
	const filled = rank(level)
	return (
		<svg width="14" height="14" viewBox="0 0 16 14" aria-hidden className={cn('shrink-0', className)}>
			{CHAT_EFFORTS.map((name, index) => (
				<rect
					key={name}
					x={1 + index * 3}
					y={11 - index * 2}
					width="2"
					height={2 + index * 2}
					rx="1"
					fill="currentColor"
					opacity={index <= filled ? 1 : 0.3}
				/>
			))}
		</svg>
	)
}

const position = (index: number) => `calc(${THUMB / 2}px + ${index} * (100% - ${THUMB}px) / ${LAST})`

export function EffortSlider({
	value,
	supported,
	modelName,
	marker,
	markerAt,
	disabled = false,
	label,
	onChange,
}: {
	value: ChatEffort
	supported: readonly ChatEffort[]
	modelName: string
	marker: string | null
	markerAt: ChatEffort | null
	disabled?: boolean
	label: string
	onChange: (level: ChatEffort) => void
}) {
	const index = rank(value)
	const reachable = CHAT_EFFORTS.map((level, at) => (supported.includes(level) ? at : -1)).filter((at) => at >= 0)
	const markerIndex = markerAt === null ? null : rank(markerAt)

	function move(next: number) {
		if (next === index) return
		let chosen = reachable[0]
		let distance = Number.POSITIVE_INFINITY
		for (const at of reachable) {
			const gap = Math.abs(at - next)
			if (gap < distance) {
				distance = gap
				chosen = at
			}
		}
		const level = chosen === undefined ? undefined : CHAT_EFFORTS[chosen]
		if (level !== undefined && level !== value) onChange(level)
	}

	return (
		<div className="flex w-full flex-col" data-slot="effort-slider">
			<div className="relative mb-1 h-3.5" aria-hidden={marker === null}>
				{marker !== null && markerIndex !== null ? (
					<span
						className={cn(
							'absolute top-0 text-micro whitespace-nowrap text-muted-foreground',
							markerIndex === 0 ? '' : markerIndex === LAST ? '-translate-x-full' : '-translate-x-1/2'
						)}
						style={{ left: markerIndex === 0 ? 0 : position(markerIndex) }}
						data-slot="effort-marker"
					>
						{marker}
					</span>
				) : null}
			</div>
			<Slider.Root
				value={index}
				min={0}
				max={LAST}
				step={1}
				thumbAlignment="edge"
				disabled={disabled}
				onValueChange={(next) => move(next)}
				className="w-full"
			>
				<Slider.Control className="relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50">
					<Slider.Track className="relative h-1 w-full rounded-sm bg-selected">
						<Slider.Indicator className="rounded-sm bg-primary" />
						{CHAT_EFFORTS.map((level, at) => {
							const reachableLevel = supported.includes(level)
							const dot = (
								<i
									aria-hidden
									className={cn(
										'absolute top-0 size-1 -translate-x-1/2 rounded-full bg-muted-foreground',
										at <= index ? 'opacity-0' : reachableLevel ? 'opacity-60' : 'opacity-30'
									)}
									style={{ left: position(at) }}
								/>
							)
							if (reachableLevel) return <span key={level}>{dot}</span>
							return (
								<span key={level}>
									{dot}
									<Tooltip content={`Not available for ${modelName}`} side="top">
										<span
											className="absolute -top-2 size-5 -translate-x-1/2 cursor-default"
											style={{ left: position(at) }}
											data-slot="effort-unavailable"
											data-level={level}
										/>
									</Tooltip>
								</span>
							)
						})}
						<Slider.Thumb
							index={0}
							aria-label={label}
							getAriaValueText={(_formatted, current) => EFFORT_LABEL[CHAT_EFFORTS[current] ?? 'medium']}
							className="size-4 rounded-full bg-primary-foreground shadow-surface-2 ring-2 ring-primary outline-none has-[:focus-visible]:ring-[3px]"
						/>
					</Slider.Track>
				</Slider.Control>
			</Slider.Root>
			<div className="mt-1.5 flex justify-between text-micro text-muted-foreground">
				<span>Faster</span>
				<span>Smarter</span>
			</div>
		</div>
	)
}
