'use client'

import { useMemo, useRef, useState, type ReactNode, type Ref } from 'react'

import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Users, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { EmptyState } from '@/components/app/empty-state'
import { CalendarReadNotice } from '@/components/app/google-calendar-state'
import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { Stat } from '@/components/app/stat'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonCount, SkeletonStat, SkeletonText } from '@/components/ui/skeleton'
import { occurrenceSlot } from '@/lib/lesson-mark-text'
import { formatFullDate, formatTime, lessonCount, secondWhen, withSecond } from '@/lib/schedule-format'
import { spring } from '@/lib/springs'
import { zoneLabel } from '@/lib/time-zones'

import type { ScheduleBlock, TodayResponse } from '@dv-lab/contracts'
import { countsAsLesson, scheduleDate, lessonsPhrase, todayCounts, zonedInstant, type TodayCounts } from '@dv-lab/core'

import type { PairTarget } from '../schedule/_components/lesson-dialog'
import { LessonDialogs, type LessonSelection } from '../schedule/_components/lesson-dialogs'
import { RecordPaymentDialog } from '../students/[id]/_components/record-payment-dialog'
import { DueList } from './due-list'
import { LessonRows } from './today-lessons'
import { useMinuteNow } from './use-minute-now'
import { useToday } from './use-today'

const SCHEDULE_HREF = '/schedule'
const STUDENTS_HREF = '/students'

function dayTitle(date: string, mainTimeZone: string): string {
	return formatFullDate(zonedInstant(date, '12:00', mainTimeZone), mainTimeZone, Number(date.slice(0, 4)))
}

function countsOf(data: TodayResponse, now: Date): TodayCounts {
	return todayCounts(
		{
			lessons: data.lessons.map((block) => ({
				key: block.key,
				startsAt: new Date(block.startsAt),
				outcome: block.outcome,
				studentStatus: block.studentStatus,
				openingOn: block.ledger.openingOn,
			})),
			earlier: data.earlier.length,
			paysSoon: data.paysSoon.length,
		},
		now,
		data.defaultTimeZone
	)
}

function nextBlock(blocks: readonly ScheduleBlock[], counts: TodayCounts): ScheduleBlock | null {
	if (counts.nextKey === null) return null
	return blocks.find((block) => block.key === counts.nextKey && countsAsLesson(block.outcome)) ?? null
}

function summaryLine(
	counts: TodayCounts,
	next: ScheduleBlock | null,
	mainTimeZone: string,
	zone: string | null
): string {
	if (counts.lessons === 0) return 'No lessons today'
	const count = lessonCount(counts.lessons)
	if (next === null) return count
	const start = new Date(next.startsAt)
	const when = withSecond(
		`${formatTime(start, mainTimeZone)} ${zoneLabel(mainTimeZone, start)}`,
		secondWhen(start, mainTimeZone, zone)
	)
	return `${count} · next: ${next.studentName} at ${when}`
}

function lessonsOrFewer(threshold: number): string {
	return `${lessonsPhrase(threshold, 1)} or fewer left`
}

function Counters({
	counts,
	threshold,
	calendarRead,
}: {
	counts: TodayCounts
	threshold: number
	calendarRead: TodayResponse['calendarRead']
}) {
	const quiet = counts.lessons === 0
	return (
		<div className="@container">
			<div data-slot="today-counters" className="grid grid-cols-2 gap-3 @min-[40rem]:grid-cols-4">
				<Stat
					label="Today"
					value={calendarRead.state === 'unavailable' ? '—' : counts.lessons}
					hint={
						calendarRead.state !== 'fresh'
							? 'Read-only'
							: quiet
								? undefined
								: counts.toCome === 0
									? 'All started'
									: `${counts.toCome} still to come`
					}
				/>
				<Stat label="Done" value={counts.done} hint={quiet ? undefined : `of ${counts.started} started`} />
				<Stat
					label="To mark"
					value={counts.toMark}
					hint={counts.toMark === 0 ? undefined : `${counts.toMarkToday} today, ${counts.toMarkEarlier} earlier`}
				/>
				<Stat label="Pays soon" value={counts.paysSoon} hint={lessonsOrFewer(threshold)} />
			</div>
		</div>
	)
}

function LoadingCounters() {
	return (
		<div className="@container">
			<div className="grid grid-cols-2 gap-3 @min-[40rem]:grid-cols-4">
				{Array.from({ length: 4 }, (_: undefined, index) => (
					<SkeletonStat key={index} />
				))}
			</div>
		</div>
	)
}

