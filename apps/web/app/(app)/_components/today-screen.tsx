'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CalendarDays, Users, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { EmptyState } from '@/components/app/empty-state'
import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { ReadError } from '@/components/app/read-error'
import { Stat } from '@/components/app/stat'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonStat, SkeletonText } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { hasStaleActions } from '@/lib/lesson-actions'
import { occurrenceSlot } from '@/lib/lesson-mark-text'
import { formatFullDate, formatTime, lessonCount, secondWhen, withSecond } from '@/lib/schedule-format'
import { spring } from '@/lib/springs'

import type { ScheduleBlock, ScheduleWeekResponse, TodayResponse } from '@dv-lab/contracts'
import {
	SCHEDULE_TIME_ZONE,
	countsAsLesson,
	scheduleDate,
	lessonsPhrase,
	scheduleToday,
	todayCounts,
	zonedInstant,
	type TodayCounts,
} from '@dv-lab/core'

import type { PairTarget } from '../schedule/_components/lesson-dialog'
import { LessonDialogs, readOverlapBlocks, type LessonSelection } from '../schedule/_components/lesson-dialogs'
import { RecordPaymentDialog } from '../students/[id]/_components/record-payment-dialog'
import { DueList } from './due-list'
import { LessonRows } from './today-lessons'
import { useMinuteNow } from './use-minute-now'

const SCHEDULE_HREF = '/schedule'
const STUDENTS_HREF = '/students'

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; data: TodayResponse }

async function readToday(): Promise<ReadState> {
	const result = await apiRequest<TodayResponse>('GET', '/today')
	return result.ok ? { kind: 'ready', data: result.data } : { kind: 'error' }
}

function dayTitle(date: string): string {
	return formatFullDate(zonedInstant(date, '12:00', SCHEDULE_TIME_ZONE), SCHEDULE_TIME_ZONE, Number(date.slice(0, 4)))
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
		now
	)
}

function nextBlock(blocks: readonly ScheduleBlock[], counts: TodayCounts): ScheduleBlock | null {
	if (counts.nextKey === null) return null
	return blocks.find((block) => block.key === counts.nextKey && countsAsLesson(block.outcome)) ?? null
}

function summaryLine(counts: TodayCounts, next: ScheduleBlock | null, zone: string | null): string {
	if (counts.lessons === 0) return 'No lessons today'
	const count = lessonCount(counts.lessons)
	if (next === null) return count
	const start = new Date(next.startsAt)
	const when = withSecond(`${formatTime(start, SCHEDULE_TIME_ZONE)} VN`, secondWhen(start, zone))
	return `${count} · next: ${next.studentName} at ${when}`
}

function lessonsOrFewer(threshold: number): string {
	return `${lessonsPhrase(threshold, 1)} or fewer left`
}

