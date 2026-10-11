'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { yearInZone } from '@/lib/schedule-format'
import { offsetLabel, sameTimeZone, zoneLabel, zoneName } from '@/lib/time-zones'

import { localTimeCandidates, scheduleToday } from '@dv-lab/core'

export interface ScheduleFormContext {
	mainTimeZone: string
	asOf: string
}

export function useScheduleFormContext(initial: ScheduleFormContext, currentMainTimeZone: string) {
	const [context] = useState(initial)
	const [changed, setChanged] = useState(false)
	const at = new Date(context.asOf)
	return {
		...context,
		at,
		today: scheduleToday(at, context.mainTimeZone),
		currentYear: yearInZone(at, context.mainTimeZone),
		stale: changed || !sameTimeZone(context.mainTimeZone, currentMainTimeZone),
		markStale: () => setChanged(true),
	}
}

export function gapMessage(mainTimeZone: string): string {
	return `This time does not exist in ${zoneName(mainTimeZone)} because the clocks move forward. Choose another start time.`
}

export function localTimeInput(date: string, time: string | null, context: ScheduleFormContext) {
	const candidates = date === '' || time === null ? null : localTimeCandidates(date, time, context.mainTimeZone)
	const instant = candidates?.[0] ?? null
	const gap = candidates !== null && candidates.length === 0
	const hint =
		candidates !== null && candidates.length > 1
			? `This time occurs twice in ${zoneName(context.mainTimeZone)}. The first occurrence (${offsetLabel(context.mainTimeZone, candidates[0])}) will be used.`
			: null
	return {
		instant,
		error: gap ? gapMessage(context.mainTimeZone) : undefined,
		hint,
		label: zoneLabel(context.mainTimeZone, instant ?? new Date(context.asOf)),
	}
}

export function TimeZoneStaleNotice({
	stale,
	pending,
	onRefresh,
}: {
	stale: boolean
	pending: boolean
	onRefresh: () => void
}) {
	if (!stale) return null
	return (
		<div role="status" className="flex flex-wrap items-center gap-2">
			<p className="text-caption text-muted-foreground">
				Default time zone changed elsewhere. Refresh the page and try again.
			</p>
			<Button type="button" variant="ghost" size="compact" disabled={pending} onClick={onRefresh}>
				Refresh
			</Button>
		</div>
	)
}

export function LocalTimeHint({ hint, id }: { hint: string | null; id: string }) {
	return hint === null ? null : (
		<p id={id} className="text-caption text-muted-foreground">
			{hint}
		</p>
	)
}
