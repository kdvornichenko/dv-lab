'use client'

import { useEffect, useEffectEvent, type ReactNode } from 'react'

import { ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import { periodTitle } from '@/lib/schedule-format'

interface ScheduleToolbarProps {
	monday: string
	currentMonday: string
	onToday: () => void
	onPrevious: () => void
	onNext: () => void
	zoneControl?: ReactNode
}

const FIELD_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"]'

function typingTarget(target: EventTarget | null): boolean {
	return target instanceof Element && target.closest(FIELD_SELECTOR) !== null
}

export function ScheduleToolbar({
	monday,
	currentMonday,
	onToday,
	onPrevious,
	onNext,
	zoneControl,
}: ScheduleToolbarProps) {
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
				{zoneControl}
				<Select value="week" size="compact">
					<SelectTrigger aria-label="Calendar view" className="w-28 min-w-0 rounded-full" />
					<SelectContent>
						<SelectItem index={0} value="week">
							Week
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}