function Counters({ counts, threshold }: { counts: TodayCounts; threshold: number }) {
	const quiet = counts.lessons === 0
	return (
		<div className="@container">
			<div data-slot="today-counters" className="grid grid-cols-2 gap-3 @min-[40rem]:grid-cols-4">
				<Stat
					label="Today"
					value={counts.lessons}
					hint={quiet ? undefined : counts.toCome === 0 ? 'All started' : `${counts.toCome} still to come`}
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
				{Array.from({ length: 4 }, (_, index) => (
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
			{Array.from({ length: count }, (_, index) => (
				<li key={index} className={`flex items-center gap-3 px-3 ${rowClass}`}>
					<Skeleton className="h-3 w-14" />
					<Skeleton className="h-3 w-30" />
				</li>
			))}
		</ul>
	)
}

function LoadingPanels() {
	return (
		<div className="flex flex-col gap-4">
			<Panel id="today-lessons" title="Lessons today">
				<SkeletonRows count={5} rowClass="h-10" />
			</Panel>
			<Panel id="today-pays-soon" title="Pays soon">
				<SkeletonRows count={3} rowClass="h-8" />
			</Panel>
		</div>
	)
}

function WeekLink() {
	return (
		<Button variant="ghost" size="compact" nativeButton={false} render={<Link href={SCHEDULE_HREF} />}>
			Week
		</Button>
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
	const reduced = useReducedMotion()
	return (
		<div className="flex flex-col gap-4">
			<Panel id="today-lessons" title="Lessons today" action={<WeekLink />}>
				{lessons.length === 0 ? (
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
						transition={reduced ? { duration: spring.fast.duration, ease: 'easeOut' } : spring.fast}
					>
						<Panel
							id="today-earlier"
							title="Earlier, not marked"
							description="Lessons that took place and still need a mark."
						>
							<LessonRows
								blocks={earlier}
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

export function TodayScreen({ initialDate }: { initialDate: string }) {
	const now = useMinuteNow()
	const [payment, setPayment] = useState(false)
	const [paymentsVersion, setPaymentsVersion] = useState(0)
	const paymentButton = useRef<HTMLButtonElement>(null)
	const actions = (
		<Button ref={paymentButton} variant="tertiary" size="compact" leadingIcon={Wallet} onClick={() => setPayment(true)}>
			Add payment
		</Button>
	)

	function closePayment() {
		setPayment(false)
		requestAnimationFrame(() => paymentButton.current?.focus())
	}

	return (
		<>
			{now === null ? (
				<Shell title={dayTitle(initialDate)} description={<SkeletonText className="w-64 py-0.5" />} actions={actions}>
					<LoadingCounters />
					<LoadingPanels />
				</Shell>
			) : (
				<LoadedToday now={now} actions={actions} paymentsVersion={paymentsVersion} />
			)}
			{payment ? (
				<RecordPaymentDialog
					onClose={closePayment}
					onRecorded={() => {
						closePayment()
						setPaymentsVersion((value) => value + 1)
					}}
				/>
			) : null}
		</>
	)
}

function LoadedToday({ now, actions, paymentsVersion }: { now: Date; actions: ReactNode; paymentsVersion: number }) {
	const [state, setState] = useState<ReadState>({ kind: 'loading' })
	const [zone] = useSecondZone()
	const requests = useRef(0)
	const [selected, setSelected] = useState<LessonSelection | null>(null)
	const trigger = useRef<HTMLButtonElement | null>(null)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const weeks = useRef(new Map<string, ScheduleWeekResponse>())
	const latest = useRef<TodayResponse | null>(null)
	const router = useRouter()

	const load = useCallback(async () => {
		requests.current += 1
		const id = requests.current
		const next = await readToday()
		if (id === requests.current) {
			latest.current = next.kind === 'ready' ? next.data : null
			weeks.current.clear()
			setState(next)
		}
	}, [])

	useEffect(() => {
		let current = true
		requests.current += 1
		const id = requests.current
		void readToday().then((next) => {
			if (current && id === requests.current) {
				latest.current = next.kind === 'ready' ? next.data : null
				setState(next)
			}
		})
		return () => {
			current = false
		}
	}, [])

	useEffect(() => {
		if (paymentsVersion > 0) void load()
	}, [paymentsVersion, load])

	const today = scheduleToday(now)
	const answered = state.kind === 'ready' ? state.data.date : null
	const staleActions = state.kind === 'ready' && hasStaleActions(state.data.lessons, now)

	useEffect(() => {
		if (answered === null || (answered === today && !staleActions)) return
		void load()
	}, [now, answered, today, staleActions, load])

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
		const data = latest.current
		const blocks = data === null ? [] : [...data.lessons, ...data.earlier]
		const exists = blocks.some(
			(block) =>
				block.key === target.key &&
				occurrenceSlot(block.outcome) === target.slot &&
				scheduleDate(target.at) === scheduleDate(new Date(block.startsAt))
		)
		if (exists) setSelected({ key: target.key, slot: target.slot })
		else router.push(SCHEDULE_HREF)
	}

	if (state.kind === 'error') {
		return (
			<Shell title={dayTitle(today)} actions={actions}>
				<ReadError screen="Today" onRefresh={load} />
			</Shell>
		)
	}
	if (state.kind === 'loading') {
		return (
			<Shell title={dayTitle(today)} description={<SkeletonText className="w-64 py-0.5" />} actions={actions}>
				<LoadingCounters />
				<LoadingPanels />
			</Shell>
		)
	}

	const { data } = state
	const counts = countsOf(data, now)
	const next = nextBlock(data.lessons, counts)
	const openBlock =
		selected === null
			? null
			: ([...data.lessons, ...data.earlier].find(
					(block) => block.key === selected.key && occurrenceSlot(block.outcome) === selected.slot
				) ?? null)
	return (
		<Shell
			title={dayTitle(data.date)}
			description={summaryLine(counts, next, zone)}
			titleRef={titleRef}
			actions={actions}
		>
			<Counters counts={counts} threshold={data.paysSoonLessons} />
			<Panels data={data} counts={counts} now={now} zone={zone} onReload={load} onOpen={openLesson} />
			<LessonDialogs
				selected={openBlock}
				series={data.series}
				now={now}
				secondZone={zone}
				currentYear={Number(today.slice(0, 4))}
				today={today}
				blocksOn={(date) => readOverlapBlocks(date, weeks.current)}
				reload={load}
				onClose={closeLesson}
				onOpenPair={openPair}
			/>
		</Shell>
	)
}
