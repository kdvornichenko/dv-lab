import type { StatusTone } from '@/components/app/status-dot'
import { formatDayMonth } from '@/lib/schedule-format'

import type { LessonMarkKind, ScheduleBlock, ScheduleLessonOutcome } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, awaitsMark, lessonsPhrase, markEffect, type MarkEffect } from '@dv-lab/core'

export type OccurrenceSlot = 'from' | 'to'

export type StatusKey = ScheduleLessonOutcome | 'needs_mark'

type StatusBlock = Pick<ScheduleBlock, 'outcome' | 'startsAt' | 'movedTo'>

const STATUS: Record<StatusKey, { word: string; label: string; tone: StatusTone; dated: boolean }> = {
	planned: { word: 'Planned', label: 'planned', tone: 'blue', dated: false },
	needs_mark: { word: 'Needs a mark', label: 'needs a mark', tone: 'amber', dated: false },
	done: { word: 'Done', label: 'done', tone: 'gray', dated: false },
	no_show: { word: 'No-show', label: 'no-show', tone: 'gray', dated: false },
	cancelled: { word: 'Cancelled', label: 'cancelled', tone: 'red', dated: false },
	moved: { word: 'Moved', label: 'moved', tone: 'amber', dated: true },
}

const SLOT: Record<ScheduleLessonOutcome, OccurrenceSlot> = {
	planned: 'to',
	done: 'to',
	no_show: 'to',
	cancelled: 'to',
	moved: 'from',
}

const MARK_LABEL: Record<LessonMarkKind, string> = {
	none: 'Scheduled',
	done: 'Done',
	no_show: 'No-show',
}

export const PILL_ORDER = ['none', 'done', 'no_show'] as const satisfies readonly LessonMarkKind[]

export function occurrenceSlot(outcome: ScheduleLessonOutcome): OccurrenceSlot {
	return SLOT[outcome]
}

export function statusKey(block: Pick<StatusBlock, 'outcome' | 'startsAt'>, now: Date): StatusKey {
	return awaitsMark(block.outcome, new Date(block.startsAt), now) ? 'needs_mark' : block.outcome
}

export function movedDate(block: Pick<StatusBlock, 'movedTo'>): string | null {
	return block.movedTo === null ? null : formatDayMonth(new Date(block.movedTo), SCHEDULE_TIME_ZONE)
}

function withDate(text: string, dated: boolean, block: Pick<StatusBlock, 'movedTo'>): string {
	const date = movedDate(block)
	return dated && date !== null ? `${text} to ${date}` : text
}

export function statusWord(block: StatusBlock, now: Date, dated = true): string {
	const entry = STATUS[statusKey(block, now)]
	return withDate(entry.word, entry.dated && dated, block)
}

export function statusLabel(block: StatusBlock, now: Date): string {
	const entry = STATUS[statusKey(block, now)]
	return withDate(entry.label, entry.dated, block)
}

export function statusTone(block: StatusBlock, now: Date): StatusTone {
	return STATUS[statusKey(block, now)].tone
}

export function markLabel(kind: LessonMarkKind): string {
	return MARK_LABEL[kind]
}

export function blockEffect(
	block: Pick<ScheduleBlock, 'outcome' | 'startsAt' | 'durationMinutes' | 'ledger'>,
	now: Date
): MarkEffect {
	return markEffect({
		outcome: block.outcome,
		startsAt: new Date(block.startsAt),
		durationMinutes: block.durationMinutes,
		now,
		card: { openingOn: block.ledger.openingOn, noShowDeducts: block.ledger.noShowDeducts },
	})
}

function isoDayMonth(date: string): string {
	return formatDayMonth(new Date(`${date}T12:00:00Z`), 'UTC')
}

export function markHelp(effect: MarkEffect, lessonMinutes: number, movedTo: string | null): string {
	switch (effect.kind) {
		case 'not_started':
			return 'You can mark a lesson once it has started.'
		case 'unmarked':
			return 'Not marked yet. Nothing is deducted until you mark it.'
		case 'no_opening':
			return 'Not counted: this student has no opening balance yet.'
		case 'before_opening':
			return `Not counted: it falls on or before the opening balance date (${isoDayMonth(effect.openingOn)}).`
		case 'no_show_off':
			return 'Deducts nothing: No-show deducts a lesson is off for this student.'
		case 'deducts':
			return `Deducts ${lessonsPhrase(effect.minutes, lessonMinutes)} (${effect.minutes} min).`
		case 'cancelled':
			return 'Cancelled lessons deduct nothing. The mark is kept and counts again if you return the lesson to the schedule.'
		case 'moved':
			return `This lesson was moved to ${movedTo ?? 'a new time'}, so nothing is deducted here. Mark it at its new time.`
	}
}

export function tooltipDeduction(effect: MarkEffect, lessonMinutes: number): string | null {
	switch (effect.kind) {
		case 'unmarked':
			return 'Click to mark it.'
		case 'no_opening':
		case 'before_opening':
		case 'no_show_off':
			return 'Deducts nothing'
		case 'deducts':
			return `Deducts ${lessonsPhrase(effect.minutes, lessonMinutes)}`
		case 'not_started':
		case 'cancelled':
		case 'moved':
			return null
	}
}
