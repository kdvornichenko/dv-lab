'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { ArrowRight, CalendarDays, CircleAlert, FileText, MessageSquare, Pencil, RefreshCw, Wallet } from 'lucide-react'
import Link from 'next/link'

import { useCalendarRefresh } from '@/components/app/calendar-command-provider'
import { Panel } from '@/components/app/layout-parts'
import { MoneyText } from '@/components/app/ledger-text'
import { MarkdownPreview } from '@/components/app/markdown-view'
import { Stat } from '@/components/app/stat'
import { StatusDot } from '@/components/app/status-dot'
import { balanceTone } from '@/components/app/student-balance'
import { TimePair } from '@/components/app/time-pair'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { apiRequest, peekApi, type ApiResult } from '@/lib/api-client'
import { formatDate, formatDay, formatTime, secondWhen, yearInZone } from '@/lib/schedule-format'
import { dayHref, lessonHref } from '@/lib/schedule-links'
import { zoneLabel } from '@/lib/time-zones'

import {
	studentBlocksResponse,
	studentCommentsResponse,
	type NoteBlock,
	type ScheduleOccurrenceRef,
	type StudentComment,
	type StudentDetail,
	type StudentLessonsResponse,
	type StudentTerm,
	type StudentTermsResponse,
} from '@dv-lab/contracts'
import { balanceState, formatLessons, formatMoney, lessonsPhrase, type BalanceState } from '@dv-lab/core'

import { GENDER_LABEL, StudentFormDialog } from '../../_components/student-form-dialog'
import { AccountPanel } from './account-panel'
import { HeldDates } from './held-dates'
import { OVERVIEW_GRID, OverviewLeftLoading } from './profile-loading'

export type OverviewTarget = 'lessons' | 'payments' | 'notes' | 'vocabulary'

interface OverviewTabProps {
	student: StudentDetail
	mainTimeZone: string
	asOf: string
	threshold: number
	refreshKey: number
	onSaved: () => Promise<boolean>
	autoOpenEdit: boolean
	onAutoOpened: () => void
	onOpenTab: (target: OverviewTarget, section?: string | null) => void
	onSetOpeningBalance: () => void
}

interface Reads {
	lessons: StudentLessonsResponse | null
	blocks: NoteBlock[]
	comments: StudentComment[]
	terms: StudentTerm[]
}

type ReadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; reads: Reads }

function overviewPaths(studentId: string) {
	return {
		lessons: `/students/${studentId}/lessons?range=since_payment`,
		blocks: `/students/${studentId}/blocks`,
		comments: `/students/${studentId}/comments?limit=3`,
		terms: `/students/${studentId}/terms`,
	}
}

async function readOverview(studentId: string, counted: boolean): Promise<ReadState> {
	const paths = overviewPaths(studentId)
	const [lessons, blocks, comments, terms] = await Promise.all([
		counted ? apiRequest<StudentLessonsResponse>('GET', paths.lessons) : Promise.resolve(null),
		apiRequest<unknown>('GET', paths.blocks),
		apiRequest<unknown>('GET', paths.comments),
		apiRequest<StudentTermsResponse>('GET', paths.terms),
	])
	return overviewFrom(lessons, blocks, comments, terms)
}

function peekOverview(studentId: string, counted: boolean): ReadState | null {
	const paths = overviewPaths(studentId)
	const lessons = counted ? peekApi<StudentLessonsResponse>(paths.lessons) : null
	const blocks = peekApi<unknown>(paths.blocks)
	const comments = peekApi<unknown>(paths.comments)
	const terms = peekApi<StudentTermsResponse>(paths.terms)
	if ((counted && lessons === null) || blocks === null || comments === null || terms === null) return null
	const state = overviewFrom(lessons, blocks, comments, terms)
	return state.kind === 'ready' ? state : null
}

