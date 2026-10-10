'use client'

import { useState } from 'react'

import { DateField } from '@/components/app/date-field'
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
import { formatDate, weekdayName } from '@/lib/schedule-format'

import type { ScheduleSeries } from '@dv-lab/contracts'
import { endSeriesAt, hasOccurrences } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'
import { STALE_DATE, STALE_TITLE, mutate } from './schedule-mutations'

interface EndSeriesDialogProps {
	rule: ScheduleSeries
	studentName: string
	lessonDate: string
	now: Date
	today: string
	currentYear: number
	onClose: () => void
	onStale: () => void
	onEnded: () => void
}

function initialDate(lessonDate: string, today: string, endsOn: string | null): string {
	const floor = lessonDate < today ? today : lessonDate
	return endsOn !== null && floor > endsOn ? endsOn : floor
}

export function EndSeriesDialog({
	rule,
	studentName,
	lessonDate,
	now,
	today,
	currentYear,
	onClose,
	onStale,
	onEnded,
}: EndSeriesDialogProps) {
	const toast = useToast()
	const [lastOn, setLastOn] = useState(() => initialDate(lessonDate, today, rule.endsOn))
	const [submitted, setSubmitted] = useState(false)
	const [pending, setPending] = useState(false)
	const [notice, setNotice] = useState<'stale' | 'failed' | null>(null)

	const error = lastOn === '' ? 'Choose a date.' : undefined
	const result = lastOn === '' ? null : endSeriesAt(rule, [], lastOn, now)
	const remains = result?.kind === 'ok' ? hasOccurrences({ startsOn: rule.startsOn, endsOn: result.endsOn }) : null

	async function submit() {
		if (pending) return
		setSubmitted(true)
		setNotice(null)
		if (error) return document.getElementById('end-series-last')?.focus()
		setPending(true)
		const response = await mutate({ kind: 'rule', seriesId: rule.id }, 'end', { lastOn })
		setPending(false)
		if (response.kind === 'stale') {
			setNotice('stale')
			onStale()
			return
		}
		if (response.kind === 'failed') {
			setNotice('failed')
			return
		}
		const series = response.data.series
		toast.show({
			title: 'Series ended',
			description:
				hasOccurrences(series) && series.endsOn !== null
					? `${studentName}'s last lesson is on ${formatDate(series.endsOn, currentYear)}.`
					: `${studentName}'s series was removed from the schedule.`,
		})
		onEnded()
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent size="sm" showCloseButton={!pending}>
				<DialogHeader>
					<DialogTitle>End this series?</DialogTitle>
					<DialogDescription>
						{studentName}, every {weekdayName(rule.weekday)} at {rule.startTime} VN.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					{notice === 'stale' ? (
						<Banner status="warning" data-slot="series-stale">
							<BannerTitle>{STALE_TITLE}</BannerTitle>
							<BannerDescription>{STALE_DATE}</BannerDescription>
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
							max={rule.endsOn ?? undefined}
							onChange={setLastOn}
							disabled={pending}
							error={submitted ? error : undefined}
						/>
						{result?.kind === 'ok' ? (
							remains ? (
								<p aria-live="polite" data-slot="end-series-hint" className="text-caption text-muted-foreground">
									The last lesson will be on {formatDate(result.endsOn, currentYear)}. Later lessons are removed from
									the schedule. Earlier lessons and any lessons you moved stay where they are.
								</p>
							) : (
								<p aria-live="polite" data-slot="end-series-hint" className="text-caption text-foreground">
									No lessons of this series will remain. Any lessons you moved stay where they are.
								</p>
							)
						) : null}
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
						onClick={() => void submit()}
					>
						{pending ? 'Ending…' : 'End series'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
