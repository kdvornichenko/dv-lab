import type { RefObject } from 'react'

import { CalendarCheck2, CalendarClock, CalendarX2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { mainDayAt } from '@/lib/schedule-format'

import type { ScheduleBlock } from '@dv-lab/contracts'

function cancelQuestion(start: Date, mainTimeZone: string): string {
	return `Cancel the lesson on ${mainDayAt(start, mainTimeZone, null)}?`
}

export function LessonFooter({
	block,
	mainTimeZone,
	confirming,
	moving,
	pending,
	locked,
	moveButton,
	onKeep,
	onCancel,
	onRestore,
	onMove,
	onConfirm,
	onEndSeries,
}: {
	block: Pick<ScheduleBlock, 'startsAt'> & { actions: Pick<ScheduleBlock['actions'], 'move' | 'cancel' | 'restore'> }
	mainTimeZone: string
	confirming: boolean
	moving: boolean
	pending: boolean
	locked: boolean
	moveButton: RefObject<HTMLButtonElement | null>
	onKeep: () => void
	onCancel: () => void
	onRestore: () => void
	onMove: () => void
	onConfirm: () => void
	onEndSeries?: () => void
}) {
	const start = new Date(block.startsAt)
	const { actions } = block
	const footerActions = actions.move || actions.cancel
	return (
		<>
			{footerActions && !moving ? (
				<DialogFooter>
					{confirming && actions.cancel ? (
						<div
							role="alert"
							data-slot="lesson-cancel-question"
							className="flex w-full flex-wrap items-center justify-end gap-2"
						>
							<span className="mr-auto text-body text-foreground">{cancelQuestion(start, mainTimeZone)}</span>
							<Button type="button" variant="ghost" size="compact" disabled={locked} onClick={onKeep}>
								Keep
							</Button>
							<Button
								type="button"
								size="compact"
								leadingIcon={CalendarX2}
								loading={pending}
								disabled={locked}
								onClick={onCancel}
							>
								{pending ? 'Cancelling…' : 'Yes, cancel'}
							</Button>
						</div>
					) : (
						<div className="flex w-full flex-wrap items-center justify-end gap-2">
							{actions.move ? (
								<Button
									ref={moveButton}
									type="button"
									variant="secondary"
									size="compact"
									leadingIcon={CalendarClock}
									disabled={locked}
									onClick={onMove}
								>
									Move lesson
								</Button>
							) : null}
							{actions.cancel ? (
								<Button
									type="button"
									variant="ghost"
									size="compact"
									leadingIcon={CalendarX2}
									disabled={locked}
									onClick={onConfirm}
								>
									Cancel lesson
								</Button>
							) : null}
							{onEndSeries !== undefined ? (
								<Button type="button" variant="ghost" size="compact" disabled={locked} onClick={onEndSeries}>
									End series
								</Button>
							) : null}
						</div>
					)}
				</DialogFooter>
			) : null}
			{actions.restore ? (
				<DialogFooter>
					<Button
						type="button"
						variant="secondary"
						size="compact"
						leadingIcon={CalendarCheck2}
						loading={pending}
						disabled={locked}
						onClick={onRestore}
					>
						Return to schedule
					</Button>
				</DialogFooter>
			) : null}
		</>
	)
}
