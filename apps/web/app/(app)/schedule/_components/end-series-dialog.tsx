'use client'

import { useState } from 'react'

import { CalendarFormStatus } from '@/components/app/calendar-command-notice'
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
import { seriesDateInZone } from '@/lib/lesson-actions'
import { formatDate, seriesWhen } from '@/lib/schedule-format'

import type { CalendarSeriesContext } from '@dv-lab/contracts'
import { endSeriesAt, hasOccurrences, scheduleDate } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { TimeZoneStaleNotice, useScheduleFormContext, type ScheduleFormContext } from './schedule-form-context'
import { STALE_DATE, STALE_TITLE, useScheduleMutation } from './schedule-mutations'

interface EndSeriesDialogProps extends ScheduleFormContext {
	series: CalendarSeriesContext
	available: boolean
	currentMainTimeZone: string
	studentName: string
	now: Date
	onClose: () => void
	onStale: () => void
	onRefresh: () => void
	onEnded: () => void
}

const KEPT_HINT =
	'Later lessons are removed from the schedule. Earlier lessons and any lessons you moved stay where they are.'

export function EndSeriesDialog({
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
	onEnded,
}: EndSeriesDialogProps) {
	const toast = useToast()
	const context = useScheduleFormContext({ mainTimeZone, asOf }, currentMainTimeZone)
	const { today, currentYear } = context
	const [series] = useState(initialSeries)
	const rule = series.series
	const [secondZone] = useSecondZone(context.mainTimeZone)
	const [lastOn, setLastOn] = useState(() =>
		rule.referenceOccurrence?.ruleStartsAt == null
			? today
			: scheduleDate(new Date(rule.referenceOccurrence.ruleStartsAt), context.mainTimeZone)
	)
	const [submitted, setSubmitted] = useState(false)
	const command = useScheduleMutation({ mainTimeZone: context.mainTimeZone, date: today, series })
	const pending = command.pending
	const [notice, setNotice] = useState<'stale' | 'failed' | null>(null)

	const result = lastOn === '' ? null : endSeriesAt(rule, [], lastOn, { now, defaultTimeZone: context.mainTimeZone })
	const error =
		lastOn === ''
			? 'Choose a date.'
			: result?.kind === 'invalid' || result?.kind === 'changed'
				? 'Choose a date within this series.'
				: undefined
	const remains = result?.kind === 'ok' ? hasOccurrences({ startsOn: rule.startsOn, endsOn: result.endsOn }) : null
	const lastDate = result?.kind === 'ok' && remains ? seriesDateInZone(rule, result.endsOn, context.mainTimeZone) : null
	const description = seriesWhen(rule.referenceOccurrence, context.mainTimeZone, secondZone)

	async function submit() {
		if (!available || pending || command.blocked || context.stale || notice === 'stale') return
		setSubmitted(true)
		setNotice(null)
		if (error) return document.getElementById('end-series-last')?.focus()
		const response = await command.mutate({ kind: 'rule', seriesId: rule.id }, 'end', {
			lastOn,
			expectedDefaultTimeZone: context.mainTimeZone,
		})
		if (response.kind === 'detached') return
		if (response.kind === 'zone_changed') return context.markStale()
		if (response.kind === 'stale') {
			setNotice('stale')
			onStale()
			return
		}
		if (response.kind === 'failed' || response.kind === 'gap') {
			setNotice('failed')
			return
		}
		toast.show({ title: 'Series ended', description: `${studentName}'s series was ended.` })
		onEnded()
	}

	return (
		<Dialog
			open
			disablePointerDismissal
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="sm" showCloseButton={false}>
				<DialogHeader>
					<DialogTitle>End this series?</DialogTitle>
					<DialogDescription>
						{studentName}
						{description === null ? '. Weekly series.' : `, every ${description}.`}
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<TimeZoneStaleNotice stale={context.stale} pending={pending} onRefresh={onRefresh} />
					<CalendarFormStatus
						entry={command.entry}
						blocked={command.blocked}
						onViewSchedule={() => {
							command.detach()
							onClose()
						}}
					/>
					{notice === 'stale' ? (
						<Banner status="warning" data-slot="series-stale">
							<BannerTitle>{STALE_TITLE}</BannerTitle>
							<BannerDescription>{STALE_DATE}</BannerDescription>
							<Button type="button" variant="ghost" size="compact" onClick={onRefresh}>
								Refresh
							</Button>
						</Banner>
					) : notice === 'failed' ? (
						<Banner status="error" data-slot="series-failed">
							<BannerTitle>Could not end the series. Try again.</BannerTitle>
						</Banner>
					) : null}
					<div className="flex flex-col gap-2">
						<DateField
							id="end-series-last"
							label="Last lesson on"
							value={lastOn}
							min={today}
							onChange={setLastOn}
							disabled={pending}
							error={submitted ? error : undefined}
						/>
						<EndSeriesHint ready={result?.kind === 'ok'} lastDate={lastDate} currentYear={currentYear} />
					</div>
				</div>
				<DialogFooter>
					<Button type="button" variant="secondary" autoFocus onClick={onClose} disabled={pending}>
						Keep series
					</Button>
					<Button
						type="button"
						variant="tertiary"
						className="text-destructive"
						loading={pending}
						disabled={!available || command.blocked || context.stale || notice === 'stale'}
						onClick={() => void submit()}
					>
						{pending ? 'Ending…' : 'End series'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

function EndSeriesHint({
	ready,
	lastDate,
	currentYear,
}: {
	ready: boolean
	lastDate: string | null
	currentYear: number
}) {
	if (!ready) return null
	return (
		<p aria-live="polite" data-slot="end-series-hint" className="text-caption text-muted-foreground">
			{lastDate !== null
				? `The last lesson will be on ${formatDate(lastDate, currentYear)}. ${KEPT_HINT}`
				: 'No lessons of this series will remain. Any lessons you moved stay where they are.'}
		</p>
	)
}
