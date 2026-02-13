'use client'

import { DateValue, parseDate } from '@internationalized/date'

import React, { FC, useState } from 'react'
import { DayPicker, DateRange } from 'react-day-picker'
import 'react-day-picker/style.css'

import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateRangeSelectorProps {
	dateRange: { start: DateValue | null; end: DateValue | null }
	onChange: (range: { start: DateValue | null; end: DateValue | null }) => void
}

function dateValueToDate(dv: DateValue | null): Date | undefined {
	if (!dv) return undefined
	return new Date(dv.toString())
}

function dateToDateValue(d: Date): DateValue {
	const iso = d.toISOString().split('T')[0]
	return parseDate(iso)
}

const DateRangeSelector: FC<DateRangeSelectorProps> = ({ dateRange, onChange }) => {
	const [open, setOpen] = useState(false)

	const selected: DateRange = {
		from: dateValueToDate(dateRange.start),
		to: dateValueToDate(dateRange.end),
	}

	const handleSelect = (range: DateRange | undefined) => {
		if (!range) return
		onChange({
			start: range.from ? dateToDateValue(range.from) : null,
			end: range.to ? dateToDateValue(range.to) : null,
		})
	}

	const label =
		selected.from && selected.to
			? `${format(selected.from, 'dd.MM.yyyy')} - ${format(selected.to, 'dd.MM.yyyy')}`
			: selected.from
				? format(selected.from, 'dd.MM.yyyy')
				: 'Выберите даты'

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					className={cn('flex-1 justify-start text-left font-normal', !selected.from && 'text-muted-foreground')}
				>
					<CalendarIcon className="mr-2 h-4 w-4" />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<DayPicker mode="range" selected={selected} onSelect={handleSelect} numberOfMonths={1} />
			</PopoverContent>
		</Popover>
	)
}

export default DateRangeSelector
