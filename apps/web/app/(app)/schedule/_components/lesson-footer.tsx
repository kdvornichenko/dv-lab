import type { RefObject } from 'react'

import { CalendarCheck2, CalendarClock, CalendarX2, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { mainDayAt } from '@/lib/schedule-format'

import type { LessonMarkKind, ScheduleBlock } from '@dv-lab/contracts'

const DONE_LINE = 'Marked Done: this lesson stays where it is. To move or cancel it, set the mark to Scheduled first.'
const NO_SHOW_KEPT = 'The mark is kept; a cancelled lesson deducts nothing.'

function InfoLine({ children, slot }: { children: string; slot: string }) {
	return (
		<p data-slot={slot} className="flex w-full items-start gap-2 text-caption text-muted-foreground">
			<Info aria-hidden className="mt-px size-3.5 shrink-0" />
			<span>{children}</span>
		</p>
	)
}

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
	mark = null,
	unavailable = null,
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
	mark?: LessonMarkKind | null
	unavailable?: string | null
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
	const done = mark === 'done' && !footerActions && !actions.restore
	return (
		<>
			{done && !moving ? (
				<DialogFooter>
					<InfoLine slot="lesson-done-line">{DONE_LINE}</InfoLine>
				</DialogFooter>
			) : null}
			{footerActions && !moving ? (
				<DialogFooter className={unavailable === null ? undefined : 'flex-col items-stretch'}>
					{unavailable === null ? null : <InfoLine slot="lesson-unavailable-line">{unavailable}</InfoLine>}
					{confirming && actions.cancel ? (
						<div
							role="alert"
							data-slot="lesson-cancel-question"
							className="flex w-full flex-wrap items-center justify-end gap-2"
						>
							<span className="mr-auto text-body text-foreground">
								{cancelQuestion(start, mainTimeZone)}
								{mark === 'no_show' ? (
									<span data-slot="lesson-cancel-mark" className="block text-caption text-muted-foreground">
										{NO_SHOW_KEPT}
									</span>
								) : null}
							</span>
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
				<DialogFooter className={unavailable === null ? undefined : 'flex-col items-stretch'}>
					{unavailable === null ? null : <InfoLine slot="lesson-unavailable-line">{unavailable}</InfoLine>}
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
