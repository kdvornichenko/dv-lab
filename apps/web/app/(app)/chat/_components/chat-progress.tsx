'use client'

import { useState } from 'react'

import { motion, useReducedMotion } from 'framer-motion'
import { Check, ChevronDown, CircleAlert, LoaderCircle, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { periodText } from '@/lib/lesson-count-text'
import { spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

import type { ChatStep } from '@dv-lab/contracts'

type LineState = ChatStep['state']

type Line = { slot: number; id: string; state: LineState; words: string }

const WAITING = 'Thinking…'

export function stepWords(step: ChatStep): string {
	const name = step.studentName ?? 'the student'
	const possessive = `${name}'s`
	switch (step.tool) {
		case 'find_students':
			return step.studentName === undefined ? 'Looking up students' : `Looking up ${step.studentName}`
		case 'student_facts':
			return `Checking ${possessive} balance and next lesson`
		case 'student_notes':
			return step.studentName === undefined ? 'Reading profile and notes' : `Reading ${possessive} profile and notes`
		case 'lessons':
		case 'lesson_dates':
			if (step.from !== undefined && step.to !== undefined)
				return `Reading lessons from ${periodText(step.from, step.to, ' to ')}`
			return step.tool === 'lesson_dates' ? 'Reading lessons since the last payment' : `Reading ${possessive} lessons`
		case 'mark_lesson':
			return `Marking ${possessive} lesson`
		case 'add_note':
		case 'note_write':
			return `Updating ${possessive} notes`
		case 'note_block_create':
			return 'Creating a notes block'
		case 'note_block_delete':
			return 'Preparing to delete a notes block'
		case 'vocabulary_add':
		case 'vocabulary_remove':
			return `Updating ${possessive} vocabulary`
		case 'add_comment':
			return 'Saving a comment on the lesson'
		case 'propose_lesson_change':
			return 'Preparing a lesson change'
		case 'propose_payment':
			return step.studentName === undefined ? 'Preparing a payment' : `Preparing ${possessive} payment`
		case 'student_payments':
			return step.studentName === undefined ? 'Reading payments' : `Reading ${possessive} payments`
		case 'propose_payment_delete':
			return `Preparing to delete ${possessive} payment`
		case 'propose_student':
			return 'Preparing a new student card'
		case 'propose_rate':
			return `Preparing ${possessive} rate change`
		case 'propose_details':
			return `Changing ${possessive} details`
		case 'propose_archive':
			return `Preparing to archive ${name}`
		case 'propose_entry_removal':
			return 'Preparing to remove a comment'
		case 'propose_bulk_move':
			return `Checking ${possessive} lessons to move`
		case 'calendar_events':
			return 'Searching the calendar'
		case 'essay_feedback':
			return 'Reading the essay'
		case 'answer':
			return 'Writing the answer'
		default:
			return 'Preparing a change'
	}
}

function progressLines(steps: readonly ChatStep[], waiting: boolean): Line[] {
	const lines: Line[] = steps.map((step, slot) => ({
		slot,
		id: step.id,
		state: step.state,
		words: stepWords(step),
	}))
	if (waiting && !lines.some((line) => line.state === 'running'))
		lines.push({ slot: lines.length, id: 'waiting', state: 'running', words: WAITING })
	return lines
}

export function hasStepsRow(steps: readonly ChatStep[]): boolean {
	return steps.length > 0 && !(steps.length === 1 && steps[0]?.tool === 'answer')
}

const SHIMMER =
	'animate-[shimmer_1.6s_linear_infinite] bg-clip-text bg-[length:250%_100%] bg-[linear-gradient(90deg,var(--foreground)_0%,var(--foreground)_38%,color-mix(in_oklab,var(--foreground)_28%,var(--background))_50%,var(--foreground)_62%,var(--foreground)_100%)] text-transparent motion-reduce:animate-none motion-reduce:bg-none motion-reduce:text-foreground'

function Glyph({ state }: { state: LineState }) {
	return (
		<span aria-hidden className="animate-in fade-in-0 flex h-5 w-4 shrink-0 items-center justify-center duration-120">
			{state === 'running' ? (
				<>
					<LoaderCircle size={14} className="animate-spin text-foreground motion-reduce:hidden" />
					<span className="hidden size-1.5 rounded-full bg-foreground motion-reduce:block" />
				</>
			) : state === 'done' ? (
				<Check size={14} className="text-muted-foreground" />
			) : state === 'failed' ? (
				<CircleAlert size={14} className="text-destructive" />
			) : (
				<Square size={10} className="fill-current text-muted-foreground" />
			)}
		</span>
	)
}

function StepLine({ line, reduceMotion }: { line: Line; reduceMotion: boolean }) {
	return (
		<motion.li
			data-slot="chat-step"
			data-state={line.state}
			className="flex items-start gap-2 text-body"
			initial={reduceMotion ? false : { opacity: 0, y: 4 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ type: 'spring', duration: spring.moderate.duration, bounce: 0 }}
		>
			<Glyph key={line.state} state={line.state} />
			<span className="min-w-0 flex-1 leading-5 wrap-break-word">
				<span className={cn(line.state === 'running' ? SHIMMER : 'text-muted-foreground')}>{line.words}</span>
				{line.state === 'failed' ? <span className="ml-2 text-caption text-destructive">Failed</span> : null}
				{line.state === 'stopped' ? <span className="ml-2 text-caption text-muted-foreground">Stopped</span> : null}
			</span>
		</motion.li>
	)
}

export function ChatProgress({
	steps,
	live,
	hasText,
}: {
	steps: readonly ChatStep[]
	live: boolean
	hasText: boolean
}) {
	const reduceMotion = useReducedMotion() ?? false
	const [expanded, setExpanded] = useState(false)
	const lines = progressLines(steps, live && !hasText)
	const folded = hasText
	if (lines.length === 0 || (folded && !hasStepsRow(steps))) return null
	const open = !folded || expanded
	return (
		<div data-slot="chat-progress" data-folded={folded ? '' : undefined} className="flex flex-col">
			{folded ? (
				<Button
					variant="ghost"
					size="compact"
					aria-expanded={expanded}
					className="-ml-2 self-start text-caption whitespace-nowrap text-muted-foreground pointer-coarse:h-8"
					onClick={() => setExpanded((value) => !value)}
				>
					<span className="inline-flex flex-nowrap items-center gap-1 whitespace-nowrap">
						{expanded ? 'Hide steps' : 'Show steps'}
						<ChevronDown
							size={12}
							aria-hidden
							className={cn('shrink-0 transition-transform duration-120', expanded && 'rotate-180')}
						/>
					</span>
				</Button>
			) : null}
			<div
				className={cn(
					'grid transition-[grid-template-rows,opacity] duration-160 ease-out motion-reduce:transition-none',
					open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
					folded && open && 'pt-1'
				)}
			>
				<div className="min-h-0 overflow-hidden" inert={!open} aria-hidden={!open || undefined}>
					<ul role="status" className="flex flex-col gap-1">
						{lines.map((line) => (
							<StepLine key={line.slot} line={line} reduceMotion={reduceMotion} />
						))}
					</ul>
				</div>
			</div>
		</div>
	)
}
