'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CalendarDays, CircleAlert, ListFilter, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useCalendarController, useCalendarRefresh } from '@/components/app/calendar-command-provider'
import { EmptyState } from '@/components/app/empty-state'
import { Panel } from '@/components/app/layout-parts'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'
import { calendarEventFor, type CalendarLesson } from '@/lib/lesson-actions'
import { occurrenceSlot } from '@/lib/lesson-mark-text'

import type { ScheduleBlock, StudentDetail, StudentLesson, StudentLessonsResponse } from '@dv-lab/contracts'
import { scheduleDate, scheduleToday } from '@dv-lab/core'

import { useToast } from '../../../_components/toasts'
import { useMinuteNow } from '../../../_components/use-minute-now'
import type { PairTarget } from '../../../schedule/_components/lesson-dialog'
import { LessonDialogs, type LessonSelection } from '../../../schedule/_components/lesson-dialogs'
import { codeRefusal } from '../../../schedule/_components/optimistic-writes'
import { useScheduleMutation } from '../../../schedule/_components/schedule-mutations'
import { HeldDates } from './held-dates'
import {
	FilterChips,
	OutcomeFilter,
	RangeControl,
	ShowingLine,
	lessonsQuery,
	matchesOutcomes,
	outcomeCounts,
	type OutcomeKey,
	type RangeChoice,
} from './lessons-range'
import { LessonsTable } from './lessons-table'

type Read = { kind: 'error' } | { kind: 'ready'; data: StudentLessonsResponse }
type ReadState = { query: string; result: Read }

const SKELETON_ROWS = 4
const RESTORE_FAILURE = 'Could not apply this change. Refresh the calendar before trying again.'

async function readLessons(studentId: string, query: string): Promise<Read> {
	const result = await apiRequest<StudentLessonsResponse>('GET', `/students/${studentId}/lessons?${query}`)
	return result.ok ? { kind: 'ready', data: result.data } : { kind: 'error' }
}

function lessonBlock(lesson: StudentLesson, student: StudentDetail, lessonMinutes: number): ScheduleBlock {
	return {
		key: lesson.key,
		ref: lesson.ref,
		studentId: student.id,
		studentName: student.displayName,
		studentStatus: student.status,
		studentGoal: student.goals,
		startsAt: lesson.startsAt,
		timeZone: lesson.timeZone,
		durationMinutes: lesson.durationMinutes,
		movedTo: lesson.movedTo,
		movedFrom: lesson.movedFrom,
		outcome: lesson.outcome,
		actions: lesson.actions,
		ledger: {
			openingOn: student.openingBalance?.on ?? null,
			noShowDeducts: student.noShowDeducts,
			lessonMinutes,
		},
		mark: lesson.mark,
		markRevision: lesson.markRevision,
	}
}

function RowsLoading() {
	return (
		<ul className="flex flex-col gap-1 px-1 py-2" aria-hidden>
			{Array.from({ length: SKELETON_ROWS }, (_, index) => (
				<li key={index} className="flex h-12 items-center gap-3 px-3">
					<Skeleton className="h-3 w-20" />
					<Skeleton className="h-3 w-12" />
					<Skeleton className="h-3 w-24" />
					<Skeleton className="h-3 w-16" />
				</li>
			))}
		</ul>
	)
}

function UnreadPanel({ onRefresh }: { onRefresh: () => void | Promise<void> }) {
	const [pending, setPending] = useState(false)
	async function refresh() {
		setPending(true)
		try {
			await onRefresh()
		} finally {
			setPending(false)
		}
	}
	return (
		<Panel>
			<div data-slot="lessons-unread" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
				<span className="flex size-10 items-center justify-center rounded-full bg-hover text-muted-foreground">
					<CircleAlert size={20} strokeWidth={1.5} />
				</span>
				<div className="flex flex-col gap-1">
					<p className="text-title font-semibold text-foreground">Could not read these records.</p>
					<p className="text-body text-muted-foreground">Refresh before continuing.</p>
				</div>
				<Button variant="secondary" leadingIcon={RefreshCw} loading={pending} onClick={() => void refresh()}>
					Refresh records
				</Button>
			</div>
		</Panel>
	)
}

