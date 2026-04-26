'use client'

import * as React from 'react'

import { addDays, format, type Locale } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DatePickerProps {
	date?: Date
	onSelect?: (date: Date | undefined) => void
	placeholder?: string
	disabled?: boolean
	showWeekRange?: boolean
	locale?: Locale
	fromYear?: number
	toYear?: number
	className?: string
}

export function DatePicker({
	date,
	onSelect,
	placeholder = 'Select date',
	disabled = false,
	showWeekRange = false,
	locale = ru,
	fromYear = 2020,
	toYear = 2030,
	className,
}: DatePickerProps) {
	const formatDate = (value: Date, formatToken: string) =>
		locale ? format(value, formatToken, { locale }) : format(value, formatToken)

	const getDisplayText = () => {
		if (!date) return <span>{placeholder}</span>

		if (showWeekRange) {
			const weekEnd = addDays(date, 6)
			return `${formatDate(date, 'd MMM')} — ${formatDate(weekEnd, 'd MMM')}`
		}

		return formatDate(date, 'PPP')
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant={'outline'}
					className={cn('justify-start text-left font-normal', !date && 'text-muted-foreground', className)}
					disabled={disabled}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{getDisplayText()}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto overflow-hidden p-0" align="start">
				<Calendar
					mode="single"
					selected={date}
					onSelect={onSelect}
					captionLayout="dropdown"
					locale={locale}
					fromYear={fromYear}
					toYear={toYear}
				/>
			</PopoverContent>
		</Popover>
	)
}

interface DateRangePickerProps {
	range?: DateRange
	onSelect?: (range: DateRange | undefined) => void
	placeholder?: string
	disabled?: boolean
	locale?: Locale
	fromYear?: number
	toYear?: number
	className?: string
}

export function DateRangePicker({
	range,
	onSelect,
	placeholder = 'Select dates',
	disabled = false,
	locale = ru,
	fromYear = 2020,
	toYear = 2030,
	className,
}: DateRangePickerProps) {
	const formatDate = (value: Date, formatToken: string) =>
		locale ? format(value, formatToken, { locale }) : format(value, formatToken)

	const getDisplayText = () => {
		if (!range?.from) return <span>{placeholder}</span>
		if (!range.to) return formatDate(range.from, 'd MMM')
		return `${formatDate(range.from, 'd MMM')} - ${formatDate(range.to, 'd MMM')}`
	}

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn('justify-start text-left font-normal', !range?.from && 'text-muted-foreground', className)}
					disabled={disabled}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{getDisplayText()}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto overflow-hidden p-0" align="start">
				<Calendar
					mode="range"
					selected={range}
					onSelect={onSelect}
					numberOfMonths={2}
					captionLayout="dropdown"
					locale={locale}
					fromYear={fromYear}
					toYear={toYear}
				/>
			</PopoverContent>
		</Popover>
	)
}
