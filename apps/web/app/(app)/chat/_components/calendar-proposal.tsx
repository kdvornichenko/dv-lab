'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { CalendarCheck2, CalendarX2, Check, Info, LoaderCircle, Repeat, TriangleAlert, Undo2 } from 'lucide-react'

import { Panel } from '@/components/app/layout-parts'
import { TimePair } from '@/components/app/time-pair'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import {
	formatDate,
	formatDay,
	formatRange,
	mainRange,
	mainWhen,
	secondRange,
	weekdayName,
	yearInZone,
} from '@/lib/schedule-format'
import { dayHref, lessonHref } from '@/lib/schedule-links'
import { zoneLabel } from '@/lib/time-zones'

import type { ChatCalendarIssue, ChatCalendarProposalBlock } from '@dv-lab/contracts'
import { zonedParts } from '@dv-lab/core'

import { CalendarLink } from './agent-links'
import type { CalendarHandlers } from './messages'

const CHECK_EVERY_MS = 2000

const UNDO_CONFLICT = 'This event changed in Google Calendar after your action. Undo is unavailable.'

const ISSUE_LINES: Partial<Record<ChatCalendarIssue, string>> = {
	command_pending: 'Earlier calendar requests need recovery before you can make new changes.',
	outside_sync_window:
		'This week is outside the synced range, from 8 weeks back to 53 weeks ahead. Calendar changes are unavailable.',
	lesson_done: 'This lesson is marked Done, so it stays where it is.',
	connection_required: 'Connect Google Calendar to use the calendar.',
	provider_unavailable: 'Google Calendar is unavailable. Calendar changes are disabled.',
}

type Handlers = CalendarHandlers & { onUndo: (actionId: string) => void }

function Spinner({ size }: { size?: number }) {
	return <LoaderCircle size={size ?? 16} className="animate-spin" aria-hidden />
}

function question(block: ChatCalendarProposalBlock): string {
	if (block.operation === 'move_series') return `Move ${block.studentName}'s weekly lessons?`
	if (block.operation === 'cancel') return `Cancel ${block.studentName}'s lesson?`
	return `Move ${block.studentName}'s lesson?`
}

function OperationIcon({ block }: { block: ChatCalendarProposalBlock }) {
	if (block.operation === 'move_series') return <Repeat size={16} aria-hidden />
	if (block.operation === 'cancel') return <CalendarX2 size={16} aria-hidden />
	return <CalendarCheck2 size={16} aria-hidden />
}

function every(instant: Date, zone: string): string {
	const parts = zonedParts(instant, zone)
	return `Every ${weekdayName(parts.weekday)} at ${parts.time} ${zoneLabel(zone, instant)}`
}

function lessonMain(start: Date, minutes: number, zone: string, year: number): string {
	return `${formatDay(start, zone, year)}, ${formatRange(start, minutes, zone)} ${zoneLabel(zone, start)}`
}

function Place({
	label,
	start,
	minutes,
	series,
	zone,
	secondZone,
	year,
}: {
	label: string
	start: Date
	minutes: number
	series: boolean
	zone: string
	secondZone: string | null
	year: number
}) {
	const main = series ? every(start, zone) : lessonMain(start, minutes, zone, year)
	const second =
		secondZone === null ? null : series ? every(start, secondZone) : secondRange(start, minutes, zone, secondZone)
	return (
		<div className="grid grid-cols-[40px_1fr] gap-2 pl-6">
			<p className="pt-0.5 text-caption text-muted-foreground">{label}</p>
			<TimePair main={main} second={second} mainClassName="text-body text-foreground tabular-nums" />
		</div>
	)
}

function Rows({
	block,
	secondZone,
	year,
}: {
	block: ChatCalendarProposalBlock
	secondZone: string | null
	year: number
}) {
	const zone = block.timeZone
	const series = block.target.kind === 'series'
	return (
		<>
			<Place
				label="Was"
				start={new Date(block.lesson.startsAt)}
				minutes={block.lesson.durationMinutes}
				series={series}
				zone={zone}
				secondZone={secondZone}
				year={year}
			/>
			{block.target.kind === 'cancelled' ? (
				<div className="grid grid-cols-[40px_1fr] gap-2 pl-6">
					<p className="pt-0.5 text-caption text-muted-foreground">Now</p>
					<p className="text-body text-foreground">Cancelled</p>
				</div>
			) : (
				<Place
					label="Now"
					start={new Date(block.target.startsAt)}
					minutes={block.target.durationMinutes}
					series={series}
					zone={zone}
					secondZone={secondZone}
					year={year}
				/>
			)}
		</>
	)
}

