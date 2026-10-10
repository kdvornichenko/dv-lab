'use client'

import { useEffect, useEffectEvent, useState } from 'react'

import { ArrowRight, CalendarClock } from 'lucide-react'

import { DateField } from '@/components/app/date-field'
import { TimePair } from '@/components/app/time-pair'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { TimePicker } from '@/components/ui/time-picker'
import {
	formatDate,
	formatFullDate,
	formatRange,
	formatTime,
	secondRange,
	secondWhen,
	vnRange,
	vnWhen,
} from '@/lib/schedule-format'

import type { ScheduleBlock } from '@dv-lab/contracts'
import { SCHEDULE_TIME_ZONE, overlaps, zonedInstant, zonedParts } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import type { OverlapBlock } from './new-lesson-dialog'
import { changedStart, mutate } from './schedule-mutations'

interface LessonMoveFormProps {
	block: ScheduleBlock
	today: string
	secondZone: string | null
	currentYear: number
	blocksOn: (date: string) => Promise<OverlapBlock[]>
	onPendingChange: (pending: boolean) => void
	onDiscard: () => void
	onStale: () => void
	onMoved: (startsAt: Date) => void
}

type Field = 'date' | 'time'

export function LessonMoveForm({
	block,
	today,
	secondZone,
	currentYear,
	blocksOn,
	onPendingChange,
	onDiscard,
	onStale,
	onMoved,
}: LessonMoveFormProps) {
	const toast = useToast()
	const start = new Date(block.startsAt)
	const current = zonedParts(start, SCHEDULE_TIME_ZONE)
	const [date, setDate] = useState(current.date)
	const [time, setTime] = useState<string | null>(current.time)
	const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({})
	const [submitted, setSubmitted] = useState(false)
	const [failed, setFailed] = useState(false)
	const [pending, setPending] = useState(false)
	const [day, setDay] = useState<{ date: string; items: OverlapBlock[] } | null>(null)

	const loadBlocks = useEffectEvent((forDate: string) => blocksOn(forDate))

	useEffect(() => {
		const timer = setTimeout(() => document.getElementById('move-lesson-date')?.focus(), 50)
		return () => clearTimeout(timer)
	}, [])

	useEffect(() => {
		let active = true
		void loadBlocks(date).then((items) => {
			if (active) setDay({ date, items })
		})
		return () => {
			active = false
		}
	}, [date])

	const target = time === null ? null : zonedInstant(date, time, SCHEDULE_TIME_ZONE)
	const errors: Partial<Record<Field, string>> = {}
	if (date === '') errors.date = 'Choose a date.'
	if (time === null) errors.time = 'Choose a start time.'
	else if (target !== null && target.getTime() === start.getTime()) errors.time = 'Choose a different date or time.'
	const shown = (field: Field) => (submitted || touched[field] ? errors[field] : undefined)
	const clashes =
		target !== null && day !== null && day.date === date
			? overlaps(day.items, { startsAt: target, durationMinutes: block.durationMinutes }, block.key)
			: []
	const second = target === null ? null : secondRange(target, block.durationMinutes, secondZone)

	function setBusy(value: boolean) {
		setPending(value)
		onPendingChange(value)
	}

	async function submit() {
		if (pending) return
		setSubmitted(true)
		setFailed(false)
		if (errors.date) return document.getElementById('move-lesson-date')?.focus()
		if (errors.time || time === null || target === null) return document.getElementById('move-lesson-time')?.focus()
		setBusy(true)
		const result = await mutate(block.ref, 'move', { date, startTime: time, expectedStartsAt: block.startsAt })
		setBusy(false)
		if (result.kind === 'failed') {
			setFailed(true)
			return
		}
		if (result.kind === 'stale') {
			onStale()
			return
		}
		const moved = new Date(changedStart(result.data))
		toast.show({
			title: 'Lesson moved',
			description: `${block.studentName}: ${vnWhen(start, secondZone, currentYear)} to ${vnWhen(moved, secondZone, currentYear)}.`,
		})
		onMoved(moved)
	}

	return (
		<div role="group" aria-label="Move lesson" className="flex flex-col gap-4 rounded-xl bg-hover p-4">
			{failed ? (
				<Banner status="error" data-slot="move-lesson-failed">
					<BannerTitle>Could not move the lesson. Try again.</BannerTitle>
				</Banner>
			) : null}
			<div className="grid items-start gap-4 sm:grid-cols-2">
				<DateField
					id="move-lesson-date"
					label="New date"
					value={date}
					min={today}
					onChange={(value) => {
						setDate(value)
						setTouched((state) => ({ ...state, date: true }))
					}}
					disabled={pending}
					error={shown('date')}
				/>
				<div className="flex min-w-0 flex-col gap-2">
					<span id="move-lesson-time-label" className="text-body text-muted-foreground">
						Time, VN
					</span>
					<TimePicker
						id="move-lesson-time"
						aria-labelledby="move-lesson-time-label"
						aria-describedby={shown('time') ? 'move-lesson-time-error' : undefined}
						value={time}
						onValueChange={(value) => {
							setTime(value)
							setTouched((state) => ({ ...state, time: true }))
						}}
						minuteStep={15}
						hourCycle={24}
						disabled={pending}
						invalid={Boolean(shown('time'))}
						className="w-full"
					/>
					{shown('time') ? (
						<p id="move-lesson-time-error" className="text-caption text-destructive">
							{shown('time')}
						</p>
					) : null}
				</div>
			</div>
			<p
				aria-live="polite"
				data-slot="move-lesson-change"
				className="flex flex-wrap items-start gap-1.5 text-body text-foreground tabular-nums"
			>
				<TimePair
					as="span"
					main={`${formatDate(current.date, currentYear)}, ${formatTime(start, SCHEDULE_TIME_ZONE)}`}
					second={secondWhen(start, secondZone)}
					className="text-muted-foreground"
				/>
				<ArrowRight aria-hidden className="mt-0.5 size-4 text-muted-foreground" />
				{target === null ? null : (
					<TimePair
						as="span"
						main={`${formatFullDate(target, SCHEDULE_TIME_ZONE, currentYear)} · ${formatRange(target, block.durationMinutes, SCHEDULE_TIME_ZONE)} VN`}
						second={second}
					/>
				)}
			</p>
			{clashes.length > 0 ? (
				<p data-slot="move-lesson-clash" className="text-body text-destructive">
					A lesson is already at this time:{' '}
					{clashes
						.map((item) => `${item.studentName} ${vnRange(item.startsAt, item.durationMinutes, secondZone)}`)
						.join(', ')}
				</p>
			) : null}
			<div className="flex flex-wrap justify-end gap-2">
				<Button type="button" variant="ghost" size="compact" disabled={pending} onClick={onDiscard}>
					Discard changes
				</Button>
				<Button
					type="button"
					size="compact"
					leadingIcon={CalendarClock}
					loading={pending}
					onClick={() => void submit()}
				>
					{pending ? 'Moving…' : 'Move lesson'}
				</Button>
			</div>
		</div>
	)
}
