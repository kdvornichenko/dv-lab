'use client'

import { useEffect, useEffectEvent, useMemo, useState, type ReactNode, type Ref } from 'react'
import { enUS } from 'react-day-picker/locale'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

import { TimeZonePicker } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { Calendar as DayCalendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { calendarLesson } from '@/lib/lesson-actions'
import { dayNumber, periodTitle, weekTitle } from '@/lib/schedule-format'

import type { CalendarEventView } from '@dv-lab/contracts'
import { addDays, lessonDay, mondayOf, zonedInstant } from '@dv-lab/core'

interface WeekNavigation {
	monday: string
	currentMonday: string
	onToday: () => void
	onPrevious: () => void
	onNext: () => void
}

interface ScheduleToolbarProps extends WeekNavigation {
	mainTimeZone: string
	zone: string | null
	onZoneChange: (zone: string | null) => void
}

const FIELD_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"]'

function typingTarget(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(FIELD_SELECTOR) !== null
}

export function useScheduleKeys({
	onToday,
	onPrevious,
	onNext,
}: Pick<WeekNavigation, 'onToday' | 'onPrevious' | 'onNext'>) {
	const onKey = useEffectEvent((event: KeyboardEvent) => {
		if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
		if (typingTarget(event.target) || typingTarget(document.activeElement)) return
		if (document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')) return
		if (event.key === 't') onToday()
		else if (event.key === 'j' || event.key === 'ArrowRight') onNext()
		else if (event.key === 'k' || event.key === 'ArrowLeft') onPrevious()
		else return
		event.preventDefault()
	})

	useEffect(() => {
		const listener = (event: KeyboardEvent) => onKey(event)
		document.addEventListener('keydown', listener)
		return () => document.removeEventListener('keydown', listener)
	}, [])
}

export function weekSummary(events: readonly CalendarEventView[], monday: string, mainTimeZone: string): string | null {
	const sunday = addDays(monday, 6)
	const held = events
		.filter(calendarLesson)
		.filter((event) => event.status !== 'cancelled')
		.filter((event) => {
			const day = lessonDay(new Date(event.when.startsAt), mainTimeZone)
			return monday <= day && day <= sunday
		})
	if (held.length === 0) return null
	const students = new Set(held.map((event) => event.binding.studentId)).size
	return `${held.length} ${held.length === 1 ? 'lesson' : 'lessons'} with ${students} ${students === 1 ? 'student' : 'students'}`
}

function BarTip({ name, shortcut, children }: { name: string; shortcut?: string; children: React.ReactElement }) {
	return (
		<Tooltip
			side="bottom"
			content={
				<span className="flex items-center gap-2">
					{name}
					{shortcut ? <span className="opacity-60">{shortcut}</span> : null}
				</span>
			}
		>
			{children}
		</Tooltip>
	)
}

function TodayIcon({ today }: { today: number }) {
	return (
		<span className="relative flex">
			<Calendar />
			<span
				aria-hidden
				className="absolute inset-x-0 bottom-[1.5px] text-center text-[7px] leading-none font-semibold tabular-nums"
			>
				{today}
			</span>
		</span>
	)
}

function localDate(value: string) {
	const [y, m, d] = value.split('-').map(Number)
	return new Date(y, m - 1, d)
}

function isoDate(value: Date) {
	const m = String(value.getMonth() + 1).padStart(2, '0')
	const d = String(value.getDate()).padStart(2, '0')
	return `${value.getFullYear()}-${m}-${d}`
}

function WeekPicker({ monday, onWeek }: { monday: string; onWeek: (monday: string) => void }) {
	const [open, setOpen] = useState(false)
	const week = { from: localDate(monday), to: localDate(addDays(monday, 6)) }
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<BarTip name="Choose week">
				<PopoverTrigger
					render={
						<Button
							variant="ghost"
							size="compact"
							aria-label={`Choose week, ${weekTitle(monday)}`}
							data-slot="schedule-week-picker"
							className="w-44 shrink-0 text-title font-semibold whitespace-nowrap text-foreground tabular-nums"
						>
							{weekTitle(monday)}
						</Button>
					}
				/>
			</BarTip>
			<PopoverContent align="start" className="w-auto p-0">
				<DayCalendar
					mode="range"
					locale={enUS}
					weekStartsOn={1}
					selected={week}
					defaultMonth={week.from}
					onSelect={(_, day) => {
						setOpen(false)
						const target = mondayOf(isoDate(day))
						if (target !== monday) onWeek(target)
					}}
				/>
			</PopoverContent>
		</Popover>
	)
}

export function ScheduleBar({
	monday,
	currentMonday,
	today,
	onToday,
	onPrevious,
	onNext,
	onWeek,
	summary,
	titleRef,
	heading = true,
}: WeekNavigation & {
	today: string
	summary: ReactNode
	titleRef: Ref<HTMLHeadingElement>
	heading?: boolean
	onWeek: (monday: string) => void
}) {
	return (
		<TooltipProvider>
			<div data-slot="schedule-toolbar" className="flex min-w-0 items-center gap-2">
				<BarTip name="Today" shortcut="T">
					<Button
						variant="tertiary"
						size="icon-compact"
						aria-label="Today"
						disabled={monday === currentMonday}
						onClick={onToday}
					>
						<TodayIcon today={dayNumber(today)} />
					</Button>
				</BarTip>
				<BarTip name="Previous week" shortcut="K">
					<Button variant="tertiary" size="icon-compact" aria-label="Previous week" onClick={onPrevious}>
						<ChevronLeft />
					</Button>
				</BarTip>
				{heading ? (
					<h1
						ref={titleRef}
						tabIndex={-1}
						aria-label={weekTitle(monday)}
						data-slot="schedule-period"
						className="shrink-0 outline-none"
					>
						<WeekPicker monday={monday} onWeek={onWeek} />
					</h1>
				) : (
					<div data-slot="schedule-period" className="shrink-0">
						<WeekPicker monday={monday} onWeek={onWeek} />
					</div>
				)}
				<BarTip name="Next week" shortcut="J">
					<Button variant="tertiary" size="icon-compact" aria-label="Next week" onClick={onNext}>
						<ChevronRight />
					</Button>
				</BarTip>
				{summary ? (
					<span
						data-slot="schedule-summary"
						className="ml-1 hidden min-w-0 truncate text-caption text-muted-foreground lg:inline"
					>
						{summary}
					</span>
				) : null}
			</div>
		</TooltipProvider>
	)
}

export function ScheduleToolbar({
	monday,
	currentMonday,
	mainTimeZone,
	onToday,
	onPrevious,
	onNext,
	zone,
	onZoneChange,
}: ScheduleToolbarProps) {
	const labelAt = useMemo(() => zonedInstant(monday, '12:00', mainTimeZone), [monday, mainTimeZone])

	return (
		<div data-slot="schedule-toolbar" className="flex flex-wrap items-center gap-2">
			<Button
				variant="tertiary"
				size="compact"
				className="rounded-full"
				disabled={monday === currentMonday}
				onClick={onToday}
			>
				Today
			</Button>
			<div className="flex items-center gap-1">
				<Tooltip content="Previous week">
					<Button
						variant="ghost"
						size="icon-compact"
						className="rounded-full"
						aria-label="Previous week"
						onClick={onPrevious}
					>
						<ChevronLeft />
					</Button>
				</Tooltip>
				<Tooltip content="Next week">
					<Button variant="ghost" size="icon-compact" className="rounded-full" aria-label="Next week" onClick={onNext}>
						<ChevronRight />
					</Button>
				</Tooltip>
			</div>
			<span data-slot="schedule-period" className="text-title font-semibold text-foreground">
				{periodTitle(monday)}
			</span>
			<div className="ml-auto flex items-center gap-2">
				<TimeZonePicker
					trigger="toolbar"
					value={zone}
					onChange={onZoneChange}
					allowNone
					excludeMain={mainTimeZone}
					labelAt={labelAt}
				/>
			</div>
		</div>
	)
}
