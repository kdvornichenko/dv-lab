'use client'

import { useRef, useState, type ReactNode, type Ref } from 'react'

import { CalendarCheck2, CalendarClock, CalendarDays, CalendarX2, Eye, Info, MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Panel } from '@/components/app/layout-parts'
import { MoneyText } from '@/components/app/ledger-text'
import { DotShape } from '@/components/app/status-dot'
import { TimePair } from '@/components/app/time-pair'
import { Button } from '@/components/ui/button'
import { DropdownContent, DropdownMenu, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown'
import { MenuItem } from '@/components/ui/menu-item'
import { Tooltip } from '@/components/ui/tooltip'
import { statusTone, statusWord } from '@/lib/lesson-mark-text'
import { dayMonthShort, formatDay, formatTime, secondWhen, yearInZone } from '@/lib/schedule-format'
import { lessonHref } from '@/lib/schedule-links'
import { cn } from '@/lib/utils'

import type { LessonMarkKind, ScheduleBlock, StudentLesson } from '@dv-lab/contracts'
import { balancePhrase } from '@dv-lab/core'

import { TodayMarkControls } from '../../../_components/today-mark-controls'

const DONE_LINE = 'Marked Done: this lesson stays where it is. To move or cancel it, set the mark to Scheduled first.'

const GRID =
	'grid items-center gap-x-3 grid-cols-[auto_minmax(0,1fr)_auto] @min-[44rem]:grid-cols-[7rem_6.5rem_minmax(10rem,12rem)_minmax(6rem,1fr)_minmax(5rem,8rem)_3.75rem] @min-[50rem]:grid-cols-[7rem_6.5rem_minmax(10rem,12rem)_4.5rem_minmax(6rem,1fr)_minmax(5rem,8rem)_3.75rem]'

export interface LessonsTableProps {
	lessons: readonly StudentLesson[]
	now: Date
	mainTimeZone: string
	secondZone: string | null
	lessonMinutes: number
	readOnly: boolean
	blockOf: (lesson: StudentLesson) => ScheduleBlock
	registerTrigger: (key: string, node: HTMLButtonElement | null) => void
	onOpen: (lesson: StudentLesson) => void
	onRestore: (lesson: StudentLesson) => void
	onOpenPayment: (paymentId: string) => void
	onReload: () => Promise<void>
}

type RowProps = Omit<LessonsTableProps, 'lessons'> & { lesson: StudentLesson; next: boolean }

function BalanceAfter({ lesson, lessonMinutes }: { lesson: StudentLesson; lessonMinutes: number }) {
	const minutes = lesson.balanceAfterMinutes
	if (minutes === null) return <span className="text-muted-foreground">—</span>
	return (
		<span
			data-slot="lessons-balance-after"
			className={cn(
				'tabular-nums',
				lesson.projected ? 'text-muted-foreground' : minutes < 0 ? 'text-destructive' : '@min-[44rem]:text-foreground'
			)}
		>
			{balancePhrase(minutes, lessonMinutes, { short: true })}
		</span>
	)
}

function PaymentCell({
	lesson,
	onOpenPayment,
}: {
	lesson: StudentLesson
	onOpenPayment: LessonsTableProps['onOpenPayment']
}) {
	const payment = lesson.payment
	if (payment === null) return <span className="text-muted-foreground">—</span>
	return (
		<span className="flex min-w-0 flex-col">
			<button
				type="button"
				data-slot="lessons-payment-link"
				onClick={() => onOpenPayment(payment.id)}
				className="relative z-10 min-w-0 cursor-pointer truncate rounded-sm text-left tabular-nums underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus-ring"
			>
				{dayMonthShort(payment.paidOn)} · <MoneyText amountMinor={payment.amountMinor} currency={payment.currency} />
			</button>
			{payment.paidAfter ? <span className="text-micro text-muted-foreground">Paid after the lesson</span> : null}
		</span>
	)
}

function RowMenu({
	lesson,
	readOnly,
	triggerRef,
	onOpen,
	onRestore,
	subject,
}: {
	lesson: StudentLesson
	readOnly: boolean
	triggerRef: Ref<HTMLButtonElement>
	onOpen: () => void
	onRestore: () => void
	subject: string
}) {
	const router = useRouter()
	const href = lessonHref(lesson.date, lesson.ref)
	const done = lesson.outcome === 'done' || lesson.mark === 'done'
	const later = (action: () => void) => () => {
		window.setTimeout(action, 0)
	}
	const movable = !readOnly && lesson.actions.move
	const cancellable = !readOnly && lesson.actions.cancel
	const restorable = !readOnly && lesson.actions.restore
	let index = 0
	return (
		<DropdownMenu size="compact">
			<DropdownTrigger
				render={
					<Button
						ref={triggerRef}
						variant="ghost"
						size="icon-compact"
						data-slot="lessons-row-menu"
						aria-label={`More actions, ${subject}`}
					/>
				}
			>
				<MoreHorizontal />
			</DropdownTrigger>
			<DropdownContent align="end" className="w-56 min-w-56 bg-surface-4 shadow-surface-4">
				<MenuItem index={index++} label="Open lesson" icon={Eye} onSelect={later(onOpen)} />
				<MenuItem
					index={index++}
					label="Open in calendar"
					icon={CalendarDays}
					onSelect={later(() => router.push(href))}
				/>
				{movable || cancellable || restorable || (done && !readOnly) ? <DropdownSeparator /> : null}
				{movable ? (
					<MenuItem index={index++} label="Move lesson" icon={CalendarClock} onSelect={later(onOpen)} />
				) : null}
				{cancellable ? (
					<MenuItem index={index++} label="Cancel lesson" icon={CalendarX2} onSelect={later(onOpen)} />
				) : null}
				{restorable ? (
					<MenuItem index={index++} label="Return to schedule" icon={CalendarCheck2} onSelect={later(onRestore)} />
				) : null}
				{done && !readOnly ? (
					<p
						data-slot="lessons-done-line"
						className="flex items-start gap-2 px-3 py-2 text-caption text-muted-foreground"
					>
						<Info aria-hidden className="mt-px size-3.5 shrink-0" />
						<span>{DONE_LINE}</span>
					</p>
				) : null}
			</DropdownContent>
		</DropdownMenu>
	)
}

function OutcomeCell({
	lesson,
	block,
	readOnly,
	now,
	mainTimeZone,
	pending,
	failed,
	onPendingChange,
	onFailed,
	onReload,
}: {
	lesson: StudentLesson
	block: ScheduleBlock
	readOnly: boolean
	now: Date
	mainTimeZone: string
	pending: LessonMarkKind | null
	failed: boolean
	onPendingChange: (kind: LessonMarkKind | null) => void
	onFailed: (failed: boolean) => void
	onReload: () => Promise<void>
}) {
	const year = yearInZone(now, mainTimeZone)
	const control = !readOnly && block.actions.mark
	return (
		<div data-slot="lessons-outcome" className="relative z-10 flex min-w-0 flex-col items-start gap-0.5">
			{control ? (
				<TodayMarkControls
					block={block}
					mainTimeZone={mainTimeZone}
					pending={pending}
					onPendingChange={onPendingChange}
					onSaved={onReload}
					onStale={onReload}
					onError={onFailed}
				/>
			) : (
				<span data-slot="lessons-outcome-word" className="inline-flex items-center gap-2 text-body">
					<DotShape tone={statusTone(block, now)} />
					{statusWord(block, now, mainTimeZone, false)}
				</span>
			)}
			{lesson.movedFrom === null ? null : (
				<span className="text-micro text-muted-foreground">
					Moved from {formatDay(new Date(lesson.movedFrom), mainTimeZone, year)}
				</span>
			)}
			{failed ? (
				<span role="alert" className="text-caption text-destructive">
					Could not save the mark. Try again.
				</span>
			) : null}
		</div>
	)
}

function Row(props: RowProps) {
	const { lesson, next, now, mainTimeZone, secondZone, lessonMinutes, readOnly } = props
	const [pending, setPending] = useState<LessonMarkKind | null>(null)
	const [failed, setFailed] = useState(false)
	const triggerRef = useRef<HTMLButtonElement | null>(null)
	const block = props.blockOf(lesson)
	const start = new Date(lesson.startsAt)
	const year = yearInZone(now, mainTimeZone)
	const dateText = formatDay(start, mainTimeZone, year)
	const timeText = formatTime(start, mainTimeZone)
	const cancelled = lesson.outcome === 'cancelled'
	const subject = `${dateText}, ${timeText}`
	const busy = pending !== null
	const href = lessonHref(lesson.date, lesson.ref)
	function setTrigger(node: HTMLButtonElement | null) {
		triggerRef.current = node
		props.registerTrigger(lesson.key, node)
	}
	return (
		<li
			data-slot="lessons-row"
			data-key={lesson.key}
			data-outcome={lesson.outcome}
			data-next={next ? 'true' : 'false'}
			className={cn(
				GRID,
				'relative gap-y-1 rounded-lg px-3 py-2 text-body tabular-nums hover:bg-hover @min-[44rem]:min-h-12 @min-[44rem]:gap-y-0',
				cancelled && 'text-muted-foreground',
				next && 'bg-active font-semibold'
			)}
		>
			<div className="flex min-w-0 flex-col @max-[44rem]:col-start-1 @max-[44rem]:row-start-1">
				<button
					type="button"
					disabled={busy}
					data-slot="lessons-row-open"
					aria-label={`Open lesson, ${subject}`}
					onClick={() => props.onOpen(lesson)}
					className="min-w-0 cursor-pointer truncate text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-focus-ring"
				>
					{dateText}
				</button>
				<span className="hidden text-micro font-normal text-muted-foreground @min-[44rem]:block @min-[50rem]:hidden">
					{lesson.durationMinutes} min
				</span>
			</div>
			<TimePair
				className={cn('min-w-0 @max-[44rem]:col-start-2 @max-[44rem]:row-start-1', cancelled && 'line-through')}
				main={timeText}
				second={secondWhen(start, mainTimeZone, secondZone)}
			/>
			<div className="min-w-0 @max-[44rem]:col-span-3 @max-[44rem]:row-start-2">
				<OutcomeCell
					lesson={lesson}
					block={block}
					readOnly={readOnly}
					now={now}
					mainTimeZone={mainTimeZone}
					pending={pending}
					failed={failed}
					onPendingChange={setPending}
					onFailed={setFailed}
					onReload={props.onReload}
				/>
			</div>
			<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-micro font-normal text-muted-foreground @max-[44rem]:col-span-3 @max-[44rem]:row-start-3 @min-[44rem]:contents @min-[44rem]:text-body">
				<span className="@min-[44rem]:hidden @min-[50rem]:block @min-[50rem]:text-foreground">
					{lesson.durationMinutes} min
				</span>
				<span className="min-w-0 @min-[44rem]:text-foreground">
					<PaymentCell lesson={lesson} onOpenPayment={props.onOpenPayment} />
				</span>
				<span className="min-w-0">
					<BalanceAfter lesson={lesson} lessonMinutes={lessonMinutes} />
				</span>
			</div>
			<div className="relative z-10 flex items-center justify-end gap-1 @max-[44rem]:col-start-3 @max-[44rem]:row-start-1">
				<Tooltip side="top" content="Open in calendar">
					<Button
						variant="ghost"
						size="icon-compact"
						nativeButton={false}
						className="@max-[44rem]:hidden"
						aria-label={`Open in calendar, ${subject}`}
						render={<Link href={href} />}
					>
						<CalendarDays />
					</Button>
				</Tooltip>
				<RowMenu
					lesson={lesson}
					readOnly={readOnly}
					triggerRef={setTrigger}
					subject={subject}
					onOpen={() => props.onOpen(lesson)}
					onRestore={() => props.onRestore(lesson)}
				/>
			</div>
		</li>
	)
}

function Head() {
	return (
		<div
			aria-hidden
			data-slot="lessons-head"
			className={cn(GRID, 'hidden px-3 pt-3 pb-1 text-caption text-muted-foreground @min-[44rem]:grid')}
		>
			<span>Date</span>
			<span>Time</span>
			<span>Outcome</span>
			<span className="hidden @min-[50rem]:block">Duration</span>
			<span>Payment</span>
			<span>Balance after</span>
			<span />
		</div>
	)
}

function NowLine() {
	return (
		<li
			data-slot="lessons-now"
			aria-label="Now"
			className="flex items-center gap-2 px-3 py-1 text-caption font-semibold text-info"
		>
			<span aria-hidden>Now</span>
			<span aria-hidden className="h-px flex-1 bg-info" />
		</li>
	)
}

export function LessonsTable({ lessons, ...rest }: LessonsTableProps) {
	const nowMs = rest.now.getTime()
	const sorted = [...lessons].sort((left, right) => Date.parse(right.startsAt) - Date.parse(left.startsAt))
	const ahead = sorted.filter((lesson) => Date.parse(lesson.startsAt) > nowMs)
	const nextKey =
		[...ahead].reverse().find((lesson) => lesson.outcome === 'planned' && lesson.actions.move)?.key ?? null
	const showNow = ahead.length > 0 && ahead.length < sorted.length
	return (
		<Panel>
			<div data-slot="lessons-table" className="@container flex flex-col pb-2">
				<Head />
				<ul className="flex flex-col px-1 pt-1">
					{sorted.map((lesson, index) => (
						<RowOrNow key={lesson.key} showNow={showNow && index === ahead.length}>
							<Row lesson={lesson} next={lesson.key === nextKey} {...rest} />
						</RowOrNow>
					))}
				</ul>
			</div>
		</Panel>
	)
}

function RowOrNow({ showNow, children }: { showNow: boolean; children: ReactNode }) {
	return (
		<>
			{showNow ? <NowLine /> : null}
			{children}
		</>
	)
}