function proposalLine(block: ChatCalendarProposalBlock, year: number): string {
	if (block.target.kind === 'series')
		return `From ${formatDate(block.target.from, year)}. Lessons with a mark or a comment, and the lessons before them, stay at their old time. A moved series cannot be undone from the chat.`
	if (block.target.kind === 'cancelled') return 'The lesson is cancelled in Google Calendar and deducts nothing.'
	return block.clearsNoShow
		? 'The Google Calendar event moves with it. The no-show is removed: the new start is later than now.'
		: 'The Google Calendar event moves with it.'
}

function savedLine(block: ChatCalendarProposalBlock, secondZone: string | null, year: number): string {
	const zone = block.timeZone
	const name = block.studentName
	if (block.target.kind === 'series') {
		const start = new Date(block.target.startsAt)
		const parts = zonedParts(start, zone)
		const main = `every ${weekdayName(parts.weekday)} at ${parts.time} ${zoneLabel(zone, start)}`
		const second = secondZone === null ? '' : ` (${zonedParts(start, secondZone).time} ${zoneLabel(secondZone, start)})`
		return `Calendar change saved. ${name}'s lessons now run ${main}${second} from ${formatDate(block.target.from, year)}.`
	}
	if (block.target.kind === 'cancelled') {
		const start = new Date(block.lesson.startsAt)
		return `Calendar change saved. ${name}'s lesson on ${formatDay(start, zone, year)}, ${mainRange(start, block.lesson.durationMinutes, zone, secondZone)} is cancelled.`
	}
	const start = new Date(block.target.startsAt)
	return `Calendar change saved. ${name}, ${formatDay(start, zone, year)}, ${mainRange(start, block.target.durationMinutes, zone, secondZone)}.`
}

function placeHref(block: ChatCalendarProposalBlock): string | null {
	const { target, lesson } = block
	if (target.kind === 'cancelled') {
		const date = target.date ?? lesson.date
		return date === undefined ? null : dayHref(date)
	}
	if (target.kind === 'series') return dayHref(target.from)
	return target.date !== undefined && lesson.ref !== undefined ? lessonHref(target.date, lesson.ref) : null
}

function Header({ icon, text, children }: { icon: ReactNode; text: string; children?: ReactNode }) {
	return (
		<div className="flex items-start gap-2">
			<span className="flex shrink-0 pt-0.5 text-muted-foreground">{icon}</span>
			<p className="min-w-0 flex-1 text-body font-semibold text-foreground">{text}</p>
			{children}
		</div>
	)
}

function Caption({ children, role }: { children: ReactNode; role?: 'status' }) {
	return (
		<p role={role} className="pl-6 text-caption text-muted-foreground tabular-nums">
			{children}
		</p>
	)
}

function useAutoCheck(active: boolean, check: () => Promise<void>) {
	const latest = useRef(check)
	useEffect(() => {
		latest.current = check
	}, [check])
	useEffect(() => {
		if (!active) return
		let busy = false
		const tick = () => {
			if (busy || document.visibilityState !== 'visible') return
			busy = true
			void latest.current().finally(() => {
				busy = false
			})
		}
		const timer = window.setInterval(tick, CHECK_EVERY_MS)
		return () => window.clearInterval(timer)
	}, [active])
}

function Applied({
	block,
	secondZone,
	year,
	onUndo,
}: {
	block: ChatCalendarProposalBlock
	secondZone: string | null
	year: number
	onUndo: (actionId: string) => void
}) {
	const status = useRef<HTMLDivElement>(null)
	const previous = useRef(block.undo)
	useEffect(() => {
		if (previous.current === 'pending' && block.undo !== 'pending') status.current?.focus()
		previous.current = block.undo
	}, [block.undo])
	if (block.undo === 'done') {
		const start = new Date(block.lesson.startsAt)
		return (
			<div ref={status} tabIndex={-1} role="status" className="flex flex-col gap-2 outline-none">
				<Header icon={<Undo2 size={16} aria-hidden />} text="Calendar change undone." />
				<Caption>{`${block.studentName}'s lesson is back at ${mainWhen(start, block.timeZone, secondZone, year)}.`}</Caption>
			</div>
		)
	}
	const pending = block.undo === 'pending'
	const undoable = block.undo === 'available' || pending
	const issue = block.undoIssue ? ISSUE_LINES[block.undoIssue] : undefined
	return (
		<div ref={status} tabIndex={-1} role="status" className="flex flex-col gap-2 outline-none">
			<Header icon={<Check size={16} aria-hidden />} text="Saved.">
				<CalendarLink href={placeHref(block)} />
				{undoable ? (
					<Button
						variant="ghost"
						size="compact"
						leadingIcon={pending ? Spinner : Undo2}
						disabled={pending}
						aria-busy={pending}
						aria-label={pending ? undefined : 'Undo: Calendar change saved'}
						onClick={() => onUndo(block.actionId)}
					>
						{pending ? 'Undoing…' : 'Undo'}
					</Button>
				) : null}
			</Header>
			<Caption>{savedLine(block, secondZone, year)}</Caption>
			{block.undo === 'stale' || issue !== undefined ? (
				<p className="flex items-start gap-2 pl-6 text-caption text-muted-foreground">
					<Info aria-hidden size={14} className="mt-0.5 shrink-0 text-info" />
					<span className="min-w-0 flex-1">{block.undo === 'stale' ? UNDO_CONFLICT : issue}</span>
				</p>
			) : null}
		</div>
	)
}

