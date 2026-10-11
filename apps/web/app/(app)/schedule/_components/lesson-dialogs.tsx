'use client'

import { useState } from 'react'

import { calendarEventFor, type CalendarLesson } from '@/lib/lesson-actions'
import { occurrenceSlot, type OccurrenceSlot } from '@/lib/lesson-mark-text'

import type { GoogleScheduleWindow, LessonMarkKind, ScheduleBlock, ScheduleSeries } from '@dv-lab/contracts'

import { CalendarLessonDialog } from './calendar-lesson-dialog'
import { LessonDialog, type ActionOutcome, type PairTarget } from './lesson-dialog'
import type { OverlapBlock } from './new-lesson-dialog'
import { markLesson } from './schedule-mutations'

export type LessonSelection = { key: string; slot: OccurrenceSlot }

type Props = {
	selection: LessonSelection | null
	selected: ScheduleBlock | null
	series: readonly ScheduleSeries[]
	calendar: GoogleScheduleWindow | null
	now: Date
	mainTimeZone: string
	currentMainTimeZone: string
	asOf: string
	secondZone: string | null
	blocksOn: (date: string) => Promise<OverlapBlock[] | null>
	reload: () => Promise<void>
	onClose: (target: LessonSelection | null) => void
	onOpenPair: (target: PairTarget) => void
}

function useSelectedLesson({ selected, selection, calendar, now }: Props) {
	const [snapshot, setSnapshot] = useState<{ block: ScheduleBlock; event: CalendarLesson | null } | null>(null)
	if (selection === null) {
		if (snapshot !== null) setSnapshot(null)
		return null
	}
	if (selected !== null && selected !== snapshot?.block) {
		const current = calendar === null ? null : (calendarEventFor(calendar, selected.ref) ?? null)
		const event = new Date(selected.startsAt) > now ? current : null
		setSnapshot({ block: selected, event: event ?? (snapshot?.block.key === selected.key ? snapshot.event : null) })
	}
	return snapshot?.block.key === selection.key && occurrenceSlot(snapshot.block.outcome) === selection.slot
		? snapshot
		: null
}

export function LessonDialogs(props: Props) {
	const { series, calendar, reload, onClose } = props
	const snapshot = useSelectedLesson(props)
	if (snapshot === null) return null
	const shown = snapshot.block
	const target = { key: shown.key, slot: occurrenceSlot(shown.outcome) }
	const event = calendar === null ? null : (calendarEventFor(calendar, shown.ref) ?? null)
	const mappedEvent = event ?? snapshot.event
	if (snapshot.event !== null && mappedEvent !== null && calendar !== null) {
		return (
			<CalendarLessonDialog
				key={mappedEvent.eventKey}
				event={mappedEvent}
				window={calendar}
				now={props.now}
				mainTimeZone={props.mainTimeZone}
				secondZone={props.secondZone}
				student={{ id: shown.studentId, name: shown.studentName }}
				blocksOn={props.blocksOn}
				onClose={() => onClose(target)}
				onRefresh={() => void reload()}
			/>
		)
	}
	const seriesId = shown.ref.kind === 'series' ? shown.ref.seriesId : null
	const rule = series.find((rule) => rule.id === seriesId) ?? null
	const history = { ...shown, actions: { ...shown.actions, move: false, cancel: false, restore: false, series: false } }
	async function mark(kind: LessonMarkKind): Promise<ActionOutcome> {
		if (shown === null) return 'failed'
		const result = await markLesson(shown, kind)
		if (result.kind !== 'ok' && result.kind !== 'stale') return 'failed'
		await reload()
		return result.kind
	}
	return (
		<LessonDialog
			now={props.now}
			mainTimeZone={props.mainTimeZone}
			currentMainTimeZone={props.currentMainTimeZone}
			asOf={props.asOf}
			secondZone={props.secondZone}
			onOpenPair={props.onOpenPair}
			key={`${shown.key}:${target.slot}`}
			block={history}
			series={rule}
			onClose={() => onClose(target)}
			onMark={mark}
			onRefresh={() => {
				onClose(null)
				void reload()
			}}
		/>
	)
}
