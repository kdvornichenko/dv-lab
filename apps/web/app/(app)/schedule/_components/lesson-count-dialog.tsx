'use client'

import { useMemo, useRef, useState } from 'react'
import type { DateRange } from 'react-day-picker'

import { Check, Copy, ListChecks, Search } from 'lucide-react'

import { READ_ISSUES } from '@/components/app/google-calendar-state'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { useIsMobile } from '@/hooks/use-mobile'
import { apiRequest } from '@/lib/api-client'
import { cn } from '@/lib/utils'

import type { CalendarIssue, GoogleScheduleWindow } from '@dv-lab/contracts'
import { addDays, lessonDay, mondayOf } from '@dv-lab/core'

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
]
const MAX_WEEKS = 53
const BATCH = 1
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SEARCH_FROM = 6
const ROW = 'h-9'

type EventDates = Map<string, Set<string>>

function isoDay(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

function weekCount(from: string, to: string): number {
	let count = 0
	for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) count++
	return count
}

function rangeSummary(range: DateRange | undefined): string {
	if (!range?.from) return 'Pick the first day'
	const from = range.from
	const to = range.to ?? range.from
	if (isoDay(from) === isoDay(to))
		return `${WEEKDAYS[from.getDay()]} ${from.getDate()} ${SHORT_MONTHS[from.getMonth()]} ${from.getFullYear()}`
	const sameYear = from.getFullYear() === to.getFullYear()
	const part = (date: Date, year: boolean) =>
		`${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}${year ? ` ${date.getFullYear()}` : ''}`
	return `${part(from, !sameYear)} – ${part(to, true)}`
}

function collect(window: GoogleScheduleWindow, from: string, to: string, into: EventDates) {
	for (const event of window.events) {
		if (event.status === 'cancelled') continue
		const day =
			event.when.kind === 'timed'
				? lessonDay(new Date(event.when.startsAt), window.requestedRange.timeZone)
				: event.when.startsOn
		if (day < from || day > to) continue
		const title = event.title?.trim() || 'Untitled'
		const dates = into.get(title) ?? new Set<string>()
		dates.add(day)
		into.set(title, dates)
	}
}

async function loadEvents(from: string, to: string): Promise<EventDates | { issue: CalendarIssue | null }> {
	const mondays: string[] = []
	for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) mondays.push(monday)
	if (mondays.length > MAX_WEEKS) return { issue: null }
	const events: EventDates = new Map()
	for (let index = 0; index < mondays.length; index += BATCH) {
		const results = await Promise.all(
			mondays
				.slice(index, index + BATCH)
				.map((monday) => apiRequest<GoogleScheduleWindow>('GET', `/schedule/week?start=${monday}`))
		)
		for (const result of results) {
			if (!result.ok) return { issue: null }
			if (result.data.read.state === 'unavailable') return { issue: result.data.read.reason }
			collect(result.data, from, to, events)
		}
	}
	return events
}

function lessonCountText(dates: Iterable<string>): string {
	const byMonth = new Map<string, number[]>()
	for (const date of [...dates].sort()) {
		const key = date.slice(0, 7)
		const days = byMonth.get(key) ?? []
		days.push(Number(date.slice(8, 10)))
		byMonth.set(key, days)
	}
	return [...byMonth].map(([key, days]) => `${days.join(', ')} - ${MONTHS[Number(key.slice(5, 7)) - 1]}`).join('\n')
}

function plural(total: number): string {
	return `${total} ${total === 1 ? 'date' : 'dates'}`
}