function overviewFrom(
	lessons: ApiResult<StudentLessonsResponse> | null,
	blocks: ApiResult<unknown>,
	comments: ApiResult<unknown>,
	terms: ApiResult<StudentTermsResponse>
): ReadState {
	if ((lessons !== null && !lessons.ok) || !blocks.ok || !comments.ok || !terms.ok) return { kind: 'error' }
	const parsedBlocks = studentBlocksResponse.safeParse(blocks.data)
	const parsedComments = studentCommentsResponse.safeParse(comments.data)
	if (!parsedBlocks.success || !parsedComments.success) return { kind: 'error' }
	if (lessons !== null && lessons.ok && lessons.data.coverage === 'unread') return { kind: 'error' }
	return {
		kind: 'ready',
		reads: {
			lessons: lessons !== null && lessons.ok ? lessons.data : null,
			blocks: parsedBlocks.data.blocks,
			comments: parsedComments.data.comments,
			terms: terms.data.terms,
		},
	}
}

function NotSet() {
	return <span className="text-muted-foreground">Not set</span>
}

function textValue(value: string | null) {
	return value === null ? <NotSet /> : value
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex items-baseline justify-between gap-4 px-4 pb-2">
			<dt className="w-32 shrink-0 text-body text-muted-foreground">{label}</dt>
			<dd className="min-w-0 text-right text-body wrap-anywhere text-foreground">{children}</dd>
		</div>
	)
}

function keyRef(key: string): ScheduleOccurrenceRef | null {
	const [kind, id, on, ...rest] = key.split(':')
	if (rest.length > 0 || id === undefined) return null
	if (kind === 'l' && on === undefined) return { kind: 'single', lessonId: id }
	if (kind === 's' && on !== undefined) return { kind: 'series', seriesId: id, originalOn: on }
	return null
}

type RecentItem =
	| { kind: 'note'; id: string; at: string; label: string; body: string; section: string }
	| { kind: 'comment'; id: string; at: string; label: string; body: string; href: string }

function recentItems(blocks: readonly NoteBlock[], comments: readonly StudentComment[]): RecentItem[] {
	const items: RecentItem[] = []
	for (const block of blocks) {
		if (block.updatedAt === null || block.body.trim() === '') continue
		items.push({
			kind: 'note',
			id: block.id,
			at: block.updatedAt,
			label: block.name,
			body: block.body,
			section: block.key,
		})
	}
	for (const comment of comments) {
		const ref = keyRef(comment.lesson.key)
		const href =
			ref !== null && comment.lesson.startsAt !== null
				? lessonHref(comment.lesson.date, ref)
				: dayHref(comment.lesson.date)
		items.push({
			kind: 'comment',
			id: comment.id,
			at: comment.createdAt,
			label: 'Lesson comment',
			body: comment.body,
			href,
		})
	}
	return items.sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 3)
}

const FACT_LINK =
	'cursor-pointer rounded-sm text-caption text-foreground underline underline-offset-2 outline-none focus-visible:ring-1 focus-visible:ring-focus-ring'

function Fact({
	name,
	label,
	value,
	hint,
	corner,
}: {
	name: string
	label: string
	value: ReactNode
	hint: ReactNode
	corner?: ReactNode
}) {
	return (
		<div data-slot="overview-fact" data-fact={name} className="relative min-w-0">
			<Stat
				size="title"
				label={label}
				value={value}
				hint={hint}
				className={corner ? 'h-full px-4 py-3 pr-12' : 'h-full px-4 py-3'}
			/>
			{corner ? <div className="absolute top-2 right-2">{corner}</div> : null}
		</div>
	)
}

function balanceHintText(state: BalanceState, minutes: number | null, lessonMinutes: number) {
	if (state === 'owes' && minutes !== null) return `Owes ${lessonsPhrase(0 - minutes, lessonMinutes)}`
	if (state === 'pays_soon') return 'Pays soon'
	if (state === 'none_left') return 'No lessons left'
	return 'Plenty left'
}

