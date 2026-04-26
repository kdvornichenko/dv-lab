'use client'

import type { MouseEvent, ReactNode } from 'react'
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { VariantProps, cva } from 'class-variance-authority'
import {
	Locale,
	addDays,
	addMonths,
	addWeeks,
	addYears,
	differenceInMinutes,
	format,
	getMonth,
	isSameDay,
	isSameHour,
	isSameMonth,
	isToday,
	setHours,
	setMonth,
	startOfMonth,
	startOfWeek,
	subDays,
	subMonths,
	subWeeks,
	subYears,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { ScrollArea } from '../ui/scroll-area'

const monthEventVariants = cva('size-2 rounded-full', {
	variants: {
		variant: {
			default: 'bg-sage',
			blue: 'bg-chart',
			green: 'bg-success',
			pink: 'bg-danger',
			purple: 'bg-warning',
		},
	},
	defaultVariants: {
		variant: 'default',
	},
})

const dayEventVariants = cva(
	'rounded-lg border-l-4 p-2 text-xs font-semibold shadow-[0_12px_34px_-30px_var(--shadow-sage)]',
	{
		variants: {
			variant: {
				default: 'border-sage bg-sage-soft text-ink',
				blue: 'border-chart bg-surface-muted text-ink',
				green: 'border-success bg-success-soft text-ink',
				pink: 'border-danger bg-danger-soft text-ink',
				purple: 'border-warning bg-warning-soft text-ink',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
)

type View = 'day' | 'week' | 'month' | 'year'

type ContextType = {
	view: View
	setView: (view: View) => void
	date: Date
	setDate: (date: Date) => void
	events: CalendarEvent[]
	locale: Locale
	setEvents: (date: CalendarEvent[]) => void
	onChangeView?: (view: View) => void
	onEventClick?: (event: CalendarEvent) => void
	onTimeSlotClick?: (date: Date) => void
	enableHotkeys?: boolean
	today: Date
}

const Context = createContext<ContextType>({} as ContextType)

export type CalendarEvent = {
	id: string
	start: Date
	end: Date
	title: string
	color?: VariantProps<typeof monthEventVariants>['variant']
}

type CalendarProps = {
	children: ReactNode
	defaultDate?: Date
	events?: CalendarEvent[]
	view?: View
	locale?: Locale
	enableHotkeys?: boolean
	onChangeView?: (view: View) => void
	onEventClick?: (event: CalendarEvent) => void
	onTimeSlotClick?: (date: Date) => void
}

const Calendar = ({
	children,
	defaultDate = new Date(),
	locale = ru,
	enableHotkeys = true,
	view: _defaultMode = 'week',
	onEventClick,
	onTimeSlotClick,
	events: defaultEvents = [],
	onChangeView,
}: CalendarProps) => {
	const [view, setView] = useState<View>(_defaultMode)
	const [date, setDate] = useState(defaultDate)
	const [events, setEvents] = useState<CalendarEvent[]>(defaultEvents)

	useEffect(() => {
		setEvents(defaultEvents)
	}, [defaultEvents])

	const changeView = (view: View) => {
		setView(view)
		onChangeView?.(view)
	}

	useHotkeys('m', () => changeView('month'), {
		enabled: enableHotkeys,
	})

	useHotkeys('w', () => changeView('week'), {
		enabled: enableHotkeys,
	})

	useHotkeys('y', () => changeView('year'), {
		enabled: enableHotkeys,
	})

	useHotkeys('d', () => changeView('day'), {
		enabled: enableHotkeys,
	})

	return (
		<Context.Provider
			value={{
				view,
				setView,
				date,
				setDate,
				events,
				setEvents,
				locale,
				enableHotkeys,
				onEventClick,
				onTimeSlotClick,
				onChangeView,
				today: new Date(),
			}}
		>
			{children}
		</Context.Provider>
	)
}

export const useCalendar = () => useContext(Context)

const CalendarViewTrigger = forwardRef<
	HTMLButtonElement,
	React.HTMLAttributes<HTMLButtonElement> & {
		view: View
	}
>(({ children, view, ...props }, ref) => {
	const { view: currentView, setView, onChangeView } = useCalendar()

	return (
		<Button
			ref={ref}
			aria-current={currentView === view}
			size="sm"
			variant="ghost"
			{...props}
			onClick={() => {
				setView(view)
				onChangeView?.(view)
			}}
		>
			{children}
		</Button>
	)
})
CalendarViewTrigger.displayName = 'CalendarViewTrigger'

function timeSlotFromPointer(hour: Date, event: MouseEvent<HTMLButtonElement>) {
	if (event.detail === 0) return hour
	const rect = event.currentTarget.getBoundingClientRect()
	const offset = event.clientY - rect.top
	const ratio = Math.min(0.999, Math.max(0, offset / rect.height))
	const minutes = Math.floor((ratio * 60) / 15) * 15
	const startsAt = new Date(hour)
	startsAt.setMinutes(minutes, 0, 0)
	return startsAt
}

const EventGroup = ({ events, hour }: { events: CalendarEvent[]; hour: Date }) => {
	const { onEventClick, onTimeSlotClick } = useCalendar()

	return (
		<div className="group/hour border-line-soft relative h-20 border-t last:border-b">
			<button
				type="button"
				className="hover:bg-sage-soft/55 focus-visible:bg-sage-soft/70 focus-visible:ring-sage/35 absolute inset-0 z-0 text-left transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2"
				onClick={(event) => onTimeSlotClick?.(timeSlotFromPointer(hour, event))}
				aria-label={`Add lesson at ${format(hour, 'HH:mm')}`}
			>
				<span className="border-line bg-surface text-sage pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold opacity-0 shadow-sm transition-opacity group-focus-within/hour:opacity-100 group-hover/hour:opacity-100">
					<Plus className="h-3 w-3" />
					Add
				</span>
			</button>
			{events
				.filter((event) => isSameHour(event.start, hour))
				.map((event) => {
					const hoursDifference = differenceInMinutes(event.end, event.start) / 60
					const startPosition = event.start.getMinutes() / 60

					return (
						<div
							key={event.id}
							className={cn(
								'absolute inset-x-1 z-10 cursor-pointer overflow-hidden',
								dayEventVariants({ variant: event.color })
							)}
							onClick={(clickEvent) => {
								clickEvent.stopPropagation()
								onEventClick?.(event)
							}}
							style={{
								top: `${startPosition * 100}%`,
								height: `${hoursDifference * 100}%`,
							}}
						>
							{event.title}
						</div>
					)
				})}
		</div>
	)
}

const CalendarDayView = () => {
	const { view, events, date } = useCalendar()

	if (view !== 'day') return null

	const hours = [...Array(24)].map((_, i) => setHours(date, i))

	return (
		<ScrollArea className="bg-surface font-body text-ink relative h-full">
			<div className="flex min-w-0 pt-2">
				<TimeTable />
				<div className="min-w-0 flex-1">
					{hours.map((hour) => (
						<EventGroup key={hour.toString()} hour={hour} events={events} />
					))}
				</div>
			</div>
		</ScrollArea>
	)
}

const CalendarWeekView = () => {
	const { view, date, locale, events } = useCalendar()

	const weekDates = useMemo(() => {
		const start = startOfWeek(date, { weekStartsOn: 1 })
		const weekDates = []

		for (let i = 0; i < 7; i++) {
			const day = addDays(start, i)
			const hours = [...Array(24)].map((_, i) => setHours(day, i))
			weekDates.push(hours)
		}

		return weekDates
	}, [date])

	const headerDays = useMemo(() => {
		const daysOfWeek = []
		for (let i = 0; i < 7; i++) {
			const result = addDays(startOfWeek(date, { weekStartsOn: 1 }), i)
			daysOfWeek.push(result)
		}
		return daysOfWeek
	}, [date])

	if (view !== 'week') return null

	return (
		<ScrollArea className="bg-surface font-body text-ink relative flex h-full flex-col">
			<div className="border-line-soft bg-surface sticky top-0 z-10 mb-1 flex border-b pt-2">
				<div className="w-12"></div>
				{headerDays.map((date, i) => (
					<div
						key={date.toString()}
						className={cn(
							'text-ink-muted flex flex-1 items-center justify-center gap-1 pb-2 text-center text-sm',
							[5, 6].includes(i) && 'text-ink-muted'
						)}
					>
						<span className="text-ink-muted font-medium">{format(date, 'EEE', { locale })}</span>
						<span
							className={cn(
								'grid h-6 place-content-center',
								isToday(date) && 'bg-sage text-primary-foreground size-6 rounded-full font-semibold'
							)}
						>
							{format(date, 'd')}
						</span>
					</div>
				))}
			</div>
			<div className="flex flex-1">
				<div className="w-fit">
					<TimeTable />
				</div>
				<div className="grid flex-1 grid-cols-7">
					{weekDates.map((hours, i) => {
						return (
							<div
								className={cn(
									'border-line-soft text-ink-muted h-full border-l text-sm first:border-l-0',
									[5, 6].includes(i) && 'bg-surface-muted/45'
								)}
								key={hours[0].toString()}
							>
								{hours.map((hour) => (
									<EventGroup key={hour.toString()} hour={hour} events={events} />
								))}
							</div>
						)
					})}
				</div>
			</div>
		</ScrollArea>
	)
}

const CalendarMonthView = () => {
	const { date, view, events, locale, setDate, setView, onChangeView, onEventClick } = useCalendar()

	const monthDates = useMemo(() => getDaysInMonth(date), [date])
	const weekDays = useMemo(() => generateWeekdays(locale), [locale])

	if (view !== 'month') return null

	return (
		<div className="bg-surface font-body text-ink flex h-full flex-col">
			<div className="border-line-soft bg-surface sticky top-0 grid grid-cols-7 gap-px border-b">
				{weekDays.map((day, i) => (
					<div
						key={day}
						className={cn(
							'text-ink-muted mb-2 pr-2 text-right text-sm font-medium',
							[5, 6].includes(i) && 'text-ink-muted/70'
						)}
					>
						{day}
					</div>
				))}
			</div>
			<div className="-mt-px grid flex-1 auto-rows-fr grid-cols-7 gap-px overflow-hidden p-px">
				{monthDates.map((_date) => {
					const currentEvents = events.filter((event) => isSameDay(event.start, _date))
					const openWeek = () => {
						setDate(_date)
						setView('week')
						onChangeView?.('week')
					}

					return (
						<div
							role="button"
							tabIndex={0}
							className={cn(
								'text-ink-muted ring-line-soft hover:bg-sage-soft/45 focus-visible:bg-sage-soft/60 focus-visible:ring-sage/35 overflow-auto p-2 text-sm ring-1 transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2',
								!isSameMonth(date, _date) && 'bg-surface-muted/35 text-ink-muted/70'
							)}
							key={_date.toString()}
							onClick={openWeek}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault()
									openWeek()
								}
							}}
						>
							<span
								className={cn(
									'sticky top-0 mb-1 grid size-6 place-items-center rounded-full',
									isToday(_date) && 'bg-sage text-primary-foreground'
								)}
							>
								{format(_date, 'd')}
							</span>

							{currentEvents.map((event) => {
								return (
									<button
										key={event.id}
										type="button"
										className="hover:bg-surface-muted flex w-full items-center gap-1 rounded px-1 text-left text-sm"
										onClick={(clickEvent) => {
											clickEvent.stopPropagation()
											onEventClick?.(event)
										}}
									>
										<div className={cn('shrink-0', monthEventVariants({ variant: event.color }))}></div>
										<span className="flex-1 truncate">{event.title}</span>
										<time className="text-ink-muted font-mono text-xs tabular-nums">
											{format(event.start, 'HH:mm')}
										</time>
									</button>
								)
							})}
						</div>
					)
				})}
			</div>
		</div>
	)
}

const CalendarYearView = () => {
	const { view, date, today, locale } = useCalendar()

	const months = useMemo(() => {
		if (!view) {
			return []
		}

		return Array.from({ length: 12 }).map((_, i) => {
			return getDaysInMonth(setMonth(date, i))
		})
	}, [date, view])

	const weekDays = useMemo(() => generateWeekdays(locale), [locale])

	if (view !== 'year') return null

	return (
		<div className="bg-surface font-body text-ink grid h-full grid-cols-4 gap-10 overflow-auto">
			{months.map((days, i) => (
				<div key={days[0].toString()}>
					<span className="text-xl">{i + 1}</span>

					<div className="my-5 grid grid-cols-7 gap-2">
						{weekDays.map((day) => (
							<div key={day} className="text-ink-muted text-center text-xs">
								{day}
							</div>
						))}
					</div>

					<div className="grid grid-cols-7 gap-x-2 text-center text-xs tabular-nums">
						{days.map((_date) => {
							return (
								<div key={_date.toString()} className={cn(getMonth(_date) !== i && 'text-ink-muted/60')}>
									<div
										className={cn(
											'grid aspect-square size-full place-content-center tabular-nums',
											isSameDay(today, _date) && getMonth(_date) === i && 'bg-sage text-primary-foreground rounded-full'
										)}
									>
										{format(_date, 'd')}
									</div>
								</div>
							)
						})}
					</div>
				</div>
			))}
		</div>
	)
}

const CalendarNextTrigger = forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
	({ children, onClick, ...props }, ref) => {
		const { date, setDate, view, enableHotkeys } = useCalendar()

		const next = useCallback(() => {
			if (view === 'day') {
				setDate(addDays(date, 1))
			} else if (view === 'week') {
				setDate(addWeeks(date, 1))
			} else if (view === 'month') {
				setDate(addMonths(date, 1))
			} else if (view === 'year') {
				setDate(addYears(date, 1))
			}
		}, [date, view, setDate])

		useHotkeys('ArrowRight', () => next(), {
			enabled: enableHotkeys,
		})

		return (
			<Button
				size="icon"
				variant="outline"
				ref={ref}
				{...props}
				onClick={(e) => {
					next()
					onClick?.(e)
				}}
			>
				{children}
			</Button>
		)
	}
)
CalendarNextTrigger.displayName = 'CalendarNextTrigger'

