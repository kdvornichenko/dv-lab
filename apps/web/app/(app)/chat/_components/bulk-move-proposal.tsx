'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import { ArrowRight, Check, ChevronDown, Info, Minus, Repeat, TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { Panel } from '@/components/app/layout-parts'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerDescription, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { formatDate, weekdayName, yearInZone } from '@/lib/schedule-format'
import { dayHref } from '@/lib/schedule-links'
import { sameTimeZone, zoneLabel } from '@/lib/time-zones'
import { cn } from '@/lib/utils'

import type { ChatBulkMoveChange, ChatCalendarIssue, ChatChangeIssue, ChatChangeProposalBlock } from '@dv-lab/contracts'
import { zonedParts } from '@dv-lab/core'

import { Caption, Header, ISSUE_LINES, Place, Spinner, useAutoCheck } from './calendar-proposal'
import type { ChangeHandlers } from './messages'

export type BulkBlock = Omit<ChatChangeProposalBlock, 'change'> & { change: ChatBulkMoveChange }

export function isBulkMove(block: ChatChangeProposalBlock): block is BulkBlock {
	return block.change.operation === 'bulk_move'
}

type Target = ChatBulkMoveChange['targets'][number]

type Decision = 'confirm' | 'decline'

const VISIBLE = 3

const TOUCH = 'pointer-coarse:h-11'

const ASK_AGAIN = 'Ask again to move the remaining lessons.'

function issueLine(issue: ChatChangeIssue | undefined): string | null {
	if (issue === undefined) return null
	if (issue === 'calendar_changed') return 'The remaining lessons changed after you asked. The confirmed changes stay.'
	return ISSUE_LINES[issue as ChatCalendarIssue] ?? null
}

function plural(count: number, one: string, many: string): string {
	return `${count} ${count === 1 ? one : many}`
}

function counts(targets: readonly Target[]) {
	return {
		confirmed: targets.filter((target) => target.state === 'applied').length,
		unconfirmed: targets.filter((target) => target.state === 'pending' || target.state === 'failed').length,
		remaining: targets.filter((target) => target.state === 'not_started').length,
	}
}

function partialLine(targets: readonly Target[]): string {
	const { confirmed, unconfirmed, remaining } = counts(targets)
	return `${plural(confirmed, 'planned change', 'planned changes')} confirmed. ${unconfirmed} unconfirmed. ${remaining} not started.`
}

function question(change: ChatBulkMoveChange): string {
	return `Move ${change.studentName}'s weekly lessons?`
}

function TargetState({ state }: { state: Target['state'] }) {
	if (state === 'planned') return null
	const words = {
		pending: 'Waiting for Google Calendar…',
		applied: 'Confirmed',
		failed: 'Unconfirmed',
		not_started: 'Not started',
	}[state]
	return (
		<p
			data-slot="bulk-target-state"
			data-state={state}
			className={cn(
				'flex items-center gap-1.5 text-caption',
				state === 'failed' ? 'text-foreground' : 'text-muted-foreground'
			)}
		>
			{state === 'pending' ? (
				<Spinner size={14} />
			) : state === 'applied' ? (
				<Check size={14} aria-hidden />
			) : state === 'failed' ? (
				<TriangleAlert size={14} aria-hidden className="text-warning" />
			) : (
				<Minus size={14} aria-hidden />
			)}
			<span>{words}</span>
		</p>
	)
}