function RestoreRunner({
	lesson,
	event,
	studentName,
	mainTimeZone,
	onDone,
}: {
	lesson: StudentLesson
	event: CalendarLesson
	studentName: string
	mainTimeZone: string
	onDone: () => void
}) {
	const toast = useToast()
	const command = useScheduleMutation({
		mainTimeZone,
		date: scheduleDate(new Date(event.when.startsAt), mainTimeZone),
		event,
	})
	const started = useRef(false)
	useEffect(() => {
		if (started.current) return
		started.current = true
		void (async () => {
			const result = await command.mutate(event.binding.ref, 'restore', { expectedStartsAt: event.when.startsAt })
			if (result.kind === 'detached') return
			if (result.kind === 'ok')
				toast.show({ title: 'Lesson restored', description: `${studentName}. Google Calendar confirmed the change.` })
			else
				toast.show({
					title: 'Could not restore the lesson',
					description: (result.kind === 'failed' ? codeRefusal(result.code) : null) ?? RESTORE_FAILURE,
					status: 'error',
				})
			onDone()
		})()
	}, [command, event, lesson, studentName, onDone, toast])
	return null
}

interface LessonsTabProps {
	student: StudentDetail
	mainTimeZone: string
	asOf: string
	refreshKey: number
	onOpenPayments: (paymentId: string | null) => void
}