function EventList({
	titles,
	events,
	selected,
	onSelect,
}: {
	titles: string[]
	events: EventDates
	selected: string | null
	onSelect: (title: string) => void
}) {
	const [query, setQuery] = useState('')
	const listRef = useRef<HTMLDivElement>(null)
	const searchable = titles.length > SEARCH_FROM
	const needle = query.trim().toLowerCase()
	const shown = needle === '' ? titles : titles.filter((name) => name.toLowerCase().includes(needle))
	const stop = selected !== null && shown.includes(selected) ? selected : shown[0]

	function move(event: React.KeyboardEvent) {
		const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
		const index = rows.findIndex((row) => row === document.activeElement)
		const last = rows.length - 1
		const next =
			event.key === 'ArrowDown'
				? Math.min(index + 1, last)
				: event.key === 'ArrowUp'
					? Math.max(index - 1, 0)
					: event.key === 'Home'
						? 0
						: event.key === 'End'
							? last
							: null
		if (next === null || rows.length === 0) return
		event.preventDefault()
		rows[next]?.focus()
	}

	return (
		<div className="overflow-hidden rounded-lg ring-1 ring-input ring-inset">
			{searchable ? (
				<div className="flex h-10 items-center gap-2 border-b px-3">
					<Search size={14} className="shrink-0 text-muted-foreground" aria-hidden />
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Search events"
						aria-label="Search events"
						className="h-full rounded-none px-0 ring-0"
					/>
				</div>
			) : null}
			{shown.length === 0 ? (
				<div className="flex flex-col items-center gap-1 py-6 text-center">
					<p className="text-body text-muted-foreground">No events found</p>
					<p className="text-caption text-muted-foreground">Try another part of the title.</p>
				</div>
			) : (
				<ScrollArea
					className={cn(searchable && 'max-h-54')}
					viewportClassName={cn(searchable && 'scroll-fade max-h-54')}
				>
					<div ref={listRef} role="listbox" aria-label="Events" onKeyDown={move}>
						{shown.map((name) => {
							const total = events.get(name)?.size ?? 0
							const chosen = name === selected
							return (
								<button
									key={name}
									type="button"
									role="option"
									aria-selected={chosen}
									aria-label={`${name}, ${plural(total)}`}
									tabIndex={name === stop ? 0 : -1}
									title={name}
									onClick={() => onSelect(name)}
									className={cn(
										ROW,
										'flex w-full items-center gap-2 px-3 text-left text-body transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none',
										chosen && 'bg-active'
									)}
								>
									<span className="flex size-4 shrink-0 items-center justify-center">
										{chosen ? <Check size={14} aria-hidden /> : null}
									</span>
									<span className={cn('min-w-0 flex-1 truncate', chosen && 'font-semibold')}>{name}</span>
									<span className="shrink-0 text-muted-foreground tabular-nums">{plural(total)}</span>
								</button>
							)
						})}
					</div>
				</ScrollArea>
			)}
		</div>
	)
}

