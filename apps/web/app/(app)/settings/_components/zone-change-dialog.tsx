'use client'

import { useEffect, useId, useRef } from 'react'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { formatDay, formatTime, secondWhen, yearInZone } from '@/lib/schedule-format'
import { sameTimeZone, zoneLabel, zoneName } from '@/lib/time-zones'

export type ZoneChangeExample = { title: string; startsAt: string }

interface ZoneChangeDialogProps {
	oldMain: string
	newMain: string
	secondZone: string | null
	at: Date
	example: ZoneChangeExample | null
	pending: boolean
	error: string | null
	stale: boolean
	onConfirm: () => void
	onClose: () => void
	onRefresh: () => void
}

function LessonExample({
	example,
	oldMain,
	newMain,
}: {
	example: ZoneChangeExample
	oldMain: string
	newMain: string
}) {
	const instant = new Date(example.startsAt)
	return (
		<div className="rounded-lg bg-hover p-3">
			<p className="mb-1 text-caption text-muted-foreground">Example</p>
			<p className="text-body tabular-nums">
				{example.title}, {formatDay(instant, oldMain, yearInZone(instant, oldMain))} ·{' '}
				<span className="whitespace-nowrap">
					{formatTime(instant, oldMain)} {zoneLabel(oldMain, instant)}
				</span>
				{' → '}
				<span className="whitespace-nowrap">{secondWhen(instant, oldMain, newMain)}</span>
			</p>
		</div>
	)
}

export function ZoneChangeDialog({
	oldMain,
	newMain,
	secondZone,
	at,
	example,
	pending,
	error,
	stale,
	onConfirm,
	onClose,
	onRefresh,
}: ZoneChangeDialogProps) {
	const descriptionId = useId()
	const changesId = useId()
	const staysId = useId()
	const keepRef = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		const frame = requestAnimationFrame(() => keepRef.current?.focus())
		return () => cancelAnimationFrame(frame)
	}, [])
	const oldName = zoneName(oldMain)
	const newName = zoneName(newMain)
	const oldLabel = zoneLabel(oldMain, at)
	const newLabel = zoneLabel(newMain, at)
	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose()
			}}
		>
			<DialogContent
				role="alertdialog"
				aria-describedby={`${descriptionId} ${changesId} ${staysId}`}
				aria-busy={pending}
				showCloseButton={false}
				className="max-h-[calc(100dvh-2rem)] max-w-110 overflow-y-auto rounded-xl bg-surface-5 p-5 [overflow-wrap:anywhere] shadow-surface-5"
			>
				<DialogHeader className="gap-1">
					<DialogTitle style={{ fontVariationSettings: '"wght" 600' }}>Change the default time zone?</DialogTitle>
					<DialogDescription id={descriptionId}>
						From {oldName} time ({oldLabel}) to {newName} time ({newLabel}).
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<section id={changesId} className="text-body">
						<h3 className="mb-2 font-semibold">What changes</h3>
						<ul className="flex list-disc flex-col gap-1.5 pl-4">
							<li>New lessons and series are created in {newName} time.</li>
							<li>
								Every time on screen is shown in {newName} time, and {oldLabel} becomes {newLabel}.
							</li>
							<li>
								Today and the day boundaries follow {newName} time, so a lesson near midnight can move to another day in
								balances.
							</li>
						</ul>
					</section>
					<section id={staysId} className="text-body">
						<h3 className="mb-2 font-semibold">What stays</h3>
						<ul className="flex list-disc flex-col gap-1.5 pl-4">
							<li>
								Lessons and series you already have keep the zone they were created in, so none of them moves in time.
							</li>
						</ul>
					</section>
					{example !== null ? <LessonExample example={example} oldMain={oldMain} newMain={newMain} /> : null}
					{secondZone !== null && sameTimeZone(secondZone, newMain) ? (
						<p className="text-caption text-muted-foreground">
							{newName} is also your second zone, so the second zone becomes {oldName} ({oldLabel}).
						</p>
					) : null}
					{error !== null ? (
						<div>
							<p role="alert" className="text-caption text-destructive">
								{error}
							</p>
							{stale ? (
								<Button type="button" variant="ghost" className="mt-2" disabled={pending} onClick={onRefresh}>
									Refresh
								</Button>
							) : null}
						</div>
					) : null}
				</div>
				<DialogFooter className="mt-4 flex-col-reverse sm:flex-row">
					<Button
						ref={keepRef}
						type="button"
						variant="ghost"
						autoFocus
						disabled={pending}
						onClick={onClose}
						className="h-auto min-h-10 w-full py-2 whitespace-normal sm:min-h-9 sm:w-auto"
					>
						Keep {oldName}
					</Button>
					<Button
						type="button"
						loading={pending}
						disabled={pending || stale}
						onClick={onConfirm}
						className="h-auto min-h-10 w-full py-2 whitespace-normal sm:min-h-9 sm:w-auto"
					>
						{pending ? 'Saving…' : `Change to ${newName}`}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
