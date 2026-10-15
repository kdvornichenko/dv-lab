'use client'

import { useEffect, useEffectEvent, useState, type ReactNode, type Ref } from 'react'
import { enUS } from 'react-day-picker/locale'

import { m } from 'motion/react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar as DayCalendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipProvider } from '@/components/ui/tooltip'
import { calendarLesson } from '@/lib/lesson-actions'
import { dayNumber, weekTitle } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type { CalendarEventView } from '@dv-lab/contracts'
import { addDays, lessonDay, mondayOf } from '@dv-lab/core'

interface WeekNavigation {
	monday: string
	currentMonday: string
	onToday: () => void
	onPrevious: () => void
	onNext: () => void
}

export const TOOLBAR_BUTTONS = '[&_button]:rounded-md [&_button]:[--border:var(--input)]'

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
				className="absolute inset-x-0 top-[7px] text-center text-[8px] leading-[10px] font-bold tabular-nums"
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

function WeekPicker({
	monday,
	onWeek,
	compact,
}: {
	monday: string
	onWeek: (monday: string) => void
	compact: boolean
}) {
	const [open, setOpen] = useState(false)
	const week = { from: localDate(monday), to: localDate(addDays(monday, 6)) }
	return (
		<Popover open={open} onOpenChange={setOpen}>
			<BarTip name="Choose week">
				<PopoverTrigger
					render={
						<Button
							variant="secondary"
							size="compact"
							aria-label={`Choose week, ${weekTitle(monday)}`}
							data-slot="schedule-week-picker"
							className={cn(
								'font-semibold whitespace-nowrap text-foreground tabular-nums',
								compact ? 'w-auto min-w-0 px-1.5 text-[13px]' : 'w-44 shrink-0 text-title'
							)}
						>
							{compact ? (
								<m.span
									key={weekTitle(monday)}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ duration: 0.08 }}
								>
									{weekTitle(monday)}
								</m.span>
							) : (
								weekTitle(monday)
							)}
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
	compact = false,
}: WeekNavigation & {
	today: string
	summary: ReactNode
	titleRef: Ref<HTMLHeadingElement>
	heading?: boolean
	compact?: boolean
	onWeek: (monday: string) => void
}) {
	const week = (
		<>
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
					<WeekPicker monday={monday} onWeek={onWeek} compact={false} />
				</h1>
			) : (
				<div data-slot="schedule-period" className="min-w-0 shrink">
					<WeekPicker monday={monday} onWeek={onWeek} compact={compact} />
				</div>
			)}
			<BarTip name="Next week" shortcut="J">
				<Button variant="tertiary" size="icon-compact" aria-label="Next week" onClick={onNext}>
					<ChevronRight />
				</Button>
			</BarTip>
		</>
	)
	return (
		<TooltipProvider>
			<div
				data-slot="schedule-toolbar"
				className={cn(
					'flex min-w-0 items-center',
					TOOLBAR_BUTTONS,
					compact ? 'flex-1 gap-1' : 'gap-2 pointer-coarse:gap-4'
				)}
			>
				<BarTip name="Today" shortcut="T">
					<Button
						variant="tertiary"
						size="icon-compact"
						aria-label="Today"
						disabled={monday === currentMonday}
						className={compact ? 'disabled:opacity-100' : undefined}
						onClick={onToday}
					>
						<TodayIcon today={dayNumber(today)} />
					</Button>
				</BarTip>
				{compact ? (
					<div data-slot="schedule-week-group" className="mx-1 flex min-w-0 items-center gap-0.5">
						{week}
					</div>
				) : (
					week
				)}
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
