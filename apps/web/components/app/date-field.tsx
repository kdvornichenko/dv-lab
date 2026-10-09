'use client'

import { useState } from 'react'
import { enUS } from 'react-day-picker/locale'

import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' })

function toDate(value: string) {
	const [y, m, d] = value.split('-').map(Number)
	return new Date(y, m - 1, d)
}

function fromDate(value: Date) {
	const m = String(value.getMonth() + 1).padStart(2, '0')
	const d = String(value.getDate()).padStart(2, '0')
	return `${value.getFullYear()}-${m}-${d}`
}

interface DateFieldProps {
	id: string
	label: string
	value: string
	onChange: (value: string) => void
	max?: string
	error?: string
	helper?: string
	disabled?: boolean
}

export function DateField({ id, label, value, onChange, max, error, helper, disabled }: DateFieldProps) {
	const [open, setOpen] = useState(false)
	const text = dateFormat.format(toDate(value))
	const errorId = `${id}-error`
	const helperId = `${id}-helper`
	const describedBy = error ? errorId : helper ? helperId : undefined

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<span className="text-body text-muted-foreground">{label}</span>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					id={id}
					disabled={disabled}
					aria-label={`${label}: ${text}`}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy}
					render={
						<Button variant="tertiary" leadingIcon={CalendarDays} className="h-9 w-full justify-start px-2 text-body" />
					}
				>
					{text}
				</PopoverTrigger>
				<PopoverContent align="start" className="w-auto p-0">
					<Calendar
						mode="single"
						locale={enUS}
						weekStartsOn={1}
						selected={toDate(value)}
						defaultMonth={toDate(value)}
						disabled={max ? { after: toDate(max) } : undefined}
						onSelect={(next) => {
							if (!next) return
							onChange(fromDate(next))
							setOpen(false)
						}}
					/>
				</PopoverContent>
			</Popover>
			{error ? (
				<p id={errorId} className="text-caption text-destructive">
					{error}
				</p>
			) : helper ? (
				<p id={helperId} className="text-caption text-muted-foreground">
					{helper}
				</p>
			) : null}
		</div>
	)
}
