'use client'

import { useState } from 'react'

import { DateField } from '@/components/app/date-field'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate, seriesWhen, weekdayPlural } from '@/lib/schedule-format'
import { sameTimeZone, zoneLabel, zoneName } from '@/lib/time-zones'

import type { ScheduleSeries, ScheduleWeekday } from '@dv-lab/contracts'
import { scheduleDate, seriesStart, zonedParts } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { MoveSeriesFields, WEEKDAYS } from './move-series-fields'
import { seriesPreview } from './move-series-preview'
import { TimeZoneStaleNotice, useScheduleFormContext, type ScheduleFormContext } from './schedule-form-context'
import { STALE_DATES, STALE_TITLE, mutate } from './schedule-mutations'

interface MoveSeriesDialogProps extends ScheduleFormContext {
	rule: ScheduleSeries
	currentMainTimeZone: string
	studentName: string
	now: Date
	onClose: () => void
	onStale: () => void
	onRefresh: () => void
	onMoved: () => void
}

type Field = 'day' | 'time'

function toWeekday(value: string): ScheduleWeekday | null {
	return WEEKDAYS.find((day) => String(day) === value) ?? null
}

function seriesInput(rule: ScheduleSeries, mainTimeZone: string, secondZone: string | null, today: string) {
	const reference =
		rule.referenceOccurrence?.ruleStartsAt == null ? null : new Date(rule.referenceOccurrence.ruleStartsAt)
	const parts = reference === null ? null : zonedParts(reference, mainTimeZone)
	return {
		from: reference === null ? today : scheduleDate(reference, mainTimeZone),
		weekday: parts?.weekday ?? null,
		time: parts?.time ?? null,
		description:
			reference === null
				? 'Weekly series.'
				: `Now every ${seriesWhen(rule.referenceOccurrence, mainTimeZone, secondZone)}.`,
		createdIn:
			reference !== null && !sameTimeZone(rule.timeZone, mainTimeZone)
				? `${zoneName(rule.timeZone)} time (${zoneLabel(rule.timeZone, reference)})`
				: null,
	}
}

