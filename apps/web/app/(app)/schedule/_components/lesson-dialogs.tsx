'use client'

import { useState } from 'react'

import { apiRequest } from '@/lib/api-client'
import { occurrenceSlot, type OccurrenceSlot } from '@/lib/lesson-mark-text'
import { vnWhen } from '@/lib/schedule-format'
import { exitFallbackMs, spring } from '@/lib/springs'

import type { LessonMarkKind, ScheduleBlock, ScheduleSeries, ScheduleWeekResponse } from '@dv-lab/contracts'
import { mondayOf } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { EndSeriesDialog } from './end-series-dialog'
import { LessonDialog, type ActionOutcome, type PairTarget } from './lesson-dialog'
import { MoveSeriesDialog } from './move-series-dialog'
import type { OverlapBlock } from './new-lesson-dialog'
import { markLesson, mutate } from './schedule-mutations'

export type LessonSelection = { key: string; slot: OccurrenceSlot }

type SeriesDialogState = {
	kind: 'move' | 'end'
	rule: ScheduleSeries
	studentName: string
	lessonDate: string
	returnTo: LessonSelection
}

export function readLessonWeek(monday: string) {
	return apiRequest<ScheduleWeekResponse>('GET', `/schedule/week?start=${monday}`)
}

export async function readOverlapBlocks(
	date: string,
	weeks: Map<string, ScheduleWeekResponse>
): Promise<OverlapBlock[]> {
	const monday = mondayOf(date)
	let data = weeks.get(monday)
	if (data === undefined) {
		const result = await readLessonWeek(monday)
		if (!result.ok) return []
		data = result.data
		weeks.set(monday, data)
	}
	return data.blocks.map((block) => ({
		key: block.key,
		startsAt: new Date(block.startsAt),
		durationMinutes: block.durationMinutes,
		outcome: block.outcome,
		studentName: block.studentName,
	}))
}

interface LessonDialogsProps {
	selected: ScheduleBlock | null
	series: readonly ScheduleSeries[]
	now: Date
	secondZone: string | null
	currentYear: number
	today: string
	blocksOn: (date: string) => Promise<OverlapBlock[]>
	reload: () => Promise<void>
	onClose: (target: LessonSelection | null) => void
	onOpenPair: (target: PairTarget) => void
}

export function LessonDialogs({
	selected,
	series,
	now,
	secondZone,
	currentYear,
	today,
	blocksOn,
	reload,
	onClose,
	onOpenPair,
}: LessonDialogsProps) {
	const [seriesDialog, setSeriesDialog] = useState<SeriesDialogState | null>(null)
	const toast = useToast()
	const selectedSeriesId = selected?.ref.kind === 'series' ? selected.ref.seriesId : null
	const selectedSeries =
		selectedSeriesId === null ? null : (series.find((rule) => rule.id === selectedSeriesId) ?? null)
	const seriesRule =
		seriesDialog === null ? null : (series.find((rule) => rule.id === seriesDialog.rule.id) ?? seriesDialog.rule)

	async function changeLesson(block: ScheduleBlock, action: 'cancel' | 'restore'): Promise<ActionOutcome> {
		const result = await mutate(block.ref, action, { expectedStartsAt: block.startsAt })
		if (result.kind === 'failed') return 'failed'
		await reload()
		if (result.kind === 'stale') return 'stale'
		toast.show({
			title: action === 'cancel' ? 'Lesson cancelled' : 'Lesson restored',
			description: `${block.studentName}, ${vnWhen(new Date(block.startsAt), null, currentYear)}.`,
		})
		return 'ok'
	}

	async function markBlock(block: ScheduleBlock, kind: LessonMarkKind): Promise<ActionOutcome> {
		const result = await markLesson(block, kind)
		if (result.kind === 'failed') return 'failed'
		await reload()
		return result.kind
	}

	function startSeries(block: ScheduleBlock, rule: ScheduleSeries, kind: 'move' | 'end') {
		const next: SeriesDialogState = {
			kind,
			rule,
			studentName: block.studentName,
			lessonDate: block.ref.kind === 'series' ? block.ref.originalOn : today,
			returnTo: { key: block.key, slot: occurrenceSlot(block.outcome) },
		}
		onClose(null)
		setTimeout(() => setSeriesDialog(next), exitFallbackMs(spring.slow))
	}

	function closeSeries() {
		const closed = seriesDialog
		setSeriesDialog(null)
		if (closed !== null) onClose(closed.returnTo)
	}

	async function seriesChanged() {
		const closed = seriesDialog
		setSeriesDialog(null)
		await reload()
		if (closed !== null) onClose(closed.returnTo)
	}

	return (
		<>
			{selected !== null ? (
				<LessonDialog
					key={`${selected.key}:${occurrenceSlot(selected.outcome)}`}
					block={selected}
					series={selectedSeries}
					now={now}
					secondZone={secondZone}
					currentYear={currentYear}
					onClose={() => onClose({ key: selected.key, slot: occurrenceSlot(selected.outcome) })}
					onOpenPair={onOpenPair}
					onCancel={() => changeLesson(selected, 'cancel')}
					onRestore={() => changeLesson(selected, 'restore')}
					onMark={(kind) => markBlock(selected, kind)}
					blocksOn={blocksOn}
					onStale={() => void reload()}
					onMoved={(at) => {
						void reload().then(() => onOpenPair({ key: selected.key, slot: 'to', at }))
					}}
					onSeries={(kind) => {
						if (selectedSeries !== null) startSeries(selected, selectedSeries, kind)
					}}
				/>
			) : null}
			{seriesRule !== null && seriesDialog?.kind === 'move' ? (
				<MoveSeriesDialog
					rule={seriesRule}
					studentName={seriesDialog.studentName}
					now={now}
					today={today}
					currentYear={currentYear}
					onClose={closeSeries}
					onStale={() => void reload()}
					onMoved={() => void seriesChanged()}
				/>
			) : null}
			{seriesRule !== null && seriesDialog?.kind === 'end' ? (
				<EndSeriesDialog
					rule={seriesRule}
					studentName={seriesDialog.studentName}
					lessonDate={seriesDialog.lessonDate}
					now={now}
					today={today}
					currentYear={currentYear}
					onClose={closeSeries}
					onStale={() => void reload()}
					onEnded={() => void seriesChanged()}
				/>
			) : null}
		</>
	)
}