const CalendarPrevTrigger = forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
	({ children, onClick, ...props }, ref) => {
		const { date, setDate, view, enableHotkeys } = useCalendar()

		useHotkeys('ArrowLeft', () => prev(), {
			enabled: enableHotkeys,
		})

		const prev = useCallback(() => {
			if (view === 'day') {
				setDate(subDays(date, 1))
			} else if (view === 'week') {
				setDate(subWeeks(date, 1))
			} else if (view === 'month') {
				setDate(subMonths(date, 1))
			} else if (view === 'year') {
				setDate(subYears(date, 1))
			}
		}, [date, view, setDate])

		return (
			<Button
				size="icon"
				variant="outline"
				ref={ref}
				{...props}
				onClick={(e) => {
					prev()
					onClick?.(e)
				}}
			>
				{children}
			</Button>
		)
	}
)
CalendarPrevTrigger.displayName = 'CalendarPrevTrigger'

const CalendarTodayTrigger = forwardRef<HTMLButtonElement, React.HTMLAttributes<HTMLButtonElement>>(
	({ children, onClick, ...props }, ref) => {
		const { setDate, enableHotkeys, today } = useCalendar()

		useHotkeys('t', () => jumpToToday(), {
			enabled: enableHotkeys,
		})

		const jumpToToday = useCallback(() => {
			setDate(today)
		}, [today, setDate])

		return (
			<Button
				variant="outline"
				ref={ref}
				{...props}
				onClick={(e) => {
					jumpToToday()
					onClick?.(e)
				}}
			>
				{children}
			</Button>
		)
	}
)
CalendarTodayTrigger.displayName = 'CalendarTodayTrigger'

