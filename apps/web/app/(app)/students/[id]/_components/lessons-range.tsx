'use client'

import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { enUS } from 'react-day-picker/locale'

import { CalendarDays, Check, ListFilter, X } from 'lucide-react'

import { DotShape, type StatusTone } from '@/components/app/status-dot'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { periodText } from '@/lib/lesson-count-text'
import { cn } from '@/lib/utils'

import { STUDENT_LESSONS_DAYS_MAX, type StudentLesson, type StudentLessonsTotals } from '@dv-lab/contracts'
import { addDays } from '@dv-lab/core'

export type RangeChoice =
	{ kind: 'since_payment' } | { kind: 'month' } | { kind: 'last30' } | { kind: 'custom'; from: string; to: string }

export type OutcomeKey = 'planned' | 'done' | 'no_show' | 'cancelled' | 'moved'

export const OUTCOME_KEYS = [
	'planned',
	'done',
	'no_show',
	'cancelled',
	'moved',
] as const satisfies readonly OutcomeKey[]

export const OUTCOME_WORDS: Record<OutcomeKey, string> = {
	planned: 'Planned',
	done: 'Done',
	no_show: 'No-show',
	cancelled: 'Cancelled',
	moved: 'Moved',
}

const OUTCOME_TONES: Record<OutcomeKey, StatusTone> = {
	planned: 'blue',
	done: 'gray',
	no_show: 'gray',
	cancelled: 'red',
	moved: 'amber',
}

export type Bounds = { from: string; to: string }

export function toDate(value: string): Date {
	const [year, month, day] = value.split('-').map(Number)
	return new Date(year, month - 1, day)
}

export function fromDate(value: Date): string {
	const month = String(value.getMonth() + 1).padStart(2, '0')
	const day = String(value.getDate()).padStart(2, '0')
	return `${value.getFullYear()}-${month}-${day}`
}