function TargetItem({
	target,
	change,
	secondZone,
	year,
	showFrom,
}: {
	target: Target
	change: ChatBulkMoveChange
	secondZone: string | null
	year: number
	showFrom: boolean
}) {
	const was = new Date(target.wasStartsAt)
	const now = new Date(target.nowStartsAt)
	const wasSecond = secondZone !== null && !sameTimeZone(secondZone, target.seriesTimeZone) ? secondZone : null
	const nowSecond = secondZone !== null && !sameTimeZone(secondZone, change.inputTimeZone) ? secondZone : null
	const weekday = zonedParts(was, target.seriesTimeZone).weekday
	return (
		<li
			data-slot="bulk-target"
			data-state={target.state}
			className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-border py-2"
		>
			<div className="flex min-w-[min(100%,15rem)] flex-1 flex-col gap-0.5">
				<p className="text-body font-medium wrap-anywhere text-foreground">{`${weekdayName(weekday)}s`}</p>
				<Place
					label="Was"
					start={was}
					minutes={target.durationMinutes}
					series
					zone={target.seriesTimeZone}
					secondZone={wasSecond}
					year={year}
					className=""
				/>
				<Place
					label="Now"
					start={now}
					minutes={target.durationMinutes}
					series
					zone={change.inputTimeZone}
					secondZone={nowSecond}
					year={year}
					className=""
				/>
				<p className="text-micro wrap-anywhere text-muted-foreground">
					{`Series zone ${zoneLabel(target.seriesTimeZone, was)} · New rule zone ${zoneLabel(change.inputTimeZone, now)}`}
				</p>
				<p className="text-micro text-muted-foreground">
					{showFrom ? `From ${formatDate(target.from, year)} · And future occurrences` : 'And future occurrences'}
				</p>
			</div>
			<TargetState state={target.state} />
		</li>
	)
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)] gap-2 pl-6 sm:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)]">
			<p className="pt-0.5 text-caption text-muted-foreground">{label}</p>
			<div className="min-w-0 text-body wrap-anywhere text-foreground tabular-nums">{children}</div>
		</div>
	)
}

function Targets({
	change,
	secondZone,
	year,
	listId,
}: {
	change: ChatBulkMoveChange
	secondZone: string | null
	year: number
	listId: string
}) {
	const [open, setOpen] = useState(false)
	const many = change.targets.length > VISIBLE
	const shown = many && !open ? change.targets.slice(0, VISIBLE) : change.targets
	const froms = new Set(change.targets.map((target) => target.from))
	return (
		<>
			<div className="pl-6">
				<ul id={listId} className="border-t border-border">
					{shown.map((target) => (
						<TargetItem
							key={target.seriesId}
							target={target}
							change={change}
							secondZone={secondZone}
							year={year}
							showFrom={froms.size > 1}
						/>
					))}
				</ul>
			</div>
			{many ? (
				<div className="pl-6">
					<Button
						variant="ghost"
						size="compact"
						className={cn('text-caption text-muted-foreground', TOUCH)}
						aria-expanded={open}
						aria-controls={listId}
						onClick={() => setOpen((value) => !value)}
					>
						{open ? 'Show fewer selected changes' : 'Show all selected changes'}
						<ChevronDown
							size={14}
							aria-hidden
							className={cn('transition-transform duration-120', open && 'rotate-180')}
						/>
					</Button>
				</div>
			) : null}
		</>
	)
}

function Scope({
	change,
	secondZone,
	year,
	listId,
}: {
	change: ChatBulkMoveChange
	secondZone: string | null
	year: number
	listId: string
}) {
	const first = new Date(change.targets[0]?.nowStartsAt ?? 0)
	const from = change.targets.map((target) => target.from).sort()[0] ?? ''
	const display = sameTimeZone(change.accountTimeZone, change.inputTimeZone) ? null : change.accountTimeZone
	return (
		<>
			<Row label="Input time zone">
				<p>{zoneLabel(change.inputTimeZone, first)}</p>
			</Row>
			{change.zoneNamed ? null : (
				<p className="flex items-start gap-2 pl-6 text-caption text-muted-foreground">
					<Info aria-hidden size={14} className="mt-0.5 shrink-0 text-info" />
					<span className="min-w-0 flex-1">No time zone was named. These times use Vietnam time (VN).</span>
				</p>
			)}
			{display === null ? null : (
				<Row label="Display time zone">
					<p>{zoneLabel(display, first)}</p>
					{secondZone === null ? null : (
						<p className="text-micro text-muted-foreground">{`${zoneLabel(secondZone, first)} as the second zone`}</p>
					)}
				</Row>
			)}
			<Row label="From">
				<p>{`${formatDate(from, year)}, ${zoneLabel(change.inputTimeZone, first)}`}</p>
			</Row>
			<Row label="Moves">
				<p>{`${plural(change.targets.length, 'planned change', 'planned changes')}: ${change.targets.length} weekly series`}</p>
			</Row>
			<Targets change={change} secondZone={secondZone} year={year} listId={listId} />
		</>
	)
}

