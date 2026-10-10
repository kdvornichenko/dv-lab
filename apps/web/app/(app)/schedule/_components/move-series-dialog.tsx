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
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { TimePicker } from '@/components/ui/time-picker'
import { formatDate, formatRange, secondWhen, seriesWhen, weekdayName, weekdayPlural } from '@/lib/schedule-format'

import type { ScheduleSeries, ScheduleWeekday } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, cutSeries, nextSeriesDate, zonedInstant } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { STALE_DATES, STALE_TITLE, mutate } from './schedule-mutations'

interface MoveSeriesDialogProps {
	rule: ScheduleSeries
	studentName: string
	now: Date
	today: string
	currentYear: number
	onClose: () => void
	onStale: () => void
	onMoved: () => void
}

type Field = 'day' | 'time'

const WEEKDAYS: ScheduleWeekday[] = [1, 2, 3, 4, 5, 6, 7]

function toWeekday(value: string): ScheduleWeekday | null {
	return WEEKDAYS.find((day) => String(day) === value) ?? null
}

export function MoveSeriesDialog({
	rule,
	studentName,
	now,
	today,
	currentYear,
	onClose,
	onStale,
	onMoved,
}: MoveSeriesDialogProps) {
	const toast = useToast()
	const [secondZone] = useSecondZone()
	const [from, setFrom] = useState(() => nextSeriesDate(rule, now) ?? today)
	const [weekday, setWeekday] = useState<ScheduleWeekday | null>(rule.weekday)
	const [time, setTime] = useState<string | null>(rule.startTime)
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [pending, setPending] = useState(false)
	const [notice, setNotice] = useState<'stale' | 'failed' | null>(null)
	const [serverEnds, setServerEnds] = useState(false)
	const [serverStarted, setServerStarted] = useState(false)

	const cut =
		from !== '' && weekday !== null && time !== null
			? cutSeries(rule, [], { from, weekday, startTime: time }, now)
			: null
	const endsText = (endsOn: string) =>
		`This series ends on ${formatDate(endsOn, currentYear)}; no ${weekdayName(weekday ?? rule.weekday)} falls between From and that date.`
	let rowError: string | undefined
	if (cut?.kind === 'invalid' && weekday === rule.weekday && time === rule.startTime) {
		rowError = 'Choose a different day or time.'
	} else if (cut?.kind === 'ends_before_new_day') {
		rowError = endsText(cut.endsOn)
	} else if (serverEnds) {
		rowError = endsText(rule.endsOn ?? from)
	}
	const startedToday = cut?.kind === 'today_passed' || serverStarted
	const errors = {
		from:
			from === ''
				? 'Choose a date.'
				: startedToday
					? "Today's lesson has already started. Choose a later date."
					: undefined,
		day: weekday === null ? 'Choose a day.' : undefined,
		time: time === null ? 'Choose a start time.' : undefined,
	}
	const visible = submitted || touched.day || touched.time || serverEnds
	const shownRow = visible ? rowError : undefined
	const shownDay = submitted || touched.day ? errors.day : undefined
	const shownTime = submitted || touched.time ? errors.time : undefined
	const preview =
		cut?.kind === 'ok'
			? `${formatDate(cut.newRule.startsOn, currentYear)}, ${formatRange(
					zonedInstant(cut.newRule.startsOn, cut.newRule.startTime, SCHEDULE_TIME_ZONE),
					rule.durationMinutes,
					SCHEDULE_TIME_ZONE
				)}`
			: null

	const zoneDate = cut?.kind === 'ok' ? cut.newRule.startsOn : from
	const zoneLine =
		zoneDate !== '' && time !== null ? secondWhen(zonedInstant(zoneDate, time, SCHEDULE_TIME_ZONE), secondZone) : null

	function edit<T>(set: (value: T) => void, field?: Field) {
		return (value: T) => {
			set(value)
			setServerEnds(false)
			setServerStarted(false)
			if (field) setTouched((state) => ({ ...state, [field]: true }))
		}
	}

	async function submit() {
		if (pending) return
		setSubmitted(true)
		setNotice(null)
		if (errors.from) return document.getElementById('move-series-from')?.focus()
		if (errors.day || weekday === null) return document.getElementById('move-series-day')?.focus()
		if (errors.time || time === null) return document.getElementById('move-series-time')?.focus()
		if (rowError) return document.getElementById('move-series-day')?.focus()
		setPending(true)
		const result = await mutate({ kind: 'rule', seriesId: rule.id }, 'move', { from, weekday, startTime: time })
		setPending(false)
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
		toast.show({
			title: 'Series moved',
			description: `${studentName} now meets on ${weekdayPlural(series.weekday)} at ${series.startTime} from ${formatDate(series.startsOn, currentYear)}.`,
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
						{studentName}. Now every {seriesWhen(rule, secondZone, now)}.
					</DialogDescription>
				</DialogHeader>
				<ScrollArea className="max-h-[calc(100dvh-14rem)]" viewportClassName="scroll-fade max-h-[inherit] px-1 -mx-1">
					<div className="flex flex-col gap-4 py-1">
						{notice === 'stale' ? (
							<Banner status="warning" data-slot="series-stale">
								<BannerTitle>{STALE_TITLE}</BannerTitle>
								<BannerDescription>{STALE_DATES}</BannerDescription>
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
						<div className="flex flex-col gap-2">
							<div className="grid items-start gap-4 sm:grid-cols-2">
								<div className="flex min-w-0 flex-col gap-2">
									<label htmlFor="move-series-day" className="text-body text-muted-foreground">
										New day
									</label>
									<Select
										value={weekday === null ? '' : String(weekday)}
										onValueChange={edit((value: string) => setWeekday(toWeekday(value)), 'day')}
										disabled={pending}
									>
										<SelectTrigger
											id="move-series-day"
											className="w-full min-w-0"
											placeholder="Choose a day"
											error={shownDay}
											aria-invalid={shownRow || shownDay ? true : undefined}
											aria-describedby={shownRow ? 'move-series-row-error' : undefined}
										/>
										<SelectContent>
											{WEEKDAYS.map((day, index) => (
												<SelectItem key={day} index={index} value={String(day)}>
													{weekdayName(day)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex min-w-0 flex-col gap-2">
									<span id="move-series-time-label" className="text-body text-muted-foreground">
										New start time, VN
									</span>
									<TimePicker
										id="move-series-time"
										aria-labelledby="move-series-time-label"
										aria-describedby={
											[
												shownRow ? 'move-series-row-error' : null,
												shownTime || zoneLine ? 'move-series-time-note' : null,
											]
												.filter(Boolean)
												.join(' ') || undefined
										}
										value={time}
										onValueChange={edit(setTime, 'time')}
										minuteStep={15}
										hourCycle={24}
										disabled={pending}
										invalid={Boolean(shownRow || shownTime)}
										className="w-full"
									/>
									{shownTime ? (
										<p id="move-series-time-note" className="text-caption text-destructive">
											{shownTime}
										</p>
									) : zoneLine !== null ? (
										<p
											id="move-series-time-note"
											data-slot="move-series-zone"
											className="text-caption text-muted-foreground"
										>
											{zoneLine}
										</p>
									) : null}
								</div>
							</div>
							{shownRow ? (
								<p id="move-series-row-error" data-slot="move-series-error" className="text-caption text-destructive">
									{shownRow}
								</p>
							) : null}
						</div>
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
					<Button type="button" loading={pending} onClick={() => void submit()}>
						{pending ? 'Moving…' : 'Move series'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