function byStart(left: ScheduleBlock, right: ScheduleBlock): number {
	return Date.parse(left.startsAt) - Date.parse(right.startsAt)
}

function SkeletonRows({ count, rowClass }: { count: number; rowClass: string }) {
	return (
		<ul className="flex flex-col px-1 pb-2">
			{Array.from({ length: count }, (_: undefined, index) => (
				<li key={index} className={`flex items-center gap-3 px-3 ${rowClass}`}>
					<Skeleton className="h-3 w-14" />
					<Skeleton className="h-3 w-30" />
				</li>
			))}
		</ul>
	)
}

function WeekLink() {
	return (
		<Button variant="ghost" size="compact" nativeButton={false} render={<Link href={SCHEDULE_HREF} />}>
			Week
		</Button>
	)
}

function LoadingPanels() {
	return (
		<div className="flex flex-col gap-4">
			<Panel id="today-lessons" title="Lessons today" action={<WeekLink />}>
				<SkeletonRows count={5} rowClass="h-10" />
			</Panel>
			<Panel
				id="today-pays-soon"
				title="Pays soon"
				description={
					<>
						<SkeletonCount className="w-2.5" /> lessons or fewer left, or owing
					</>
				}
			>
				<SkeletonRows count={3} rowClass="h-8" />
			</Panel>
		</div>
	)
}

function Panels({
	data,
	counts,
	now,
	zone,
	onReload,
	onOpen,
}: {
	data: TodayResponse
	counts: TodayCounts
	now: Date
	zone: string | null
	onReload: () => Promise<void>
	onOpen: (block: ScheduleBlock, trigger: HTMLButtonElement) => void
}) {
	const lessons = [...data.lessons].sort(byStart)
	const earlier = [...data.earlier].sort(byStart)
	return (
		<div className="flex flex-col gap-4">
			<Panel id="today-lessons" title="Lessons today" action={<WeekLink />}>
				{lessons.length === 0 && data.calendarRead.state === 'fresh' ? (
					<EmptyState
						icon={CalendarDays}
						title="No lessons today"
						description="Add a lesson in the schedule."
						action={
							<Button variant="secondary" size="compact" nativeButton={false} render={<Link href={SCHEDULE_HREF} />}>
								Open schedule
							</Button>
						}
					/>
				) : (
					<LessonRows
						blocks={lessons}
						calendarWrite={data.calendarWrite}
						mainTimeZone={data.defaultTimeZone}
						now={now}
						showDate={false}
						nextKey={counts.nextKey}
						secondZone={zone}
						onSaved={onReload}
						onStale={onReload}
						onOpen={onOpen}
					/>
				)}
			</Panel>
			<AnimatePresence initial={false}>
				{earlier.length > 0 ? (
					<motion.div
						key="earlier"
						initial={false}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ type: 'tween', duration: spring.fast.duration, ease: 'easeOut' }}
					>
						<Panel
							id="today-earlier"
							title="Earlier, not marked"
							description="Lessons that took place and still need a mark."
						>
							<LessonRows
								blocks={earlier}
								calendarWrite={data.calendarWrite}
								mainTimeZone={data.defaultTimeZone}
								now={now}
								showDate
								nextKey={null}
								secondZone={zone}
								moreHref={SCHEDULE_HREF}
								onSaved={onReload}
								onStale={onReload}
								onOpen={onOpen}
							/>
						</Panel>
					</motion.div>
				) : null}
			</AnimatePresence>
			<Panel
				id="today-pays-soon"
				title="Pays soon"
				description={`${lessonsPhrase(data.paysSoonLessons, 1)} or fewer left, or owing`}
			>
				{data.paysSoon.length === 0 ? (
					<EmptyState
						icon={Users}
						title="Nobody needs to pay soon"
						description={`Students appear here when they have ${lessonsPhrase(data.paysSoonLessons, 1)} left or fewer, or owe lessons.`}
					/>
				) : (
					<DueList students={data.paysSoon} threshold={data.paysSoonLessons} moreHref={STUDENTS_HREF} />
				)}
			</Panel>
		</div>
	)
}

function Shell({
	title,
	description,
	children,
	titleRef,
	actions,
}: {
	title: string
	description?: ReactNode
	children: ReactNode
	titleRef?: Ref<HTMLHeadingElement>
	actions?: ReactNode
}) {
	return (
		<PageScroll>
			<PageHeader title={title} description={description} titleRef={titleRef} actions={actions} />
			{children}
		</PageScroll>
	)
}