export function MoveSeriesDialog({
	rule: initialRule,
	mainTimeZone,
	asOf,
	currentMainTimeZone,
	studentName,
	now,
	onClose,
	onStale,
	onRefresh,
	onMoved,
}: MoveSeriesDialogProps) {
	const toast = useToast()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const { today, currentYear } = context
	const [rule] = useState(initialRule)
	const [secondZone] = useSecondZone(context.mainTimeZone)
	const initial = seriesInput(rule, context.mainTimeZone, secondZone, today)
	const [from, setFrom] = useState(initial.from)
	const [weekday, setWeekday] = useState<ScheduleWeekday | null>(initial.weekday)
	const [time, setTime] = useState<string | null>(initial.time)
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [pending, setPending] = useState(false)
	const [notice, setNotice] = useState<'stale' | 'failed' | null>(null)
	const [serverEnds, setServerEnds] = useState(false)
	const [serverStarted, setServerStarted] = useState(false)
	const [serverGap, setServerGap] = useState(false)

	const { errors, rowError, startedToday, preview, zoneLine, input } = seriesPreview({
		rule,
		from,
		weekday,
		time,
		now,
		currentYear,
		serverEnds,
		serverStarted,
		secondZone,
		mainTimeZone: context.mainTimeZone,
		asOf: context.asOf,
		serverGap,
	})
	const visible = submitted || touched.day || touched.time || serverEnds
	const shownRow = visible ? rowError : undefined
	const shownDay = submitted || touched.day ? errors.day : undefined
	const shownTime = submitted || touched.time || input.error || serverGap ? errors.time : undefined

	function edit<T>(set: (value: T) => void, field?: Field) {
		return (value: T) => {
			set(value)
			setServerEnds(false)
			setServerStarted(false)
			setServerGap(false)
			if (field) setTouched((state) => ({ ...state, [field]: true }))
		}
	}

	async function submit() {
		if (pending || context.stale || notice === 'stale') return
		setSubmitted(true)
		setNotice(null)
		if (errors.from) return document.getElementById('move-series-from')?.focus()
		if (errors.day || weekday === null) return document.getElementById('move-series-day')?.focus()
		if (errors.time || time === null) return document.getElementById('move-series-time')?.focus()
		if (rowError) return document.getElementById('move-series-day')?.focus()
		setPending(true)
		const result = await mutate({ kind: 'rule', seriesId: rule.id }, 'move', {
			from,
			weekday,
			startTime: time,
			expectedDefaultTimeZone: context.mainTimeZone,
		})
		setPending(false)
		if (result.kind === 'zone_changed') return context.markStale()
		if (result.kind === 'gap') return setServerGap(true)
		if (result.kind === 'stale') {
			setNotice('stale')
			onStale()
			return
		}
		if (result.kind === 'failed') {
			if (result.code === 'series_ends_before_new_day') setServerEnds(true)
			else if (result.code === 'series_today_passed') setServerStarted(true)
			else setNotice('failed')
			return
		}
		const series = result.data.series
		const first = seriesStart(series, series.startsOn)
		toast.show({
			title: 'Series moved',
			description:
				first === null
					? `${studentName}'s series was moved.`
					: `${studentName} now meets on ${weekdayPlural(series.weekday)} at ${series.startTime} ${zoneLabel(series.timeZone, first)} from ${formatDate(scheduleDate(first, context.mainTimeZone), currentYear)}.`,
		})
		onMoved()
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="lg" showCloseButton={!pending}>
				<DialogHeader>
					<DialogTitle>Move series</DialogTitle>
					<DialogDescription>
						{studentName}. {initial.description}
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] px-1 -mx-1">
					<div className="flex flex-col gap-4 py-1">
						<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
						{initial.createdIn !== null ? (
							<dl className="flex flex-col gap-1">
								<dt className="text-caption text-muted-foreground">Created in</dt>
								<dd className="text-body">{initial.createdIn}</dd>
							</dl>
						) : null}
						{notice === 'stale' ? (
							<Banner status="warning" data-slot="series-stale">
								<BannerTitle>{STALE_TITLE}</BannerTitle>
								<BannerDescription>{STALE_DATES}</BannerDescription>
								<Button type="button" variant="ghost" size="compact" onClick={onRefresh}>
									Refresh
								</Button>
							</Banner>
						) : notice === 'failed' ? (
							<Banner status="error" data-slot="series-failed">
								<BannerTitle>Could not move the series. Try again.</BannerTitle>
							</Banner>
						) : null}
						<DateField
							id="move-series-from"
							label="From"
							value={from}
							min={today}
							onChange={edit(setFrom)}
							disabled={pending}
							error={submitted || startedToday ? errors.from : undefined}
						/>
						<MoveSeriesFields
							weekday={weekday}
							time={time}
							pending={pending}
							shownRow={shownRow}
							shownDay={shownDay}
							shownTime={shownTime}
							zoneLine={zoneLine}
							timeLabel={input.label}
							foldHint={input.hint}
							onDayChange={edit((value: string) => setWeekday(toWeekday(value)), 'day')}
							onTimeChange={edit(setTime, 'time')}
						/>
						{preview !== null ? (
							<div
								data-slot="move-series-preview"
								className="flex items-center justify-between gap-4 rounded-xl bg-hover px-4 py-3 text-body"
							>
								<span data-slot="move-series-preview-label" className="text-body text-muted-foreground">
									First lesson
								</span>
								<span className="text-body text-foreground tabular-nums">{preview}</span>
							</div>
						) : null}
						<p data-slot="move-series-note" className="text-caption text-muted-foreground">
							Lessons before this date stay as they are. Lessons you already moved keep their new time. Cancelled
							lessons from this date on are reset.
						</p>
					</div>
				</ScrollArea>
				<DialogFooter>
					<Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
						Discard changes
					</Button>
					<Button
						type="button"
						loading={pending}
						disabled={context.stale || notice === 'stale'}
						onClick={() => void submit()}
					>
						{pending ? 'Moving…' : 'Move series'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
