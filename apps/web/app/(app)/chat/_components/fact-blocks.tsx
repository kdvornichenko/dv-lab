'use client'

import { useState } from 'react'

import { CalendarDays, Users } from 'lucide-react'
import Link from 'next/link'

import { EmptyState } from '@/components/app/empty-state'
import { Panel } from '@/components/app/layout-parts'
import { MarkdownView } from '@/components/app/markdown-view'
import { TimePair } from '@/components/app/time-pair'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Banner, BannerAction, BannerActions, BannerTitle } from '@/components/ui/banner'
import { Button } from '@/components/ui/button'
import { apiRequest } from '@/lib/api-client'
import { statusKey, statusWord } from '@/lib/lesson-mark-text'
import { formatDay, formatFullDate, formatTime, secondWhen, yearInZone } from '@/lib/schedule-format'
import { cn } from '@/lib/utils'

import type {
	ChatBlock,
	ChatDayLesson,
	ChatExcerptBlock,
	ChatLessonsBlock,
	ChatPaysSoonBlock,
	ChatReadFailedBlock,
	ChatRecordsRefreshResponse,
	ChatSuggestionsBlock,
} from '@dv-lab/contracts'
import { lessonsPhrase, zonedInstant } from '@dv-lab/core'

import { DueList } from '../../_components/due-list'
import { MoreRow, ROW_LIMIT } from '../../_components/today-lessons'
import { StudentFacts } from './student-facts'

const STUDENTS_HREF = '/students'
const SCHEDULE_HREF = '/schedule'
const CALENDAR_STALE = 'The calendar view is not current.'
const EXCERPT_SOURCES = { section: 'From profile', note: 'From notes', comment: 'From lesson comments' } as const

export type RecordBlock = Extract<
	ChatBlock,
	{ type: 'facts' | 'lessons' | 'pays_soon' | 'excerpt' | 'suggestions' | 'read_failed' }
>

export function isRecordBlock(block: ChatBlock): block is RecordBlock {
	return (
		block.type === 'facts' ||
		block.type === 'lessons' ||
		block.type === 'pays_soon' ||
		block.type === 'excerpt' ||
		block.type === 'suggestions' ||
		block.type === 'read_failed'
	)
}

function dayTitle(date: string, zone: string): string {
	return formatFullDate(zonedInstant(date, '12:00', zone), zone, Number(date.slice(0, 4)))
}

function LessonLine({
	lesson,
	asOf,
	zone,
	secondZone,
}: {
	lesson: ChatDayLesson
	asOf: Date
	zone: string
	secondZone: string | null
}) {
	const start = new Date(lesson.startsAt)
	const key = statusKey(lesson, asOf)
	const muted = key === 'done' || key === 'no_show' || key === 'cancelled' || key === 'moved'
	return (
		<li
			data-slot="chat-lesson-row"
			data-student-id={lesson.studentId}
			data-status={key}
			className={cn(
				'relative flex h-10 items-center gap-3 rounded-lg px-3 tabular-nums hover:bg-hover',
				muted && 'text-muted-foreground'
			)}
		>
			<TimePair
				className="min-w-0 overflow-hidden whitespace-nowrap sm:min-w-22 sm:shrink-0"
				main={formatTime(start, zone)}
				second={secondWhen(start, zone, secondZone)}
			/>
			<Link
				href={`${STUDENTS_HREF}/${lesson.studentId}`}
				className={cn(
					'min-w-0 flex-1 truncate rounded-sm text-body outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:ring-2 focus-visible:after:ring-focus-ring',
					key === 'cancelled' && 'line-through'
				)}
			>
				{lesson.studentName}
			</Link>
			{key === 'planned' ? null : (
				<span className="shrink-0 text-caption font-normal text-muted-foreground">
					{statusWord(lesson, asOf, zone)}
				</span>
			)}
		</li>
	)
}