function TodayLoading() {
	return (
		<Shell title="Today" description={<SkeletonText className="w-64 py-0.5" />}>
			<LoadingCounters />
			<LoadingPanels />
		</Shell>
	)
}

export function TodayScreen() {
	const minuteNow = useMinuteNow()
	return minuteNow === null ? <TodayLoading /> : <LoadedToday minuteNow={minuteNow} />
}

function LoadedToday({ minuteNow }: { minuteNow: Date }) {
	const { state, now, reload, calendar, getData } = useToday(minuteNow)
	const { data } = state
	const [zone] = useSecondZone(data?.defaultTimeZone ?? null)
	const [selected, setSelected] = useState<LessonSelection | null>(null)
	const [payment, setPayment] = useState(false)
	const paymentButton = useRef<HTMLButtonElement>(null)
	const trigger = useRef<HTMLButtonElement | null>(null)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const router = useRouter()
	const openBlock = useMemo(() => {
		if (selected === null || data === null) return null
		const block = [...data.lessons, ...data.earlier].find(
			(item) => item.key === selected.key && occurrenceSlot(item.outcome) === selected.slot
		)
		return block ?? null
	}, [data, selected])

	function closePayment() {
		setPayment(false)
		requestAnimationFrame(() => paymentButton.current?.focus())
	}

	function openLesson(block: ScheduleBlock, button: HTMLButtonElement) {
		trigger.current = button
		setSelected({ key: block.key, slot: occurrenceSlot(block.outcome) })
	}

	function closeLesson(target: LessonSelection | null) {
		setSelected(null)
		if (target === null) return
		requestAnimationFrame(() => {
			if (trigger.current?.isConnected) trigger.current.focus()
			else titleRef.current?.focus()
		})
	}

	function openPair(target: PairTarget) {
		const current = getData()
		const exists =
			current !== null &&
			[...current.lessons, ...current.earlier].some(
				(block) =>
					block.key === target.key &&
					occurrenceSlot(block.outcome) === target.slot &&
					scheduleDate(target.at, current.defaultTimeZone) ===
						scheduleDate(new Date(block.startsAt), current.defaultTimeZone)
			)
		if (exists) setSelected({ key: target.key, slot: target.slot })
		else router.push(SCHEDULE_HREF)
	}

	if (data === null) {
		return state.kind === 'error' ? (
			<Shell title="Today">
				<ReadError screen="Today" onRefresh={reload} />
			</Shell>
		) : (
			<TodayLoading />
		)
	}

	const mainTimeZone = data.defaultTimeZone
	const counts = countsOf(data, now)
	const next = nextBlock(data.lessons, counts)
	return (
		<>
			{state.kind === 'error' ? (
				<Shell title="Today">
					<ReadError screen="Today" onRefresh={reload} />
				</Shell>
			) : (
				<Shell
					title={dayTitle(data.date, mainTimeZone)}
					description={data.calendarRead.state === 'fresh' ? summaryLine(counts, next, mainTimeZone, zone) : undefined}
					titleRef={titleRef}
					actions={
						<Button
							ref={paymentButton}
							variant="tertiary"
							size="compact"
							leadingIcon={Wallet}
							onClick={() => setPayment(true)}
						>
							Add payment
						</Button>
					}
				>
					<CalendarReadNotice
						read={data.calendarRead}
						write={data.calendarWrite}
						timeZone={mainTimeZone}
						onRefresh={reload}
					/>
					<Counters counts={counts} threshold={data.paysSoonLessons} calendarRead={data.calendarRead} />
					<Panels
						key={`${mainTimeZone}:${data.date}`}
						data={data}
						counts={counts}
						now={now}
						zone={zone}
						onReload={reload}
						onOpen={openLesson}
					/>
				</Shell>
			)}
			<LessonDialogs
				selection={selected}
				selected={openBlock}
				mainTimeZone={mainTimeZone}
				currentMainTimeZone={mainTimeZone}
				asOf={data.asOf}
				series={data.series}
				calendar={calendar}
				now={now}
				secondZone={zone}
				reload={reload}
				onClose={closeLesson}
				onOpenPair={openPair}
			/>
			{payment ? (
				<RecordPaymentDialog
					mainTimeZone={mainTimeZone}
					currentMainTimeZone={mainTimeZone}
					asOf={data.asOf}
					onClose={closePayment}
					onRefresh={() => {
						closePayment()
						void reload()
					}}
					onRecorded={() => {
						closePayment()
						void reload()
					}}
				/>
			) : null}
		</>
	)
}
