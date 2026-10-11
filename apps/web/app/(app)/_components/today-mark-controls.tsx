'use client'

import { useRef, useState } from 'react'

import { Check, ChevronDown, UserX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DropdownContent, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { MenuItem } from '@/components/ui/menu-item'
import { CLEAR_MARK_LABEL, markLabel } from '@/lib/lesson-mark-text'
import { formatTime } from '@/lib/schedule-format'

import type { LessonMarkKind, ScheduleBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, isMarked } from '@dv-lab/core'

import { markLesson } from '../schedule/_components/schedule-mutations'

interface TodayMarkControlsProps {
	block: ScheduleBlock
	onSaved: () => Promise<void>
	onStale: () => Promise<void>
	onError: (failed: boolean) => void
}

const QUICK_MARKS = [
	{ kind: 'done', icon: Check, variant: 'secondary' },
	{ kind: 'no_show', icon: UserX, variant: 'tertiary' },
] as const

export function TodayMarkControls({ block, onSaved, onStale, onError }: TodayMarkControlsProps) {
	const [pending, setPending] = useState<LessonMarkKind | null>(null)
	const saving = useRef(false)

	async function save(kind: LessonMarkKind) {
		if (saving.current) return
		saving.current = true
		setPending(kind)
		onError(false)
		try {
			const result = await markLesson(block, kind)
			if (result.kind === 'failed') onError(true)
			else if (result.kind === 'stale') await onStale()
			else await onSaved()
		} finally {
			saving.current = false
			setPending(null)
		}
	}

	if (!block.actions.mark) return null
	const subject = `${block.studentName}, ${formatTime(new Date(block.startsAt), SCHEDULE_TIME_ZONE)}`
	const disabled = pending !== null
	if (isMarked(block.outcome)) {
		const label = markLabel(block.mark ?? 'none')
		return (
			<DropdownMenu size="compact" disabled={disabled}>
				<DropdownTrigger
					render={
						<Button
							variant="tertiary"
							size="compact"
							leadingIcon={QUICK_MARKS.find((mark) => mark.kind === block.mark)?.icon}
							trailingIcon={ChevronDown}
							loading={disabled}
							aria-label={`${subject}: ${label}. Change the mark`}
						/>
					}
				>
					{label}
				</DropdownTrigger>
				<DropdownContent align="end" className="w-42 min-w-42 bg-surface-4 shadow-surface-4">
					{QUICK_MARKS.map(({ kind }, index) => (
						<MenuItem
							key={kind}
							index={index}
							label={markLabel(kind)}
							icon={Check}
							className={block.mark === kind ? undefined : '[&_svg]:invisible'}
							onSelect={() => void save(kind)}
						/>
					))}
					<DropdownSeparator />
					<MenuItem
						index={2}
						label={CLEAR_MARK_LABEL}
						icon={Check}
						className="[&_svg]:invisible"
						onSelect={() => void save('none')}
					/>
				</DropdownContent>
			</DropdownMenu>
		)
	}
	return (
		<div className="flex shrink-0 items-center gap-2">
			{QUICK_MARKS.map(({ kind, icon, variant }) => (
				<Button
					key={kind}
					variant={variant}
					size="compact"
					leadingIcon={icon}
					loading={pending === kind}
					disabled={disabled}
					aria-label={`Mark ${subject}, as ${markLabel(kind).toLowerCase()}`}
					onClick={() => void save(kind)}
				>
					{markLabel(kind)}
				</Button>
			))}
		</div>
	)
}
