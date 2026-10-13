'use client'

import { useState } from 'react'

import { Info } from 'lucide-react'

import { Tooltip } from '@/components/ui/tooltip'
import { dollars, toCents } from '@/lib/usd-text'
import { cn } from '@/lib/utils'

import { BUDGET_WARNING_PERCENT, type BudgetSnapshot, type ConversationUsage } from '@dv-lab/contracts'

const OTHER = 'other'

type Tone = 'primary' | 'warning' | 'destructive'

const FILL: Record<Tone, string> = {
	primary: 'bg-primary',
	warning: 'bg-warning',
	destructive: 'bg-destructive',
}

const HATCH: Record<Tone, string> = {
	primary: 'text-primary',
	warning: 'text-warning',
	destructive: 'text-destructive',
}

type Part = { key: string; title: string; cents: bigint }

export function BudgetUsage({
	budget,
	usage,
	capCents,
}: {
	budget: BudgetSnapshot
	usage: readonly ConversationUsage[]
	capCents: bigint
}) {
	const [hovered, setHovered] = useState<string | null>(null)
	const spent = toCents(budget.spentUsd, true)
	const held = toCents(budget.heldUsd, true)
	const used = spent + held
	const left = capCents > used ? capCents - used : 0n
	const tone: Tone =
		capCents === 0n || used >= capCents
			? 'destructive'
			: used * 100n >= capCents * BigInt(BUDGET_WARNING_PERCENT)
				? 'warning'
				: 'primary'
	const parts: Part[] = usage
		.map((row) => ({ key: row.conversationId, title: row.title, cents: toCents(row.costUsd, true) }))
		.filter((part) => part.cents > 0n)
	const listed = parts.reduce((sum, part) => sum + part.cents, 0n)
	if (used > listed) parts.push({ key: OTHER, title: 'Other conversations', cents: used - listed })
	const scale = held > 0n && used > 0n ? Number(spent) / Number(used) : 1
	const fill = tone === 'destructive' ? 100 : Number((spent * 100n) / capCents)
	const dim = (key: string) => hovered !== null && hovered !== key && 'opacity-50'

	return (
		<div className="flex flex-col gap-2" data-budget-usage>
			<div className="flex items-baseline justify-between gap-3 tabular-nums">
				<span className="text-body font-semibold text-foreground">{dollars(spent)} used</span>
				<span className="text-body text-muted-foreground">{dollars(left)} left</span>
			</div>
			<div
				role="img"
				aria-label={`${dollars(spent)} used, ${dollars(left)} left`}
				className="flex h-2 gap-0.5 overflow-hidden rounded-sm bg-selected"
				data-budget-fill={String(fill)}
				data-budget-bar={tone}
			>
				{parts.map((part) => (
					<Tooltip key={part.key} content={`${part.title}: ${dollars(part.cents)}`} side="top">
						<div
							className={cn(
								'h-full min-w-[3px] rounded-[2px] transition-opacity duration-120 motion-reduce:transition-none',
								FILL[tone],
								dim(part.key)
							)}
							style={{ flexGrow: Number(part.cents) * scale, flexBasis: 0 }}
							data-budget-segment={part.key}
							onPointerEnter={() => setHovered(part.key)}
							onPointerLeave={() => setHovered(null)}
						/>
					</Tooltip>
				))}
				{held > 0n ? (
					<div
						className={cn(
							'h-full min-w-[3px] rounded-[2px] bg-[repeating-linear-gradient(45deg,currentColor_0_2px,transparent_2px_5px)] opacity-55',
							HATCH[tone]
						)}
						style={{ flexGrow: Number(held), flexBasis: 0 }}
						data-budget-segment="held"
					/>
				) : null}
				<div style={{ flexGrow: Number(left), flexBasis: 0 }} aria-hidden />
			</div>
			{held > 0n ? (
				<p className="text-caption text-muted-foreground tabular-nums" data-budget-note="held">
					{dollars(held)} is held by a request in progress.
				</p>
			) : null}
			{budget.unknownAttempts > 0 ? (
				<p className="flex items-center gap-1.5 text-caption text-muted-foreground" data-budget-note="unconfirmed">
					<Info size={14} className="shrink-0" aria-hidden />
					Usage has not been confirmed. The figures are estimates.
				</p>
			) : (
				<p className="text-caption text-muted-foreground">An estimate from the prices in Models and limits.</p>
			)}
			{parts.length > 0 ? (
				<div className="mt-2 flex flex-col gap-2" data-budget-conversations>
					<p className="text-caption text-muted-foreground">Usage by conversation</p>
					<ul className="flex flex-col">
						{parts.map((part) => (
							<li
								key={part.key}
								className={cn(
									'-mx-2 flex justify-between gap-4 rounded-md px-2 py-1 text-body transition-colors duration-120 motion-reduce:transition-none',
									hovered === part.key && 'bg-hover'
								)}
								onPointerEnter={() => setHovered(part.key)}
								onPointerLeave={() => setHovered(null)}
							>
								<span className="min-w-0 truncate">{part.title}</span>
								<span className="shrink-0 tabular-nums">{dollars(part.cents)}</span>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	)
}
