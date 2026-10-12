'use client'

import { useState } from 'react'

import { Check, Copy, ListChecks } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

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
import { apiRequest } from '@/lib/api-client'

import type { GoogleScheduleWindow } from '@dv-lab/contracts'
import { addDays, mondayOf, scheduleDate } from '@dv-lab/core'

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
const BATCH = 4

type EventDates = Map<string, Set<string>>

function isoDay(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0')
	const day = String(date.getDate()).padStart(2, '0')
	return `${date.getFullYear()}-${month}-${day}`
}

function collect(window: GoogleScheduleWindow, from: string, to: string, into: EventDates) {
	for (const event of window.events) {
		if (event.status === 'cancelled') continue
		const day =
			event.when.kind === 'timed'
				? scheduleDate(new Date(event.when.startsAt), event.when.timeZone)
				: event.when.startsOn
		if (day < from || day > to) continue
		const title = event.title?.trim() || 'Untitled'
		const dates = into.get(title) ?? new Set<string>()
		dates.add(day)
		into.set(title, dates)
	}
}

async function loadEvents(from: string, to: string): Promise<EventDates | null> {
	const mondays: string[] = []
	for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) mondays.push(monday)
	if (mondays.length > MAX_WEEKS) return null
	const events: EventDates = new Map()
	for (let index = 0; index < mondays.length; index += BATCH) {
		const results = await Promise.all(
			mondays
				.slice(index, index + BATCH)
				.map((monday) => apiRequest<GoogleScheduleWindow>('GET', `/schedule/week?start=${monday}`))
		)
		for (const result of results) {
			if (!result.ok || result.data.read.state === 'unavailable') return null
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
	return [...byMonth]
		.map(([key, days]) => `${days.join(', ')} - ${MONTHS[Number(key.slice(5, 7)) - 1]}`)
		.join('\n')
}

export function LessonCountDialog() {
	const [open, setOpen] = useState(false)
	const [range, setRange] = useState<DateRange | undefined>()
	const [state, setState] = useState<'idle' | 'loading' | 'error' | 'too_long' | 'ready'>('idle')
	const [events, setEvents] = useState<EventDates>(new Map())
	const [title, setTitle] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)

	function pick(next: DateRange | undefined) {
		setRange(next)
		setState('idle')
		setTitle(null)
		setCopied(false)
		if (!next?.from || !next.to) return
		const from = isoDay(next.from)
		const to = isoDay(next.to)
		setState('loading')
		void loadEvents(from, to).then((result) => {
			if (result === null) {
				const weeks = (Date.parse(to) - Date.parse(from)) / (7 * 86400000)
				setState(weeks > MAX_WEEKS ? 'too_long' : 'error')
				return
			}
			setEvents(result)
			setState('ready')
		})
	}

	const text = title === null ? '' : lessonCountText(events.get(title) ?? [])
	const titles = [...events.keys()].sort((a, b) => a.localeCompare(b))

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
			<DialogTrigger render={<Button variant="tertiary" leadingIcon={ListChecks} />}>Count lessons</DialogTrigger>
			<DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Count lessons</DialogTitle>
					<DialogDescription>Pick a date range, then an event, to get its dates by month.</DialogDescription>
				</DialogHeader>
				<Calendar mode="range" numberOfMonths={2} selected={range} onSelect={pick} className="mx-auto" />
				{state === 'loading' ? <p className="text-body text-muted-foreground">Loading events…</p> : null}
				{state === 'error' ? (
					<p className="text-body text-muted-foreground">Google Calendar events could not be read. Try again.</p>
				) : null}
				{state === 'too_long' ? (
					<p className="text-body text-muted-foreground">Pick a range of up to a year.</p>
				) : null}
				{state === 'ready' && titles.length === 0 ? (
					<p className="text-body text-muted-foreground">No events in this range.</p>
				) : null}
				{state === 'ready' && titles.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{titles.map((name) => (
							<Button
								key={name}
								size="compact"
								variant={name === title ? 'primary' : 'tertiary'}
								className="rounded-full"
								onClick={() => {
									setTitle(name)
									setCopied(false)
								}}
							>
								{name} · {events.get(name)?.size}
							</Button>
						))}
					</div>
				) : null}
				{title !== null ? (
					<div className="space-y-2">
						<pre className="rounded-md bg-muted p-3 font-sans text-body whitespace-pre-wrap">{text}</pre>
						<Button leadingIcon={copied ? Check : Copy} onClick={() => void copy()}>
							{copied ? 'Copied' : 'Copy'}
						</Button>
					</div>
				) : null}
			</DialogContent>
		</Dialog>
	)
}
