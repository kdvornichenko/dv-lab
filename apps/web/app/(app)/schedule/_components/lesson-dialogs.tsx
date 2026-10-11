'use client'

import { useState } from 'react'

import { apiRequest } from '@/lib/api-client'
import { occurrenceSlot, type OccurrenceSlot } from '@/lib/lesson-mark-text'
import { mainWhen } from '@/lib/schedule-format'
import { exitFallbackMs, spring } from '@/lib/springs'
import { sameTimeZone } from '@/lib/time-zones'

import {
	timeZoneIdentity,
	type LessonMarkKind,
	type ScheduleBlock,
	type ScheduleSeries,
	type ScheduleWeekResponse,
} from '@dv-lab/contracts'
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
	mainTimeZone: string
	asOf: string
	returnTo: LessonSelection
}

export function readLessonWeek(monday: string) {
	return apiRequest<ScheduleWeekResponse>('GET', `/schedule/week?start=${monday}`)
}

export function lessonWeekKey(mainTimeZone: string, monday: string): string {
	return `${timeZoneIdentity(mainTimeZone)}:${monday}`
}

export async function readOverlapBlocks(
	date: string,
	weeks: Map<string, ScheduleWeekResponse>,
	mainTimeZone: string
): Promise<OverlapBlock[]> {
	const monday = mondayOf(date)
	const key = lessonWeekKey(mainTimeZone, monday)
	let data = weeks.get(key)
	if (data === undefined) {
		const result = await readLessonWeek(monday)
		if (!result.ok || result.data.start !== monday || !sameTimeZone(result.data.defaultTimeZone, mainTimeZone))
			return []
		data = result.data
		weeks.set(key, data)
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
	selection: LessonSelection | null
	selected: ScheduleBlock | null
	series: readonly ScheduleSeries[]
	now: Date
	mainTimeZone: string
	currentMainTimeZone: string
	asOf: string
	secondZone: string | null
	currentYear: number
	blocksOn: (date: string) => Promise<OverlapBlock[]>
	reload: () => Promise<void>
	onClose: (target: LessonSelection | null) => void
	onOpenPair: (target: PairTarget) => void
}

function useSelectedLesson(
	selected: ScheduleBlock | null,
	selection: LessonSelection | null,
	series: readonly ScheduleSeries[]
) {
	const [snapshot, setSnapshot] = useState<{ block: ScheduleBlock; rule: ScheduleSeries | null } | null>(null)
	const seriesId = selected?.ref.kind === 'series' ? selected.ref.seriesId : null
	const rule = series.find((item) => item.id === seriesId) ?? null
	if (selected !== null && (snapshot?.block !== selected || snapshot.rule !== rule)) {
		setSnapshot({ block: selected, rule })
	}
	if (selection === null && snapshot !== null) setSnapshot(null)
	if (snapshot === null || selection === null) return null
	return snapshot.block.key === selection.key && occurrenceSlot(snapshot.block.outcome) === selection.slot
		? snapshot
		: null
}

export function LessonDialogs({
	selected,
	selection,
	series,
	now,
	mainTimeZone,
	currentMainTimeZone,
	asOf,
	secondZone,
	currentYear,
	blocksOn,
	reload,
	onClose,
	onOpenPair,
}: LessonDialogsProps) {
	const [seriesDialog, setSeriesDialog] = useState<SeriesDialogState | null>(null)
	const toast = useToast()
	const snapshot = useSelectedLesson(selected, selection, series)
	const shown = snapshot?.block ?? null
	const selectedSeries = snapshot?.rule ?? null
	const seriesRule =
		seriesDialog === null ? null : (series.find((rule) => rule.id === seriesDialog.rule.id) ?? seriesDialog.rule)

	async function changeLesson(block: ScheduleBlock, action: 'cancel' | 'restore'): Promise<ActionOutcome> {
		const result = await mutate(block.ref, action, { expectedStartsAt: block.startsAt })
		if (result.kind !== 'ok' && result.kind !== 'stale') return 'failed'
		await reload()
		if (result.kind === 'stale') return 'stale'
		toast.show({
			title: action === 'cancel' ? 'Lesson cancelled' : 'Lesson restored',
			description: `${block.studentName}, ${mainWhen(new Date(block.startsAt), mainTimeZone, null, currentYear)}.`,
		})
		return 'ok'
	}

	async function markBlock(block: ScheduleBlock, kind: LessonMarkKind): Promise<ActionOutcome> {
		const result = await markLesson(block, kind)
		if (result.kind !== 'ok' && result.kind !== 'stale') return 'failed'
		await reload()
		return result.kind
	}

	function startSeries(
		block: ScheduleBlock,
		rule: ScheduleSeries,
		kind: 'move' | 'end',
		context: { mainTimeZone: string; asOf: string }
	) {
		const next: SeriesDialogState = {
			kind,
			rule,
			studentName: block.studentName,
			...context,
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

	function refreshForms() {
		setSeriesDialog(null)
		onClose(null)
		void reload()
	}

	return (
		<>
			{shown !== null ? (
				<LessonDialog
					key={`${shown.key}:${occurrenceSlot(shown.outcome)}`}
					block={shown}
					series={selectedSeries}
					mainTimeZone={mainTimeZone}
					currentMainTimeZone={currentMainTimeZone}
					asOf={asOf}
					now={now}
					secondZone={secondZone}
					onClose={() => onClose({ key: shown.key, slot: occurrenceSlot(shown.outcome) })}
					onOpenPair={onOpenPair}
					onCancel={() => changeLesson(shown, 'cancel')}
					onRestore={() => changeLesson(shown, 'restore')}
					onMark={(kind) => markBlock(shown, kind)}
					blocksOn={blocksOn}
					onStale={() => void reload()}
					onRefresh={refreshForms}
					onMoved={(at) => {
						void reload().then(() => onOpenPair({ key: shown.key, slot: 'to', at }))
					}}
					onSeries={(kind, context) => {
						if (selectedSeries !== null) startSeries(shown, selectedSeries, kind, context)
					}}
				/>
			) : null}
			{seriesRule !== null && seriesDialog?.kind === 'move' ? (
				<MoveSeriesDialog
					mainTimeZone={seriesDialog.mainTimeZone}
					asOf={seriesDialog.asOf}
					currentMainTimeZone={currentMainTimeZone}
					rule={seriesRule}
					studentName={seriesDialog.studentName}
					now={now}
					onClose={closeSeries}
					onStale={() => void reload()}
					onRefresh={refreshForms}
					onMoved={() => void seriesChanged()}
				/>
			) : null}
			{seriesRule !== null && seriesDialog?.kind === 'end' ? (
				<EndSeriesDialog
					mainTimeZone={seriesDialog.mainTimeZone}
					asOf={seriesDialog.asOf}
					currentMainTimeZone={currentMainTimeZone}
					rule={seriesRule}
					studentName={seriesDialog.studentName}
					now={now}
					onClose={closeSeries}
					onStale={() => void reload()}
					onRefresh={refreshForms}
					onEnded={() => void seriesChanged()}
				/>
			) : null}
		</>
	)
}