function LessonsLeftFact({
	student,
	threshold,
	onSetOpeningBalance,
}: {
	student: StudentDetail
	threshold: number
	onSetOpeningBalance: () => void
}) {
	const minutes = student.balanceMinutes
	if (minutes === null) {
		return (
			<Fact
				name="lessons-left"
				label="Lessons left"
				value={<NotSet />}
				hint={
					<button type="button" className={FACT_LINK} onClick={onSetOpeningBalance}>
						Set opening balance
					</button>
				}
			/>
		)
	}
	const state = balanceState(minutes, student.defaultLessonMinutes, threshold)
	const tone = balanceTone(state)
	return (
		<Fact
			name="lessons-left"
			label="Lessons left"
			value={formatLessons(minutes, student.defaultLessonMinutes)}
			hint={
				<span className="inline-flex items-center gap-2">
					{tone === null ? null : <StatusDot tone={tone.tone} label={tone.label} passive />}
					{balanceHintText(state, minutes, student.defaultLessonMinutes)}
				</span>
			}
		/>
	)
}

function CornerLink({ href, label, children }: { href: string; label: string; children: ReactNode }) {
	return (
		<Tooltip side="top" content={label}>
			<Button variant="ghost" size="icon-compact" nativeButton={false} aria-label={label} render={<Link href={href} />}>
				{children}
			</Button>
		</Tooltip>
	)
}

function NextLessonFact({
	student,
	mainTimeZone,
	secondZone,
	year,
}: {
	student: StudentDetail
	mainTimeZone: string
	secondZone: string | null
	year: number
}) {
	const next = student.nextLesson
	if (next.result === 'known' && next.status.state !== 'unavailable') {
		const at = new Date(next.startsAt)
		const href =
			next.ref !== undefined && next.date !== undefined
				? lessonHref(next.date, next.ref)
				: dayHref(next.date ?? next.startsAt.slice(0, 10))
		return (
			<Fact
				name="next-lesson"
				label="Next lesson"
				value={formatDay(at, mainTimeZone, year)}
				hint={
					<TimePair
						as="span"
						main={`${formatTime(at, mainTimeZone)} ${zoneLabel(mainTimeZone, at)}`}
						second={secondWhen(at, mainTimeZone, secondZone)}
					/>
				}
				corner={
					<CornerLink href={href} label="Open in calendar">
						<CalendarDays />
					</CornerLink>
				}
			/>
		)
	}
	if (next.result === 'unknown' || next.status.state === 'unavailable') {
		return (
			<Fact
				name="next-lesson"
				label="Next lesson"
				value={<span className="text-muted-foreground">Unknown</span>}
				hint="Could not be determined"
			/>
		)
	}
	return (
		<Fact
			name="next-lesson"
			label="Next lesson"
			value={<span className="text-muted-foreground">None</span>}
			hint="No lessons planned"
		/>
	)
}

function LastPaymentFact({
	student,
	year,
	onViewPayments,
}: {
	student: StudentDetail
	year: number
	onViewPayments: () => void
}) {
	const payment = student.lastPayment ?? null
	if (payment === null) {
		return (
			<Fact
				name="last-payment"
				label="Last payment"
				value={<span className="text-muted-foreground">None</span>}
				hint="No payments yet"
			/>
		)
	}
	return (
		<Fact
			name="last-payment"
			label="Last payment"
			value={formatDate(payment.paidOn, year)}
			hint={`${formatMoney(payment.amountMinor, payment.currency)} · ${lessonsPhrase(payment.creditedMinutes, student.defaultLessonMinutes)}`}
			corner={
				<Tooltip side="top" content="View payments">
					<Button variant="ghost" size="icon-compact" aria-label="View payments" onClick={onViewPayments}>
						<Wallet />
					</Button>
				</Tooltip>
			}
		/>
	)
}

