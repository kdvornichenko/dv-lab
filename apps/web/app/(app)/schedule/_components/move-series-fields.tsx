import { LengthField } from '@/components/app/length-field'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { TimePicker } from '@/components/ui/time-picker'
import { weekdayName } from '@/lib/schedule-format'

import type { ScheduleWeekday } from '@dv-lab/contracts'

import { LocalTimeHint } from './schedule-form-context'

export const WEEKDAYS: ScheduleWeekday[] = [1, 2, 3, 4, 5, 6, 7]

export function MoveSeriesFields({
	weekday,
	time,
	pending,
	shownRow,
	shownDay,
	shownTime,
	zoneLine,
	timeLabel,
	foldHint,
	lengthMinutes,
	lengthError,
	onDayChange,
	onTimeChange,
	onLengthChange,
}: {
	weekday: ScheduleWeekday | null
	time: string | null
	pending: boolean
	shownRow: string | undefined
	shownDay: string | undefined
	shownTime: string | undefined
	zoneLine: string | null
	timeLabel: string
	foldHint: string | null
	lengthMinutes: number
	lengthError: string | undefined
	onDayChange: (value: string) => void
	onTimeChange: (value: string | null) => void
	onLengthChange: (value: number | null) => void
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
				<div className="flex min-w-0 flex-col gap-2">
					<label htmlFor="move-series-day" className="text-body text-muted-foreground">
						New day
					</label>
					<Select value={weekday === null ? '' : String(weekday)} onValueChange={onDayChange} disabled={pending}>
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
						New start time, {timeLabel}
					</span>
					<TimePicker
						id="move-series-time"
						aria-labelledby="move-series-time-label"
						aria-describedby={
							[
								shownRow ? 'move-series-row-error' : null,
								shownTime || zoneLine ? 'move-series-time-note' : null,
								foldHint ? 'move-series-time-dst' : null,
							]
								.filter(Boolean)
								.join(' ') || undefined
						}
						value={time}
						onValueChange={onTimeChange}
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
						<p id="move-series-time-note" data-slot="move-series-zone" className="text-caption text-muted-foreground">
							{zoneLine}
						</p>
					) : null}
					<LocalTimeHint id="move-series-time-dst" hint={foldHint} />
				</div>
				<LengthField
					id="move-series-length"
					initialMinutes={lengthMinutes}
					onCommit={onLengthChange}
					disabled={pending}
					error={lengthError}
				/>
			</div>
			{shownRow ? (
				<p id="move-series-row-error" data-slot="move-series-error" className="text-caption text-destructive">
					{shownRow}
				</p>
			) : null}
		</div>
	)
}
