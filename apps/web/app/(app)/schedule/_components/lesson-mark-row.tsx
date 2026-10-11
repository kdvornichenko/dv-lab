'use client'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'

import { PILL_ORDER, blockEffect, markHelp, markLabel, movedDate } from '@/lib/lesson-mark-text'
import { cn } from '@/lib/utils'

import type { LessonMarkKind, ScheduleBlock } from '@dv-lab/contracts'

interface LessonMarkRowProps {
	block: ScheduleBlock
	now: Date
	saving: LessonMarkKind | null
	locked: boolean
	onChoose: (kind: LessonMarkKind) => void
}

const PILL_CLASS =
	'inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-body whitespace-nowrap shadow-[inset_0_0_0_1px_var(--input)] outline-none focus-visible:ring-2 focus-visible:ring-focus-ring data-checked:bg-active data-checked:font-semibold data-checked:shadow-none data-disabled:cursor-default'

export function LessonMarkRow({ block, now, saving, locked, onChoose }: LessonMarkRowProps) {
	const available = block.actions.mark
	const selected: LessonMarkKind = saving ?? block.mark ?? 'none'
	const help =
		saving !== null ? 'Saving…' : markHelp(blockEffect(block, now), block.ledger.lessonMinutes, movedDate(block))
	return (
		<div data-slot="lesson-mark-row" className="flex flex-col gap-2">
			<span id="lesson-mark-label" className="text-body text-muted-foreground">
				Mark
			</span>
			<RadioGroup
				aria-labelledby="lesson-mark-label"
				value={selected}
				disabled={!available || saving !== null || locked}
				onValueChange={(value) => onChoose(value)}
				className={cn('flex gap-2', !available && 'opacity-50')}
			>
				{PILL_ORDER.map((kind) => (
					<Radio.Root key={kind} value={kind} aria-label={markLabel(kind)} className={PILL_CLASS}>
						{markLabel(kind)}
					</Radio.Root>
				))}
			</RadioGroup>
			<p data-slot="lesson-mark-help" className="text-caption text-muted-foreground">
				{help}
			</p>
		</div>
	)
}