export function LessonCountDialog({ iconOnly = false }: { iconOnly?: boolean }) {
	const [open, setOpen] = useState(false)
	const [range, setRange] = useState<DateRange | undefined>()
	const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle')
	const [events, setEvents] = useState<EventDates>(new Map())
	const [title, setTitle] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const [issue, setIssue] = useState<CalendarIssue | null>(null)
	const requests = useRef(0)
	const showRef = useRef<HTMLButtonElement>(null)
	const mobile = useIsMobile()

	const tooLong = range?.from ? weekCount(isoDay(range.from), isoDay(range.to ?? range.from)) > MAX_WEEKS : false

	function pick(next: DateRange | undefined) {
		requests.current++
		setRange(next)
		setState('idle')
		setTitle(null)
		setCopied(false)
	}

	function show() {
		if (!range?.from || tooLong) return
		const from = isoDay(range.from)
		const to = isoDay(range.to ?? range.from)
		const id = ++requests.current
		setTitle(null)
		setCopied(false)
		setState('loading')
		void loadEvents(from, to).then((result) => {
			if (id !== requests.current) return
			if (!(result instanceof Map)) {
				setIssue(result.issue)
				setState('error')
				requestAnimationFrame(() => showRef.current?.focus())
				return
			}
			setEvents(result)
			setState('ready')
		})
	}

	const text = title === null ? '' : lessonCountText(events.get(title) ?? [])
	const titles = useMemo(() => [...events.keys()].sort((a, b) => a.localeCompare(b)), [events])

	async function copy() {
		try {
			await navigator.clipboard.writeText(text)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			setCopied(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{iconOnly ? (
				<Tooltip side="bottom" content="Count lessons">
					<DialogTrigger
						render={
							<Button variant="tertiary" size="icon-compact" aria-label="Count lessons">
								<ListChecks />
							</Button>
						}
					/>
				</Tooltip>
			) : (
				<DialogTrigger
					render={
						<Button variant="tertiary" leadingIcon={ListChecks}>
							Count lessons
						</Button>
					}
				/>
			)}
			<DialogContent size="lg">
				<DialogHeader>
					<DialogTitle>Count lessons</DialogTitle>
					<DialogDescription>Pick a date range, then an event, to get its dates by month.</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] -m-1 p-1">
					<div className="flex flex-col gap-4">
						<div className="flex justify-center rounded-lg ring-1 ring-input ring-inset">
							<Calendar
								mode="range"
								numberOfMonths={mobile ? 1 : 2}
								selected={range}
								onSelect={pick}
								className="bg-transparent"
								classNames={{ months: 'relative flex flex-col gap-4 md:flex-row' }}
							/>
						</div>
						<div className="flex items-center justify-between gap-3">
							<p
								aria-live="polite"
								className={cn(
									'min-w-0 text-body tabular-nums',
									tooLong ? 'text-caption text-destructive' : 'text-muted-foreground'
								)}
							>
								{tooLong ? 'Pick a range of up to a year.' : rangeSummary(range)}
							</p>
							<Button
								ref={showRef}
								className="shrink-0"
								disabled={!range?.from || tooLong || state === 'loading'}
								loading={state === 'loading'}
								onClick={show}
							>
								{state === 'loading' ? 'Loading…' : 'Show events'}
							</Button>
						</div>
						{state === 'error' ? (
							<Banner status="error" role="alert">
								<BannerTitle>
									{issue === null ? 'Google Calendar events could not be read. Try again.' : READ_ISSUES[issue]}
								</BannerTitle>
							</Banner>
						) : null}
						{state === 'loading' ? (
							<div className="flex flex-col gap-2 border-t pt-4" aria-hidden>
								{[0, 1, 2, 3].map((row) => (
									<Skeleton key={row} className="h-3 rounded-md" />
								))}
							</div>
						) : null}
						{state === 'ready' && titles.length === 0 ? (
							<div className="flex flex-col items-center gap-1 border-t pt-4 text-center">
								<p className="text-body text-muted-foreground">No events in this range.</p>
								<p className="text-caption text-muted-foreground">Try a longer range.</p>
							</div>
						) : null}
						{state === 'ready' && titles.length > 0 ? (
							<>
								<EventList
									key={titles.join('\u0000')}
									titles={titles}
									events={events}
									selected={title}
									onSelect={(name) => {
										setTitle(name)
										setCopied(false)
									}}
								/>
								{title === null ? (
									<p className="text-caption text-muted-foreground">Choose an event to see its dates.</p>
								) : null}
							</>
						) : null}
						{title !== null ? (
							<section aria-label={title} className="flex flex-col gap-2 rounded-lg bg-hover p-3">
								<div className="flex items-center justify-between gap-3">
									<p className="min-w-0 truncate text-body font-semibold">{title}</p>
									<Tooltip side="top" forceOpen={copied ? true : undefined} content={copied ? 'Copied' : 'Copy dates'}>
										<Button
											variant="secondary"
											size="icon-compact"
											className="shrink-0"
											aria-label="Copy dates"
											onClick={() => void copy()}
										>
											{copied ? <Check /> : <Copy />}
										</Button>
									</Tooltip>
									<span className="sr-only" aria-live="polite">
										{copied ? 'Copied' : ''}
									</span>
								</div>
								<div className="text-body tabular-nums select-all">
									{text.split('\n').map((line) => (
										<p key={line} className="leading-6">
											{line}
										</p>
									))}
								</div>
							</section>
						) : null}
					</div>
				</ScrollArea>
			</DialogContent>
		</Dialog>
	)
}