function monthEnd(today: string): string {
	const year = Number(today.slice(0, 4))
	const month = Number(today.slice(5, 7))
	return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

export function fixedBounds(choice: RangeChoice, today: string): Bounds | null {
	if (choice.kind === 'month') return { from: `${today.slice(0, 7)}-01`, to: monthEnd(today) }
	if (choice.kind === 'last30') return { from: addDays(today, -29), to: today }
	if (choice.kind === 'custom') return { from: choice.from, to: choice.to }
	return null
}

export function lessonsQuery(choice: RangeChoice, today: string): string {
	const bounds = fixedBounds(choice, today)
	return bounds === null ? 'range=since_payment' : `from=${bounds.from}&to=${bounds.to}`
}

const PRESET_NAMES = { since_payment: 'Since last payment', month: 'This month', last30: 'Last 30 days' } as const

export function rangeName(choice: RangeChoice): string {
	return choice.kind === 'custom' ? periodText(choice.from, choice.to, '–') : PRESET_NAMES[choice.kind]
}

function boundsText(bounds: Bounds | null): string {
	return bounds === null ? '' : periodText(bounds.from, bounds.to, '–')
}

const PRESETS = ['since_payment', 'month', 'last30'] as const

interface RangeControlProps {
	choice: RangeChoice
	today: string
	hasPayment: boolean
	paidOn: string | null
	resolved: Bounds | null
	onChange: (choice: RangeChoice) => void
}

export function RangeControl({ choice, today, hasPayment, paidOn, resolved, onChange }: RangeControlProps) {
	const [open, setOpen] = useState(false)
	const [first, setFirst] = useState<string | null>(null)
	const [custom, setCustom] = useState(false)
	const shown = fixedBounds(choice, today) ?? resolved ?? (paidOn === null ? null : { from: paidOn, to: today })
	const sinceBounds =
		resolved !== null && choice.kind === 'since_payment'
			? resolved
			: paidOn === null
				? null
				: { from: paidOn, to: today }

	function change(next: boolean) {
		setOpen(next)
		if (next) return
		setFirst(null)
		setCustom(false)
	}

	function pick(next: RangeChoice) {
		onChange(next)
		change(false)
	}

	function clickDay(day: Date) {
		const iso = fromDate(day)
		setCustom(true)
		if (first === null) {
			setFirst(iso)
			return
		}
		const [from, to] = first <= iso ? [first, iso] : [iso, first]
		pick({ kind: 'custom', from, to })
	}

	const selected: DateRange | undefined =
		first !== null
			? { from: toDate(first), to: toDate(first) }
			: shown === null
				? undefined
				: { from: toDate(shown.from), to: toDate(shown.to) }
	const disabled =
		first === null
			? undefined
			: [
					{ before: toDate(addDays(first, -(STUDENT_LESSONS_DAYS_MAX - 1))) },
					{ after: toDate(addDays(first, STUDENT_LESSONS_DAYS_MAX - 1)) },
				]
	const calendarVisible = custom || first !== null

	return (
		<Popover open={open} onOpenChange={change}>
			<PopoverTrigger
				render={
					<Button
						variant="tertiary"
						leadingIcon={CalendarDays}
						data-slot="lessons-range"
						aria-label={`Date range: ${rangeName(choice)}`}
						className="max-w-full min-w-0"
					>
						<span className="min-w-0 truncate">{rangeName(choice)}</span>
						{choice.kind === 'custom' || shown === null ? null : (
							<span className="ml-1 text-muted-foreground max-sm:hidden">{boundsText(shown)}</span>
						)}
					</Button>
				}
			/>
			<PopoverContent
				align="start"
				data-slot="lessons-range-popover"
				className={cn('flex-row gap-0 p-0 max-sm:w-[min(19.5rem,calc(100vw-2rem))] max-sm:flex-col sm:w-auto')}
			>
				<div role="group" aria-label="Date range" className="flex flex-col gap-0.5 p-2 sm:w-56">
					{PRESETS.map((kind) => {
						const off = kind === 'since_payment' && !hasPayment
						const active = choice.kind === kind && !custom
						const dates = kind === 'since_payment' ? sinceBounds : fixedBounds({ kind }, today)
						return (
							<RangeRow
								key={kind}
								active={active}
								disabled={off}
								name={PRESET_NAMES[kind]}
								dates={off ? 'No payment yet' : boundsText(dates)}
								onClick={() => pick({ kind })}
							/>
						)
					})}
					<RangeRow
						active={choice.kind === 'custom' || custom}
						disabled={false}
						name="Custom range"
						dates={choice.kind === 'custom' ? periodText(choice.from, choice.to, '–') : ''}
						onClick={() => {
							setCustom(true)
							setFirst(null)
						}}
					/>
				</div>
				<div
					className={cn(
						'flex-col border-border max-sm:border-t sm:flex sm:border-l',
						calendarVisible ? 'flex' : 'hidden'
					)}
				>
					<Calendar
						mode="range"
						locale={enUS}
						weekStartsOn={1}
						selected={selected}
						defaultMonth={toDate(shown?.from ?? today)}
						disabled={disabled}
						onDayClick={clickDay}
					/>
					<p className="px-3 pb-3 text-caption text-muted-foreground" aria-live="polite">
						{first === null ? '' : 'Choose the last day'}
					</p>
				</div>
			</PopoverContent>
		</Popover>
	)
}

function RangeRow({
	active,
	disabled,
	name,
	dates,
	onClick,
}: {
	active: boolean
	disabled: boolean
	name: string
	dates: string
	onClick: () => void
}) {
	return (
		<button
			type="button"
			disabled={disabled}
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				'flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-left outline-none',
				'transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring',
				'disabled:pointer-events-none disabled:opacity-50 max-sm:h-9 max-sm:py-0',
				active && 'bg-active'
			)}
		>
			<span className="flex size-4 shrink-0 items-center justify-center">
				{active ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
			</span>
			<span className="flex min-w-0 flex-1 flex-col max-sm:flex-row max-sm:items-baseline max-sm:justify-between max-sm:gap-2">
				<span className="truncate text-body">{name}</span>
				{dates === '' ? null : <span className="truncate text-micro text-muted-foreground tabular-nums">{dates}</span>}
			</span>
		</button>
	)
}

export function outcomeCounts(lessons: readonly StudentLesson[]): Record<OutcomeKey, number> {
	const counts: Record<OutcomeKey, number> = { planned: 0, done: 0, no_show: 0, cancelled: 0, moved: 0 }
	for (const lesson of lessons) {
		if (lesson.outcome !== 'moved') counts[lesson.outcome] += 1
		if (lesson.movedFrom !== null) counts.moved += 1
	}
	return counts
}