const CalendarCurrentDate = () => {
	const { date, locale, view } = useCalendar()

	return (
		<time dateTime={date.toISOString()} className="font-heading text-ink tabular-nums">
			{format(date, view === 'day' ? 'dd MMMM yyyy' : 'LLLL yyyy', { locale })}
		</time>
	)
}

const TimeTable = () => {
	const now = new Date()

	return (
		<div className="w-12 pr-2 font-mono">
			{Array.from(Array(25).keys()).map((hour) => {
				return (
					<div className="text-ink-muted relative h-20 text-right text-xs last:h-0" key={hour}>
						{now.getHours() === hour && (
							<div
								className="bg-danger absolute left-full z-10 h-0.5 w-[calc(100dvw-20rem)] translate-x-2"
								style={{
									top: `${(now.getMinutes() / 60) * 100}%`,
								}}
							>
								<div className="bg-danger absolute left-0 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"></div>
							</div>
						)}
						<p className="top-0 -translate-y-1/2">{hour === 24 ? 0 : hour}:00</p>
					</div>
				)
			})}
		</div>
	)
}

const getDaysInMonth = (date: Date) => {
	const startOfMonthDate = startOfMonth(date)
	const startOfWeekForMonth = startOfWeek(startOfMonthDate, {
		weekStartsOn: 1,
	})

	let currentDate = startOfWeekForMonth
	const calendar = []

	while (calendar.length < 42) {
		calendar.push(new Date(currentDate))
		currentDate = addDays(currentDate, 1)
	}

	return calendar
}

const generateWeekdays = (locale: Locale) => {
	const daysOfWeek = []
	for (let i = 0; i < 7; i++) {
		const date = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
		daysOfWeek.push(format(date, 'EEEEEE', { locale }))
	}
	return daysOfWeek
}

export {
	Calendar,
	CalendarCurrentDate,
	CalendarDayView,
	CalendarMonthView,
	CalendarNextTrigger,
	CalendarPrevTrigger,
	CalendarTodayTrigger,
	CalendarViewTrigger,
	CalendarWeekView,
	CalendarYearView,
}