function RecentRow({
	item,
	mainTimeZone,
	year,
	onOpenNote,
}: {
	item: RecentItem
	mainTimeZone: string
	year: number
	onOpenNote: (section: string) => void
}) {
	const Icon = item.kind === 'note' ? FileText : MessageSquare
	const content = (
		<>
			<Icon aria-hidden size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="text-caption text-muted-foreground tabular-nums">
					{item.label} · {formatDay(new Date(item.at), mainTimeZone, year)}
				</span>
				<MarkdownPreview body={item.body} className="line-clamp-2 text-body wrap-anywhere text-foreground" />
			</span>
		</>
	)
	const className =
		'flex w-full cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-left outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-focus-ring'
	if (item.kind === 'comment') {
		return (
			<Link href={item.href} data-slot="overview-recent" data-kind="comment" className={className}>
				{content}
			</Link>
		)
	}
	return (
		<button
			type="button"
			data-slot="overview-recent"
			data-kind="note"
			className={className}
			onClick={() => onOpenNote(item.section)}
		>
			{content}
		</button>
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
			<div data-slot="overview-unread" className="flex flex-col items-center gap-4 px-6 py-12 text-center">
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

const WORDS_SHOWN = 6

export function OverviewTab({
	student,
	mainTimeZone,
	asOf,
	threshold,
	refreshKey,
	onSaved,
	autoOpenEdit,
	onAutoOpened,
	onOpenTab,
	onSetOpeningBalance,
}: OverviewTabProps) {
	const [editOpen, setEditOpen] = useState(autoOpenEdit)
	const [state, setState] = useState<ReadState>(
		() =>
			peekOverview(student.id, (student.lastPayment ?? null) !== null || student.openingBalance !== null) ?? {
				kind: 'loading',
			}
	)
	const [secondZone] = useSecondZone(mainTimeZone)
	const editButton = useRef<HTMLButtonElement>(null)
	const requests = useRef(0)
	const studentId = student.id
	const lastPayment = student.lastPayment ?? null
	const counted = lastPayment !== null || student.openingBalance !== null
	const year = yearInZone(new Date(asOf), mainTimeZone)

	useEffect(() => {
		if (autoOpenEdit) onAutoOpened()
	}, [autoOpenEdit, onAutoOpened])

	const load = useCallback(async () => {
		const request = ++requests.current
		const next = await readOverview(studentId, counted)
		if (request !== requests.current) return
		setState(next)
	}, [studentId, counted])

	useEffect(() => {
		const counter = requests
		void load()
		return () => {
			counter.current++
		}
	}, [load, refreshKey])

	useCalendarRefresh(load)

	const reads = state.kind === 'ready' ? state.reads : null
	const items = useMemo(() => (reads === null ? [] : recentItems(reads.blocks, reads.comments)), [reads])
	const words = useMemo(
		() =>
			reads === null
				? []
				: [...reads.terms].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
		[reads]
	)

	const lessons = reads?.lessons ?? null
	const sinceMode = lastPayment !== null
	const held = (lessons?.lessons ?? []).filter((lesson) => lesson.held && (sinceMode ? lesson.sinceLastPayment : true))
	const heldMinutes = held.reduce((sum, lesson) => sum + lesson.durationMinutes, 0)

	const facts = (
		<div className="grid gap-3 sm:grid-cols-3">
			<LessonsLeftFact student={student} threshold={threshold} onSetOpeningBalance={onSetOpeningBalance} />
			<NextLessonFact student={student} mainTimeZone={mainTimeZone} secondZone={secondZone} year={year} />
			<LastPaymentFact student={student} year={year} onViewPayments={() => onOpenTab('payments')} />
		</div>
	)

	let left: ReactNode
	if (state.kind === 'loading') {
		left = <OverviewLeftLoading studentName={student.displayName} mainTimeZone={mainTimeZone} />
	} else if (state.kind === 'error') {
		left = (
			<div className="flex min-w-0 flex-col gap-unit-1.5">
				{facts}
				<UnreadPanel onRefresh={load} />
			</div>
		)
	} else {
		left = (
			<div className="flex min-w-0 flex-col gap-unit-1.5" data-slot="overview-left" data-state="ready">
				{facts}
				{counted && lessons !== null ? (
					<HeldDates
						form="short"
						studentName={student.displayName}
						dates={held.map((lesson) => lesson.date)}
						minutes={heldMinutes}
						period={{ from: lessons.from, to: lessons.to }}
						sincePayment={sinceMode}
						lastPaidOn={lastPayment?.paidOn ?? null}
						beforePayment={[]}
						coverage={lessons.coverage === 'partial' ? 'partial' : 'complete'}
						mainTimeZone={mainTimeZone}
						onAllLessons={() => onOpenTab('lessons')}
					/>
				) : (
					<Banner status="info" data-slot="overview-not-counted">
						<BannerTitle>Held lessons appear here once a payment or an opening balance is recorded.</BannerTitle>
						<BannerActions className="col-start-2 row-start-2 my-0 mt-2 ml-0">
							<BannerAction onClick={() => onOpenTab('payments')}>Go to Payments</BannerAction>
						</BannerActions>
					</Banner>
				)}
				<Panel
					id="student-recent"
					title="Recent notes and comments"
					action={
						<Button variant="secondary" size="compact" trailingIcon={ArrowRight} onClick={() => onOpenTab('notes')}>
							{items.length === 0 ? 'Notes' : 'All notes'}
						</Button>
					}
				>
					{items.length === 0 ? (
						<p className="px-4 pb-4 text-body text-muted-foreground">No notes or comments yet.</p>
					) : (
						<div data-slot="overview-recent-list" className="flex flex-col px-2 pb-2">
							{items.map((item) => (
								<RecentRow
									key={`${item.kind}-${item.id}`}
									item={item}
									mainTimeZone={mainTimeZone}
									year={year}
									onOpenNote={(section) => onOpenTab('notes', section)}
								/>
							))}
						</div>
					)}
				</Panel>
				<Panel
					id="student-vocabulary"
					title="Vocabulary"
					action={
						<Button
							variant="secondary"
							size="compact"
							trailingIcon={ArrowRight}
							onClick={() => onOpenTab('vocabulary')}
						>
							All words
						</Button>
					}
				>
					{words.length === 0 ? (
						<p className="px-4 pb-4 text-body text-muted-foreground">No words yet.</p>
					) : (
						<div className="flex flex-col gap-3 px-4 pb-4">
							<p data-slot="overview-words-count" className="text-caption text-muted-foreground tabular-nums">
								{words.length === 1 ? '1 word' : `${words.length} words`} · the latest added
							</p>
							<div data-slot="overview-words" className="flex flex-wrap gap-2">
								{words.slice(0, WORDS_SHOWN).map((word) => (
									<span
										key={word.id}
										className="inline-flex h-7 max-w-full items-center rounded-md bg-(--tint) px-3 text-caption wrap-anywhere text-foreground"
									>
										{word.term}
									</span>
								))}
							</div>
						</div>
					)}
				</Panel>
			</div>
		)
	}

	return (
		<div className={OVERVIEW_GRID}>
			{left}
			<div className="flex min-w-0 flex-col gap-unit-1.5">
				<Panel
					id="student-details"
					title="Details"
					action={
						<Button
							ref={editButton}
							variant="secondary"
							size="compact"
							leadingIcon={Pencil}
							onClick={() => setEditOpen(true)}
						>
							Edit details
						</Button>
					}
				>
					<dl className="flex flex-col pt-2">
						<DetailRow label="Rate">
							{student.rateMinor === null ? (
								<NotSet />
							) : (
								<>
									<MoneyText amountMinor={student.rateMinor} currency={student.currency} /> per lesson
								</>
							)}
						</DetailRow>
						<DetailRow label="Lesson length">
							<span className="tabular-nums">{student.defaultLessonMinutes} min</span>
						</DetailRow>
						<DetailRow label="No-show">
							{student.noShowDeducts ? (
								'Deducts a lesson'
							) : (
								<span className="text-muted-foreground">Deducts nothing</span>
							)}
						</DetailRow>
						<DetailRow label="Gender">{student.gender === null ? <NotSet /> : GENDER_LABEL[student.gender]}</DetailRow>
						<DetailRow label="Parent">{textValue(student.parent)}</DetailRow>
						<DetailRow label="Level">{textValue(student.level)}</DetailRow>
						<DetailRow label="Goals">{textValue(student.goals)}</DetailRow>
						<DetailRow label="Time zone">{student.timeZone ?? 'Same as teacher'}</DetailRow>
					</dl>
				</Panel>
				<AccountPanel student={student} onChanged={onSaved} />
			</div>
			{editOpen ? (
				<StudentFormDialog
					mode="edit"
					student={student}
					onClose={() => {
						setEditOpen(false)
						requestAnimationFrame(() => editButton.current?.focus())
					}}
					onSaved={() => {
						setEditOpen(false)
						requestAnimationFrame(() => editButton.current?.focus())
						onSaved()
					}}
				/>
			) : null}
		</div>
	)
}
