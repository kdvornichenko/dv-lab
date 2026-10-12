'use client'

import { useState } from 'react'

import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
import { DateField } from '@/components/app/date-field'
import { ConflictStatus, FormFooter, GoogleConflicts, useGoogleConflicts } from '@/components/app/google-conflicts'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { seriesWhen } from '@/lib/schedule-format'
import { sameTimeZone, zoneLabel, zoneName } from '@/lib/time-zones'

import type { CalendarSeriesContext, ScheduleSeries, ScheduleWeekday } from '@dv-lab/contracts'
import { scheduleDate, zonedParts } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { MoveSeriesFields, WEEKDAYS } from './move-series-fields'
import { seriesPreview } from './move-series-preview'
import { TimeZoneStaleNotice, useScheduleFormContext, type ScheduleFormContext } from './schedule-form-context'
import { STALE_DATES, STALE_TITLE, useScheduleMutation } from './schedule-mutations'

interface MoveSeriesDialogProps extends ScheduleFormContext {
	series: CalendarSeriesContext
	available: boolean
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

function seriesProposal(
	draft: Pick<Parameters<typeof seriesPreview>[0], 'from' | 'weekday' | 'time' | 'mainTimeZone'>,
	errors: ReturnType<typeof seriesPreview>['errors'],
	rowError: string | undefined
) {
	const { from, weekday, time, mainTimeZone } = draft
	if (errors.from || errors.day || errors.time || rowError || weekday === null || time === null) return null
	return {
		operation: 'move_series' as const,
		input: { from, weekday, startTime: time, expectedDefaultTimeZone: mainTimeZone },
	}
}

export function MoveSeriesDialog({
	series: initialSeries,
	available,
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
	const [series] = useState(initialSeries)
	const rule = series.series
	const [secondZone] = useSecondZone(context.mainTimeZone)
	const initial = seriesInput(rule, context.mainTimeZone, secondZone, today)
	const [from, setFrom] = useState(initial.from)
	const [weekday, setWeekday] = useState<ScheduleWeekday | null>(initial.weekday)
	const [time, setTime] = useState<string | null>(initial.time)
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const command = useScheduleMutation({ mainTimeZone: context.mainTimeZone, date: today, series })
	const pending = command.pending
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
	const conflicts = useGoogleConflicts({
		proposal: seriesProposal({ from, weekday, time, mainTimeZone: context.mainTimeZone }, errors, rowError),
		editedRef:
			rule.referenceOccurrence === null
				? undefined
				: { kind: 'series', seriesId: rule.id, originalOn: rule.referenceOccurrence.originalOn },
		series,
		date: today,
		available: available && !command.blocked && !context.stale && notice !== 'stale',
	})

	function edit<T>(set: (value: T) => void, field?: Field) {
		return (value: T) => {
			set(value)
			setServerEnds(false)
			setServerStarted(false)
			setServerGap(false)
			if (field) setTouched((state) => ({ ...state, [field]: true }))
		}
	}

	function canSubmit() {
		return conflicts.ready
	}

	async function submit() {
		if (!canSubmit()) return
		setSubmitted(true)
		setNotice(null)
		if (errors.from) return document.getElementById('move-series-from')?.focus()
		if (errors.day || weekday === null) return document.getElementById('move-series-day')?.focus()
		if (errors.time || time === null) return document.getElementById('move-series-time')?.focus()
		if (rowError) return document.getElementById('move-series-day')?.focus()
		const result = await command.mutate(
			{ kind: 'rule', seriesId: rule.id },
			'move',
			{
				from,
				weekday,
				startTime: time,
				expectedDefaultTimeZone: context.mainTimeZone,
			},
			conflicts.checked
		)
		if (result.kind === 'detached') return
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
		toast.show({ title: 'Series moved', description: `${studentName}'s series was moved.` })
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
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] -m-1 p-1">
					<div className="flex flex-col gap-4 py-1">
						<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
						<CalendarFormStatus
							entry={command.entry}
							blocked={command.blocked}
							connectionShown

							onViewSchedule={() => {
								command.detach()
								onClose()
							}}
						/>
						{initial.createdIn !== null ? (
							<dl className="flex flex-col gap-1">
								<dt className="text-caption text-muted-foreground">Created in</dt>
								<dd className="text-body">{initial.createdIn}</dd>
							</dl>
						) : null}
						<SeriesFailure notice={notice} onRefresh={onRefresh} />
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
						<GoogleConflicts check={conflicts} pending={pending} />
						<p data-slot="move-series-note" className="text-caption text-muted-foreground">
							Lessons before this date stay as they are. Lessons you already moved keep their new time. Cancelled
							lessons from this date on are reset.
						</p>
					</div>
				</ScrollArea>
				<FormFooter
					status={
						<ConflictStatus
							check={conflicts}
							timeZone={context.mainTimeZone}
							durationMinutes={rule.durationMinutes}
							failure={notice === 'failed' ? 'Could not move the series. Try again.' : null}
						/>
					}
				>
					<Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
						Discard changes
					</Button>
					<Button type="button" loading={pending} disabled={!canSubmit()} onClick={() => void submit()}>
						{pending ? 'Moving…' : 'Move series'}
					</Button>
				</FormFooter>
			</DialogContent>
		</Dialog>
	)
}

function SeriesFailure({ notice, onRefresh }: { notice: 'stale' | 'failed' | null; onRefresh: () => void }) {
	if (notice !== 'stale') return null
	return (
		<Banner status="warning" data-slot="series-stale">
			<BannerTitle>{STALE_TITLE}</BannerTitle>
			<BannerDescription>{STALE_DATES}</BannerDescription>
			<Button type="button" variant="ghost" size="compact" onClick={onRefresh}>
				Refresh
			</Button>
		</Banner>
	)
}
