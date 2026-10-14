'use client'

import type { ReactNode } from 'react'

import { Check, ListFilter, X } from 'lucide-react'

import { DotShape } from '@/components/app/status-dot'
import { BALANCE_STATE_LABELS, balanceTone } from '@/components/app/student-balance'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TabItem, Tabs, TabsList } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

import type { Currency } from '@dv-lab/contracts'
import { currencySymbol, type BalanceState } from '@dv-lab/core'

import {
	BALANCE_STATES,
	activeFilterCount,
	type Presence,
	type StudentsViewResult,
	type StudentsViewState,
} from './students-view'

export type ViewPatch = Partial<StudentsViewState>

export const FILTER_RESET: ViewPatch = { pay: [], cur: [], rate: 'any', next: 'any' }

const RATE_LABELS: Record<Exclude<Presence, 'any'>, string> = { has: 'Has rate', none: 'No rate' }
const NEXT_LABELS: Record<Exclude<Presence, 'any'>, string> = { has: 'Has a lesson', none: 'None' }

function currencyLabel(code: Currency) {
	return `${currencySymbol(code)} ${code}`
}

function StateMark({ state }: { state: BalanceState }) {
	const tone = balanceTone(state)
	return tone === null ? <span aria-hidden className="size-2 shrink-0" /> : <DotShape tone={tone.tone} />
}

function toggled<T>(list: readonly T[], item: T): T[] {
	return list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]
}

function OptionRow({
	selected,
	count,
	label,
	mark,
	onToggle,
}: {
	selected: boolean
	count: number
	label: string
	mark: ReactNode
	onToggle: () => void
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onToggle}
			className={cn(
				'flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-body outline-none',
				'transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring',
				selected && 'bg-active',
				count === 0 && !selected && 'opacity-50'
			)}
		>
			<span className="flex size-4 shrink-0 items-center justify-center">
				{selected ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
			</span>
			{mark}
			<span className="min-w-0 flex-1 truncate">{label}</span>
			<span className="text-caption text-muted-foreground tabular-nums">{count}</span>
		</button>
	)
}

function Group({ title, children }: { title: string; children: ReactNode }) {
	return (
		<div role="group" aria-label={title} className="flex flex-col gap-1">
			<p className="px-2 pb-1 text-caption font-medium text-muted-foreground">{title}</p>
			{children}
		</div>
	)
}

function PresenceGroup({
	title,
	value,
	labels,
	onChange,
}: {
	title: string
	value: Presence
	labels: Record<Exclude<Presence, 'any'>, string>
	onChange: (next: Presence) => void
}) {
	return (
		<div role="group" aria-label={title} className="flex flex-col gap-2">
			<p className="px-2 text-caption font-medium text-muted-foreground">{title}</p>
			<Tabs value={value} onValueChange={(next) => onChange(next as Presence)}>
				<TabsList aria-label={title} className="w-full [&>*]:flex-1 [&>*]:justify-center">
					<TabItem value="any" label="Any" />
					<TabItem value="has" label={labels.has} />
					<TabItem value="none" label={labels.none} />
				</TabsList>
			</Tabs>
		</div>
	)
}

export function FiltersButton({
	state,
	result,
	total,
	onChange,
}: {
	state: StudentsViewState
	result: StudentsViewResult
	total: number
	onChange: (patch: ViewPatch) => void
}) {
	const count = activeFilterCount(state)
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button variant="secondary" leadingIcon={ListFilter} className="shrink-0">
						<span className="inline-flex items-center gap-1.5">
							Filters
							{count > 0 ? (
								<span
									aria-label={`${count} ${count === 1 ? 'filter' : 'filters'} on`}
									className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-micro text-background tabular-nums"
								>
									{count}
								</span>
							) : null}
						</span>
					</Button>
				}
			/>
			<PopoverContent align="end" className="w-80 gap-4 p-4 max-sm:w-[calc(100vw-2rem)]" aria-label="Student filters">
				<Group title="Payment">
					{BALANCE_STATES.map((item) => (
						<OptionRow
							key={item}
							selected={state.pay.includes(item)}
							count={result.counts.pay[item]}
							label={BALANCE_STATE_LABELS[item]}
							mark={<StateMark state={item} />}
							onToggle={() => onChange({ pay: toggled(state.pay, item) })}
						/>
					))}
				</Group>
				{result.currencies.length > 0 ? (
					<Group title="Currency">
						{result.currencies.map((item) => (
							<OptionRow
								key={item}
								selected={state.cur.includes(item)}
								count={result.counts.cur[item]}
								label={currencyLabel(item)}
								mark={<span aria-hidden className="size-2 shrink-0" />}
								onToggle={() => onChange({ cur: toggled(state.cur, item) })}
							/>
						))}
					</Group>
				) : null}
				<PresenceGroup title="Rate" value={state.rate} labels={RATE_LABELS} onChange={(rate) => onChange({ rate })} />
				<PresenceGroup
					title="Next lesson"
					value={state.next}
					labels={NEXT_LABELS}
					onChange={(next) => onChange({ next })}
				/>
				<div className="flex items-center justify-between gap-2 pt-1">
					<p className="text-caption text-muted-foreground tabular-nums">
						{result.rows.length} of {total} students
					</p>
					<Button variant="ghost" size="compact" disabled={count === 0} onClick={() => onChange(FILTER_RESET)}>
						Reset
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	)
}

interface Chip {
	key: string
	label: string
	mark: ReactNode
	patch: ViewPatch
}

function chipsOf(state: StudentsViewState): Chip[] {
	const chips: Chip[] = []
	for (const item of state.pay) {
		chips.push({
			key: `pay-${item}`,
			label: BALANCE_STATE_LABELS[item],
			mark: <StateMark state={item} />,
			patch: { pay: state.pay.filter((entry) => entry !== item) },
		})
	}
	for (const item of state.cur) {
		chips.push({
			key: `cur-${item}`,
			label: currencyLabel(item),
			mark: null,
			patch: { cur: state.cur.filter((entry) => entry !== item) },
		})
	}
	if (state.rate !== 'any') {
		chips.push({ key: 'rate', label: RATE_LABELS[state.rate], mark: null, patch: { rate: 'any' } })
	}
	if (state.next !== 'any') {
		chips.push({
			key: 'next',
			label: state.next === 'has' ? NEXT_LABELS.has : 'No next lesson',
			mark: null,
			patch: { next: 'any' },
		})
	}
	return chips
}

export function FilterChips({ state, onChange }: { state: StudentsViewState; onChange: (patch: ViewPatch) => void }) {
	const chips = chipsOf(state)
	if (chips.length === 0) return null
	return (
		<div data-slot="filter-chips" className="mt-3 flex flex-wrap items-center gap-2">
			{chips.map((chip) => (
				<Button
					key={chip.key}
					variant="secondary"
					size="compact"
					trailingIcon={X}
					aria-label={`Remove filter: ${chip.label}`}
					onClick={() => onChange(chip.patch)}
				>
					<span className="inline-flex items-center gap-1.5">
						{chip.mark}
						{chip.label}
					</span>
				</Button>
			))}
			<Button variant="ghost" size="compact" onClick={() => onChange(FILTER_RESET)}>
				Reset filters
			</Button>
		</div>
	)
}
