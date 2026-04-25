'use client'

import * as React from 'react'

import { addDays, format, type Locale } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'

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
}

export function DatePicker({
	date,
	onSelect,
	placeholder = 'Select date',
	disabled = false,
	showWeekRange = false,
	locale,
	fromYear = 2020,
	toYear = 2030,
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
					className={cn('justify-start text-left font-normal', !date && 'text-muted-foreground')}
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