export function LessonsTab({ student, mainTimeZone, asOf, refreshKey, onOpenPayments }: LessonsTabProps) {
	const router = useRouter()
	const toast = useToast()
	const controller = useCalendarController()
	const [secondZone] = useSecondZone(mainTimeZone)
	const minute = useMinuteNow()
	const now = useMemo(() => minute ?? new Date(asOf), [minute, asOf])
	const today = scheduleToday(now, mainTimeZone)
	const lastPayment = student.lastPayment ?? null
	const [chosen, setChosen] = useState<RangeChoice>(() => ({ kind: lastPayment === null ? 'month' : 'since_payment' }))
	const choice: RangeChoice = chosen.kind === 'since_payment' && lastPayment === null ? { kind: 'month' } : chosen
	const [outcomes, setOutcomes] = useState<OutcomeKey[]>([])
	const [state, setState] = useState<ReadState | null>(null)
	const [selected, setSelected] = useState<LessonSelection | null>(null)
	const [restoring, setRestoring] = useState<{
		lesson: StudentLesson
		event: CalendarLesson
	} | null>(null)
	const requests = useRef(0)
	const triggers = useRef(new Map<string, HTMLButtonElement>())
	const trigger = useRef<HTMLButtonElement | null>(null)
	const query = lessonsQuery(choice, today)
	const queryRef = useRef({ id: student.id, query })

	const studentId = student.id
	const load = useCallback(
		async (id: string, next: string) => {
			const request = ++requests.current
			const result = await readLessons(id, next)
			if (request !== requests.current) return
			setState({ query: next, result })
		},
		[setState]
	)

	useEffect(() => {
		queryRef.current = { id: studentId, query }
		const counter = requests
		void load(studentId, query)
		return () => {
			counter.current++
		}
	}, [load, studentId, query, refreshKey])

	const reload = useCallback(() => load(queryRef.current.id, queryRef.current.query), [load])
	useCalendarRefresh(reload)

	const loading = state === null || state.query !== query
	const data = state !== null && state.result.kind === 'ready' ? state.result.data : null
	const lessonMinutes = data?.defaultLessonMinutes ?? student.defaultLessonMinutes

	const openBlock = useMemo(() => {
		if (selected === null || data === null) return null
		const lesson = data.lessons.find(
			(item) => item.key === selected.key && occurrenceSlot(item.outcome) === selected.slot
		)
		return lesson === undefined ? null : lessonBlock(lesson, student, lessonMinutes)
	}, [data, selected, student, lessonMinutes])

	function openLesson(lesson: StudentLesson) {
		trigger.current = triggers.current.get(lesson.key) ?? null
		setSelected({ key: lesson.key, slot: occurrenceSlot(lesson.outcome) })
	}

	function focusTrigger() {
		requestAnimationFrame(() => {
			if (trigger.current?.isConnected) trigger.current.focus()
		})
	}

	function closeLesson(target: LessonSelection | null) {
		setSelected(null)
		if (target !== null) focusTrigger()
	}

	function openPair(target: PairTarget) {
		const exists =
			data !== null &&
			data.lessons.some((lesson) => lesson.key === target.key && occurrenceSlot(lesson.outcome) === target.slot)
		if (exists) setSelected({ key: target.key, slot: target.slot })
		else router.push('/schedule')
	}

	async function restore(lesson: StudentLesson) {
		trigger.current = triggers.current.get(lesson.key) ?? null
		const window = await controller.readWindow(lesson.date)
		const event = window === null ? undefined : calendarEventFor(window, lesson.ref)
		if (event === undefined) {
			toast.show({ title: 'Could not restore the lesson', description: RESTORE_FAILURE, status: 'error' })
			focusTrigger()
			return
		}
		setRestoring({ lesson, event })
	}

	function registerTrigger(key: string, node: HTMLButtonElement | null) {
		if (node === null) triggers.current.delete(key)
		else triggers.current.set(key, node)
	}

	const sinceMode = choice.kind === 'since_payment'
	const resolved = data === null ? null : { from: data.from, to: data.to }
	const lessons = data?.lessons ?? []
	const counts = outcomeCounts(lessons)
	const shown = lessons.filter((lesson) => matchesOutcomes(lesson, outcomes))
	const held = lessons.filter((lesson) => lesson.held && (sinceMode ? lesson.sinceLastPayment : true))
	const heldMinutes = held.reduce((sum, lesson) => sum + lesson.durationMinutes, 0)
	const paidOn = data?.lastPayment?.paidOn ?? lastPayment?.paidOn ?? null
	const beforePayment = held.filter((lesson) => paidOn !== null && lesson.date < paidOn).map((lesson) => lesson.date)
	const unread = !loading && (state?.result.kind === 'error' || data?.coverage === 'unread')
	const partial = data?.coverage === 'partial'
	const empty = data !== null && lessons.length === 0
	const notCounted = data !== null && data.lastPayment === null && student.openingBalance === null
	const hasPayment = lastPayment !== null

	const controls = (
		<div data-slot="lessons-controls" className="flex flex-wrap items-center gap-2">
			<RangeControl
				choice={choice}
				today={today}
				hasPayment={hasPayment}
				paidOn={lastPayment?.paidOn ?? null}
				resolved={sinceMode && !loading ? resolved : null}
				onChange={(next) => {
					setChosen(next)
					setOutcomes([])
				}}
			/>
			<OutcomeFilter selected={outcomes} counts={counts} onChange={setOutcomes} />
		</div>
	)

	let body
	if (unread) {
		body = (
			<>
				{controls}
				<UnreadPanel onRefresh={reload} />
			</>
		)
	} else if (loading) {
		body = (
			<>
				<HeldDates
					form="full"
					loading
					studentName={student.displayName}
					dates={[]}
					minutes={0}
					period={{ from: today, to: today }}
					sincePayment={sinceMode}
					lastPaidOn={paidOn}
					beforePayment={[]}
					coverage="complete"
					mainTimeZone={mainTimeZone}
				/>
				{controls}
				<Panel>
					<RowsLoading />
				</Panel>
			</>
		)
	} else {
		body = (
			<>
				{partial ? (
					<Banner status="warning" role="alert" data-slot="lessons-partial">
						<BannerTitle>The full lesson range has not been checked. Refresh before making changes.</BannerTitle>
						<BannerActions className="col-start-2 row-start-2 my-0 mt-2 ml-0">
							<BannerAction leadingIcon={RefreshCw} onClick={() => void reload()}>
								Refresh records
							</BannerAction>
						</BannerActions>
					</Banner>
				) : null}
				{notCounted ? (
					<Banner status="info" data-slot="lessons-not-counted">
						<BannerTitle>Lessons are not counted yet: this student has no payment and no opening balance.</BannerTitle>
						<BannerActions className="col-start-2 row-start-2 my-0 mt-2 ml-0">
							<BannerAction onClick={() => onOpenPayments(null)}>Go to Payments</BannerAction>
						</BannerActions>
					</Banner>
				) : null}
				<HeldDates
					form="full"
					studentName={student.displayName}
					dates={held.map((lesson) => lesson.date)}
					minutes={heldMinutes}
					period={{ from: data?.from ?? today, to: data?.to ?? today }}
					sincePayment={sinceMode}
					lastPaidOn={paidOn}
					beforePayment={beforePayment}
					coverage={partial ? 'partial' : 'complete'}
					mainTimeZone={mainTimeZone}
				/>
				{controls}
				{data?.clipped ? (
					<p className="text-caption text-muted-foreground">The range was shortened to the last 366 days.</p>
				) : null}
				<FilterChips selected={outcomes} onChange={setOutcomes} />
				{empty ? (
					<Panel>
						<EmptyState
							icon={CalendarDays}
							title="No lessons in this range"
							description="Choose another range to view lessons."
							action={
								hasPayment && choice.kind !== 'since_payment' ? (
									<Button variant="secondary" size="compact" onClick={() => setChosen({ kind: 'since_payment' })}>
										Since last payment
									</Button>
								) : undefined
							}
						/>
					</Panel>
				) : shown.length === 0 ? (
					<Panel>
						<EmptyState
							icon={ListFilter}
							title="No lessons match"
							description="No lesson in this range has the chosen outcome."
							action={
								<Button variant="secondary" size="compact" onClick={() => setOutcomes([])}>
									Reset filter
								</Button>
							}
						/>
					</Panel>
				) : (
					<LessonsTable
						lessons={shown}
						now={now}
						mainTimeZone={mainTimeZone}
						secondZone={secondZone}
						lessonMinutes={lessonMinutes}
						readOnly={partial}
						blockOf={(lesson) => lessonBlock(lesson, student, lessonMinutes)}
						registerTrigger={registerTrigger}
						onOpen={openLesson}
						onRestore={(lesson) => void restore(lesson)}
						onOpenPayment={onOpenPayments}
						onReload={reload}
					/>
				)}
				{empty ? null : <ShowingLine shown={shown.length} total={lessons.length} totals={data?.totals ?? null} />}
			</>
		)
	}

	return (
		<div
			className="flex flex-col gap-4"
			data-slot="lessons-tab"
			data-state={unread ? 'unread' : loading ? 'loading' : partial ? 'partial' : empty ? 'empty' : 'ready'}
		>
			{body}
			<LessonDialogs
				selection={selected}
				selected={openBlock}
				series={[]}
				calendar={null}
				now={now}
				mainTimeZone={mainTimeZone}
				currentMainTimeZone={mainTimeZone}
				asOf={asOf}
				secondZone={secondZone}
				reload={reload}
				onClose={closeLesson}
				onOpenPair={openPair}
			/>
			{restoring === null ? null : (
				<RestoreRunner
					key={restoring.lesson.key}
					lesson={restoring.lesson}
					event={restoring.event}
					studentName={student.displayName}
					mainTimeZone={mainTimeZone}
					onDone={() => {
						setRestoring(null)
						void reload()
						focusTrigger()
					}}
				/>
			)}
		</div>
	)
}