function stayLines(change: ChatBulkMoveChange): string {
	const base = 'Lessons with a mark or a comment, and the lessons before them, stay at their old time.'
	const singles =
		change.singlesLeft === 0
			? ''
			: ` ${change.singlesLeft === 1 ? '1 single lesson at this time is not moved.' : `${change.singlesLeft} single lessons at this time are not moved.`}`
	return `${base}${singles} A moved series cannot be undone from the chat.`
}

function scheduleHref(change: ChatBulkMoveChange): string | null {
	const first = change.targets
		.map((target) => zonedParts(new Date(target.nowStartsAt), change.inputTimeZone).date)
		.sort()[0]
	return first === undefined ? null : dayHref(first)
}

export function BulkMoveProposal({
	block,
	onConfirm,
	onDecline,
	onCheck,
}: { block: BulkBlock } & Pick<ChangeHandlers, 'onConfirm' | 'onDecline'> & {
		onCheck: (actionId: string) => Promise<void>
	}) {
	const { change } = block
	const [secondZone] = useSecondZone(change.accountTimeZone)
	const [pending, setPending] = useState<Decision | null>(null)
	const [checking, setChecking] = useState(false)
	const [unknown, setUnknown] = useState(false)
	const status = useRef<HTMLDivElement>(null)
	const previous = useRef(block.state)
	const listId = `bulk-${block.actionId}`
	const year = yearInZone(new Date(), change.inputTimeZone)
	const waiting = block.state === 'pending'
	const busy = block.state === 'applying' || pending !== null || waiting
	useAutoCheck(waiting, () => onCheck(block.actionId))

	useEffect(() => {
		if (
			(previous.current === 'applying' || previous.current === 'pending') &&
			block.state !== 'applying' &&
			block.state !== 'pending' &&
			block.state !== 'proposed'
		)
			status.current?.focus()
		previous.current = block.state
	}, [block.state])

	const decide = async (decision: Decision) => {
		if (pending !== null || block.state !== 'proposed') return
		setPending(decision)
		const known = await (decision === 'confirm' ? onConfirm : onDecline)(block.actionId)
		setPending(null)
		setUnknown(!known)
	}

	const check = () => {
		if (checking) return
		setChecking(true)
		void onCheck(block.actionId).finally(() => setChecking(false))
	}

	const checkButton = (
		<div className="flex flex-wrap gap-2 pl-6">
			<Button
				variant="secondary"
				size="compact"
				className={TOUCH}
				disabled={checking}
				aria-busy={checking}
				leadingIcon={checking ? Spinner : undefined}
				onClick={check}
			>
				Check status
			</Button>
		</div>
	)

	if (block.state === 'stale') {
		return (
			<Banner status="warning" role="alert" data-slot="chat-change" data-operation="bulk_move" data-state="stale">
				<BannerTitle>This proposal is out of date. Nothing was changed.</BannerTitle>
				<BannerDescription>Ask again to use the current details.</BannerDescription>
			</Banner>
		)
	}

	const name = question(change)
	const summary = counts(change.targets)

	function body() {
		if (unknown && block.state === 'proposed')
			return (
				<>
					<Header
						icon={<TriangleAlert size={16} className="text-warning" aria-hidden />}
						text="Could not load this change's status."
					/>
					<Scope change={change} secondZone={secondZone} year={year} listId={listId} />
				</>
			)
		switch (block.state) {
			case 'applied': {
				const href = scheduleHref(change)
				return (
					<div ref={status} tabIndex={-1} role="status" className="flex flex-col gap-2 outline-none">
						<Header icon={<Check size={16} aria-hidden />} text="Lessons moved." />
						<Caption>{`${plural(summary.confirmed, 'planned change', 'planned changes')} confirmed in Google Calendar.`}</Caption>
						<Targets change={change} secondZone={secondZone} year={year} listId={listId} />
						{href === null ? null : (
							<div className="flex flex-wrap gap-2 pl-6">
								<Button
									variant="ghost"
									size="compact"
									className={`${TOUCH} h-auto min-h-7 py-1 whitespace-normal`}
									leadingIcon={ArrowRight}
									nativeButton={false}
									aria-label={`View schedule: ${change.studentName}`}
									render={<Link href={href} />}
								>
									View schedule
								</Button>
							</div>
						)}
					</div>
				)
			}
			case 'partial':
			case 'failed': {
				const line = issueLine(block.issue)
				const none = block.state === 'failed' && summary.confirmed === 0
				return (
					<div ref={status} tabIndex={-1} role="status" className="flex flex-col gap-2 outline-none">
						<Header
							icon={<TriangleAlert size={16} className="text-warning" aria-hidden />}
							text={
								none
									? 'Google Calendar did not accept the change. Nothing was changed.'
									: 'Some changes are confirmed. The move is not complete.'
							}
						/>
						{none ? null : <Caption>{partialLine(change.targets)}</Caption>}
						<Targets change={change} secondZone={secondZone} year={year} listId={listId} />
						{line === null ? null : (
							<p className="flex items-start gap-2 pl-6 text-caption text-muted-foreground">
								<Info aria-hidden size={14} className="mt-0.5 shrink-0 text-info" />
								<span className="min-w-0 flex-1">{line}</span>
							</p>
						)}
						<Caption>{ASK_AGAIN}</Caption>
						{block.state === 'partial' && summary.unconfirmed > 0 ? checkButton : null}
					</div>
				)
			}
			case 'declined':
				return (
					<>
						<div className="flex flex-col gap-2 opacity-60">
							<Header icon={<Repeat size={16} aria-hidden />} text={name} />
							<Scope change={change} secondZone={secondZone} year={year} listId={listId} />
						</div>
						<div
							ref={status}
							tabIndex={-1}
							role="status"
							className="flex items-start gap-2 pl-6 text-caption text-muted-foreground outline-none"
						>
							<Info aria-hidden size={14} className="mt-0.5 shrink-0 text-info" />
							<span className="min-w-0 flex-1">Proposal declined. This proposal made no changes.</span>
						</div>
					</>
				)
			case 'pending':
				return (
					<>
						<Header icon={<Spinner />} text={name} />
						<Scope change={change} secondZone={secondZone} year={year} listId={listId} />
						<Caption role="status">Waiting for Google Calendar to confirm this change…</Caption>
						{checkButton}
					</>
				)
			default:
				return (
					<>
						<Header icon={<Repeat size={16} aria-hidden />} text={name} />
						<Scope change={change} secondZone={secondZone} year={year} listId={listId} />
						<Caption>{stayLines(change)}</Caption>
						<p role="status" className="sr-only">
							{busy ? (pending === 'decline' ? '' : 'Moving lessons…') : 'Waiting for your decision.'}
						</p>
						<div className="flex flex-wrap gap-2 pl-6">
							<Button
								variant="primary"
								size="compact"
								className={TOUCH}
								disabled={busy}
								leadingIcon={busy && pending !== 'decline' ? Spinner : undefined}
								onClick={() => void decide('confirm')}
							>
								{busy && pending !== 'decline' ? 'Moving lessons…' : 'Move lessons'}
							</Button>
							<Button
								variant="ghost"
								size="compact"
								className={TOUCH}
								disabled={busy}
								leadingIcon={pending === 'decline' ? Spinner : undefined}
								onClick={() => void decide('decline')}
							>
								Keep lesson times
							</Button>
						</div>
					</>
				)
		}
	}

	return (
		<Panel>
			<div
				role="group"
				aria-label={name}
				aria-busy={busy}
				data-slot="chat-change"
				data-operation="bulk_move"
				data-state={unknown && block.state === 'proposed' ? 'unknown' : block.state}
				className="flex flex-col gap-2 px-4 py-3"
			>
				{body()}
			</div>
		</Panel>
	)
}