function Lessons({ block }: { block: ChatLessonsBlock }) {
	const zone = block.defaultTimeZone
	const [secondZone] = useSecondZone(zone)
	const asOf = new Date(block.asOf)
	const fresh = block.calendarRead.state === 'fresh'
	const word = block.day === 'today' ? 'today' : 'tomorrow'
	return (
		<Panel title={`Lessons ${word}`} description={dayTitle(block.date, zone)}>
			{block.lessons.length === 0 ? (
				fresh ? (
					<EmptyState
						icon={CalendarDays}
						title={`No lessons ${word}`}
						action={
							<Button variant="secondary" size="compact" nativeButton={false} render={<Link href={SCHEDULE_HREF} />}>
								Open schedule
							</Button>
						}
					/>
				) : (
					<p role="status" className="px-4 pb-3 text-body text-muted-foreground">
						{CALENDAR_STALE}
					</p>
				)
			) : (
				<>
					<ul data-slot="chat-lessons" className="flex flex-col px-1 pb-2 text-body">
						{block.lessons.slice(0, ROW_LIMIT).map((lesson) => (
							<LessonLine
								key={`${lesson.key}:${lesson.outcome}`}
								lesson={lesson}
								asOf={asOf}
								zone={zone}
								secondZone={secondZone}
							/>
						))}
						{block.lessons.length > ROW_LIMIT ? (
							<MoreRow count={block.lessons.length - ROW_LIMIT} href={SCHEDULE_HREF} />
						) : null}
					</ul>
					{fresh ? null : (
						<p role="status" className="px-4 pb-3 text-caption text-muted-foreground">
							{CALENDAR_STALE}
						</p>
					)}
				</>
			)}
		</Panel>
	)
}

function PaysSoon({ block }: { block: ChatPaysSoonBlock }) {
	const threshold = lessonsPhrase(block.paysSoonLessons, 1)
	return (
		<Panel title="Pays soon" description={`${threshold} or fewer left, or owing`}>
			{block.students.length === 0 ? (
				<EmptyState
					icon={Users}
					title="Nobody needs to pay soon"
					description={`Students appear here when they have ${threshold} left or fewer, or owe lessons.`}
				/>
			) : (
				<DueList students={block.students} threshold={block.paysSoonLessons} moreHref={STUDENTS_HREF} />
			)}
		</Panel>
	)
}

function Excerpt({ block }: { block: ChatExcerptBlock }) {
	const at = new Date(block.createdAt)
	const date = formatDay(at, block.timeZone, yearInZone(new Date(), block.timeZone))
	return (
		<figure data-slot="chat-excerpt" data-source={block.source} className="m-0 flex flex-col gap-1.5">
			<blockquote className="m-0 border-l-2 border-border pl-3">
				<MarkdownView body={block.body} />
			</blockquote>
			<figcaption className="text-caption text-muted-foreground">
				{EXCERPT_SOURCES[block.source]} · {date} · stored text
			</figcaption>
		</figure>
	)
}

function Suggestions({ block, onUse }: { block: ChatSuggestionsBlock; onUse: (text: string) => void }) {
	return (
		<Panel>
			<div data-slot="chat-suggestions" className="flex flex-col gap-2 px-4 py-3">
				<p className="text-caption text-muted-foreground">Suggestions</p>
				<ul className="flex flex-col items-start gap-2">
					{block.lines.map((line) => (
						<li key={line} className="max-w-full">
							<Button
								variant="secondary"
								size="compact"
								className="h-auto min-h-7 max-w-full justify-start py-1 text-left whitespace-normal"
								onClick={() => onUse(line)}
							>
								{line}
							</Button>
						</li>
					))}
				</ul>
				<p className="text-caption text-muted-foreground">Not saved to the student&apos;s notes.</p>
			</div>
		</Panel>
	)
}

function ReadFailed({ block, onUse }: { block: ChatReadFailedBlock; onUse: (text: string) => void }) {
	const [refreshing, setRefreshing] = useState(false)
	const [fresh, setFresh] = useState<ChatRecordsRefreshResponse['block'] | null>(null)
	async function refresh() {
		setRefreshing(true)
		try {
			const result = await apiRequest<ChatRecordsRefreshResponse>('POST', '/chat/records/refresh', { key: block.key })
			if (result.ok) setFresh(result.data.block)
		} finally {
			setRefreshing(false)
		}
	}
	if (fresh !== null) return <RecordBlockView block={fresh} onUse={onUse} />
	return (
		<Banner status="error" role="alert" aria-busy={refreshing} data-reply-state="read-failed">
			<BannerTitle>Could not read the student&apos;s records.</BannerTitle>
			<BannerActions>
				<BannerAction disabled={refreshing} onClick={() => void refresh()}>
					{refreshing ? 'Refreshing…' : 'Refresh records'}
				</BannerAction>
			</BannerActions>
		</Banner>
	)
}

export function RecordBlockView({ block, onUse }: { block: RecordBlock; onUse: (text: string) => void }) {
	if (block.type === 'facts') return <StudentFacts facts={block.facts} />
	if (block.type === 'lessons') return <Lessons block={block} />
	if (block.type === 'pays_soon') return <PaysSoon block={block} />
	if (block.type === 'excerpt') return <Excerpt block={block} />
	if (block.type === 'suggestions') return <Suggestions block={block} onUse={onUse} />
	return <ReadFailed block={block} onUse={onUse} />
}