export function matchesOutcomes(lesson: StudentLesson, selected: readonly OutcomeKey[]): boolean {
	if (selected.length === 0) return true
	return selected.some((key) => (key === 'moved' ? lesson.movedFrom !== null : lesson.outcome === key))
}

function toggled(list: readonly OutcomeKey[], key: OutcomeKey): OutcomeKey[] {
	return list.includes(key)
		? list.filter((entry) => entry !== key)
		: OUTCOME_KEYS.filter((item) => item === key || list.includes(item))
}

interface OutcomeFilterProps {
	selected: readonly OutcomeKey[]
	counts: Record<OutcomeKey, number>
	onChange: (selected: OutcomeKey[]) => void
}

export function OutcomeFilter({ selected, counts, onChange }: OutcomeFilterProps) {
	return (
		<Popover>
			<PopoverTrigger
				render={
					<Button variant="tertiary" leadingIcon={ListFilter} data-slot="lessons-outcome-filter" className="shrink-0">
						<span className="inline-flex items-center gap-1.5">
							Outcome
							{selected.length > 0 ? (
								<span
									aria-label={`${selected.length} ${selected.length === 1 ? 'outcome' : 'outcomes'} chosen`}
									className="flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground px-1.5 text-micro text-background tabular-nums"
								>
									{selected.length}
								</span>
							) : null}
						</span>
					</Button>
				}
			/>
			<PopoverContent
				align="start"
				className="w-64 gap-1 p-2 max-sm:w-[min(16rem,calc(100vw-2rem))]"
				aria-label="Outcome filter"
			>
				<div role="group" aria-label="Outcome" className="flex flex-col gap-1">
					<p className="px-2 pb-1 text-caption font-medium text-muted-foreground">Outcome</p>
					{OUTCOME_KEYS.map((key) => {
						const on = selected.includes(key)
						return (
							<button
								key={key}
								type="button"
								aria-pressed={on}
								disabled={counts[key] === 0 && !on}
								onClick={() => onChange(toggled(selected, key))}
								className={cn(
									'flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left text-body outline-none',
									'transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-focus-ring',
									'disabled:pointer-events-none disabled:opacity-50',
									on && 'bg-active'
								)}
							>
								<span className="flex size-4 shrink-0 items-center justify-center">
									{on ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
								</span>
								<DotShape tone={OUTCOME_TONES[key]} />
								<span className="min-w-0 flex-1 truncate">{OUTCOME_WORDS[key]}</span>
								<span className="text-caption text-muted-foreground tabular-nums">{counts[key]}</span>
							</button>
						)
					})}
				</div>
			</PopoverContent>
		</Popover>
	)
}

export function FilterChips({
	selected,
	onChange,
}: {
	selected: readonly OutcomeKey[]
	onChange: (selected: OutcomeKey[]) => void
}) {
	if (selected.length === 0) return null
	return (
		<div data-slot="filter-chips" className="flex flex-wrap items-center gap-2">
			{selected.map((key) => (
				<Button
					key={key}
					variant="secondary"
					size="compact"
					trailingIcon={X}
					aria-label={`Remove filter: ${OUTCOME_WORDS[key]}`}
					onClick={() => onChange(selected.filter((entry) => entry !== key))}
				>
					<span className="inline-flex items-center gap-1.5">
						<DotShape tone={OUTCOME_TONES[key]} />
						{OUTCOME_WORDS[key]}
					</span>
				</Button>
			))}
			<Button variant="ghost" size="compact" onClick={() => onChange([])}>
				Reset filter
			</Button>
		</div>
	)
}

export function ShowingLine({
	shown,
	total,
	totals,
}: {
	shown: number
	total: number
	totals: StudentLessonsTotals | null
}) {
	return (
		<p data-slot="lessons-showing" className="text-caption text-muted-foreground tabular-nums">
			Showing {shown} of {total} {total === 1 ? 'lesson' : 'lessons'}
			{totals === null
				? ''
				: ` · Held in the range: ${totals.heldCount} ${totals.heldCount === 1 ? 'lesson' : 'lessons'}, ${totals.heldMinutes} min`}
		</p>
	)
}