export function CalendarProposal({
	block,
	onConfirm,
	onCheck,
	onUndo,
}: { block: ChatCalendarProposalBlock } & Handlers) {
	const [secondZone] = useSecondZone(block.timeZone)
	const [kept, setKept] = useState(false)
	const [checking, setChecking] = useState(false)
	const year = yearInZone(new Date(), block.timeZone)
	const waiting = block.state === 'pending' || block.undo === 'pending'
	useAutoCheck(waiting, () => onCheck(block.actionId))

	const check = () => {
		if (checking) return
		setChecking(true)
		void onCheck(block.actionId).finally(() => setChecking(false))
	}

	if (block.state === 'failed' || block.state === 'stale') {
		const line =
			block.state === 'stale'
				? 'Ask again to use its current time.'
				: block.issue
					? ISSUE_LINES[block.issue]
					: undefined
		return (
			<Banner
				status={block.state === 'stale' ? 'warning' : 'error'}
				role="alert"
				data-slot="chat-calendar-change"
				data-state={block.state}
			>
				<BannerTitle>
					{block.state === 'stale'
						? 'This lesson changed after you asked. Nothing was changed.'
						: 'Google Calendar did not accept the change. Nothing was changed.'}
				</BannerTitle>
				{line ? <BannerDescription>{line}</BannerDescription> : null}
			</Banner>
		)
	}

	const name = question(block)
	return (
		<Panel>
			<div
				role="group"
				aria-label={name}
				aria-busy={block.state === 'submitting' || block.state === 'pending'}
				data-slot="chat-calendar-change"
				data-state={kept && block.state === 'proposed' ? 'kept' : block.state}
				className="flex flex-col gap-2 px-4 py-3"
			>
				{kept && block.state === 'proposed' ? (
					<div role="status">
						<Header icon={<Check size={16} aria-hidden />} text="Kept as it was. Nothing changed." />
					</div>
				) : block.state === 'applied' ? (
					<Applied block={block} secondZone={secondZone} year={year} onUndo={onUndo} />
				) : block.state === 'unknown' ? (
					<>
						<Header
							icon={<TriangleAlert size={16} className="text-warning" aria-hidden />}
							text="This calendar change has not been confirmed. Check its status before trying another change."
						/>
						<Rows block={block} secondZone={secondZone} year={year} />
						<div className="flex flex-wrap gap-2 pl-6">
							<Button
								variant="secondary"
								size="compact"
								disabled={checking}
								aria-busy={checking}
								leadingIcon={checking ? Spinner : undefined}
								onClick={check}
							>
								Check status
							</Button>
						</div>
					</>
				) : block.state === 'pending' && block.accepted ? (
					<>
						<Header icon={<Spinner />} text="Google Calendar accepted the change. Updating the schedule…" />
						<Rows block={block} secondZone={secondZone} year={year} />
					</>
				) : (
					<>
						<Header icon={<OperationIcon block={block} />} text={name} />
						<Rows block={block} secondZone={secondZone} year={year} />
						{block.state === 'proposed' ? (
							<Caption>{proposalLine(block, year)}</Caption>
						) : (
							<Caption role="status">Waiting for Google Calendar to confirm this change…</Caption>
						)}
						<div className="flex flex-wrap gap-2 pl-6">
							<Button
								variant="primary"
								size="compact"
								disabled={block.state !== 'proposed'}
								leadingIcon={block.state === 'proposed' ? undefined : Spinner}
								onClick={() => onConfirm(block.actionId)}
							>
								{block.state === 'proposed' ? 'Confirm' : 'Confirming…'}
							</Button>
							<Button
								variant="ghost"
								size="compact"
								disabled={block.state !== 'proposed'}
								onClick={() => setKept(true)}
							>
								Keep
							</Button>
						</div>
					</>
				)}
			</div>
		</Panel>
	)
}
