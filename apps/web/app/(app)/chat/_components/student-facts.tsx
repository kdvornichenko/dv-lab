'use client'

import type { ComponentProps, ReactNode } from 'react'

import { ArrowUp } from 'lucide-react'

import { Avatar } from '@/components/app/avatar'
import { Panel } from '@/components/app/layout-parts'
import { DotShape } from '@/components/app/status-dot'
import { StudentBalance, balanceTone } from '@/components/app/student-balance'
import { TimePair } from '@/components/app/time-pair'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatWhen, secondWhen, yearInZone } from '@/lib/schedule-format'
import { lessonHref, studentHref } from '@/lib/schedule-links'
import { zoneLabel } from '@/lib/time-zones'

import { CHAT_FOLLOW_UP_TEXT, type ChatStudentFacts } from '@dv-lab/contracts'
import { balanceState } from '@dv-lab/core'

import { TextLink } from './agent-links'

export type FactsFollowUp = {
	busy: boolean
	onSend: (student: { id: string; displayName: string }) => void
}

function SendArrow(props: ComponentProps<typeof ArrowUp>) {
	return <ArrowUp {...props} size={14} />
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<p className="text-caption text-muted-foreground">{label}</p>
			{children}
		</div>
	)
}

export function BalanceFact({ facts }: { facts: ChatStudentFacts }) {
	const { balanceMinutes, paysSoon, paysSoonLessons, student } = facts
	if (balanceMinutes === null) {
		return (
			<Fact label="Balance">
				<TextLink href={studentHref(student.id, { tab: 'payments' })} className="self-start">
					<StudentBalance
						minutes={null}
						lessonMinutes={student.defaultLessonMinutes}
						className="text-body font-medium"
					/>
				</TextLink>
				<p className="min-h-4 text-micro text-muted-foreground">No opening balance yet.</p>
			</Fact>
		)
	}
	const tone = paysSoon
		? balanceTone(balanceState(balanceMinutes, student.defaultLessonMinutes, paysSoonLessons))
		: null
	return (
		<Fact label="Balance">
			<TextLink href={studentHref(student.id, { tab: 'payments' })} className="self-start">
				<StudentBalance
					minutes={balanceMinutes}
					lessonMinutes={student.defaultLessonMinutes}
					className="text-body font-medium"
				/>
			</TextLink>
			{tone === null ? null : (
				<p className="inline-flex min-h-4 items-center gap-1.5 text-micro text-muted-foreground">
					<DotShape tone={tone.tone} />
					<TextLink href={studentHref(student.id)}>{tone.label}</TextLink>
				</p>
			)}
		</Fact>
	)
}

export function NextLessonFact({ facts, secondZone }: { facts: ChatStudentFacts; secondZone: string | null }) {
	const { nextLesson, defaultTimeZone, asOf } = facts
	const unavailable =
		nextLesson.result === 'unknown' ||
		nextLesson.status.state === 'unavailable' ||
		(nextLesson.result === 'none' && nextLesson.status.state !== 'fresh')
	if (unavailable) {
		return (
			<Fact label="Next lesson">
				<p className="text-body font-medium text-muted-foreground">Unavailable</p>
				<p className="min-h-4 text-micro text-muted-foreground">The calendar view is not current.</p>
			</Fact>
		)
	}
	if (nextLesson.result === 'none') {
		return (
			<Fact label="Next lesson">
				<p className="text-body font-medium text-muted-foreground">No lesson ahead</p>
			</Fact>
		)
	}
	const at = new Date(nextLesson.startsAt)
	const year = yearInZone(new Date(asOf), defaultTimeZone)
	const when = `${formatWhen(at, defaultTimeZone, year)} ${zoneLabel(defaultTimeZone, at)}`
	const second = secondWhen(at, defaultTimeZone, secondZone)
	return (
		<Fact label="Next lesson">
			<TimePair
				main={
					nextLesson.ref !== undefined && nextLesson.date !== undefined ? (
						<TextLink href={lessonHref(nextLesson.date, nextLesson.ref)}>{when}</TextLink>
					) : (
						when
					)
				}
				second={second}
				mainClassName="text-body font-medium"
			/>
			{nextLesson.status.state === 'fresh' ? null : (
				<p className="min-h-4 text-micro text-muted-foreground">The calendar view is not current.</p>
			)}
		</Fact>
	)
}

export function BalanceEndsFact({ facts, secondZone }: { facts: ChatStudentFacts; secondZone: string | null }) {
	const { balanceEnds, defaultTimeZone, asOf, nextLesson } = facts
	if (balanceEnds === undefined) return null
	if (balanceEnds.state === 'now') {
		return (
			<Fact label="Balance ends">
				<p className="text-body font-medium text-muted-foreground">Due now</p>
				<p className="min-h-4 text-micro text-muted-foreground">No lessons left to cover.</p>
			</Fact>
		)
	}
	if (balanceEnds.state === 'beyond') {
		return (
			<Fact label="Balance ends">
				<p className="text-body font-medium text-muted-foreground">Not scheduled yet</p>
				<p className="min-h-4 text-micro text-muted-foreground">The schedule ahead is shorter than the balance.</p>
			</Fact>
		)
	}
	const at = new Date(balanceEnds.startsAt)
	const year = yearInZone(new Date(asOf), defaultTimeZone)
	const when = `${formatWhen(at, defaultTimeZone, year)} ${zoneLabel(defaultTimeZone, at)}`
	const current = nextLesson.status.state === 'fresh'
	return (
		<Fact label="Balance ends">
			<TimePair
				main={when}
				second={secondWhen(at, defaultTimeZone, secondZone)}
				mainClassName="text-body font-medium"
			/>
			<p className="min-h-4 text-micro text-muted-foreground">
				{current ? 'After this lesson.' : 'After this lesson. The calendar view is not current.'}
			</p>
		</Fact>
	)
}

export function StudentFacts({ facts, followUp }: { facts: ChatStudentFacts; followUp?: FactsFollowUp }) {
	const { student, defaultTimeZone, asOf } = facts
	const [secondZone] = useSecondZone(defaultTimeZone)
	const checked = new Date(asOf)
	return (
		<div className="flex min-w-0 flex-col gap-3">
			<Panel>
				<div
					role="group"
					aria-label={`Facts: ${student.displayName}`}
					data-slot="chat-facts"
					className="@container flex flex-col gap-3 p-4"
				>
					<div className="flex min-w-0 items-center gap-2">
						<span className="flex shrink-0 [&>span]:size-6 [&>span]:text-micro">
							<Avatar name={student.displayName} />
						</span>
						<span
							title={student.displayName}
							className="min-w-0 flex-1 truncate text-body font-semibold text-foreground"
						>
							<TextLink href={studentHref(student.id)}>{student.displayName}</TextLink>
						</span>
					</div>
					<div
						data-slot="chat-facts-grid"
						className="grid grid-cols-2 gap-x-6 gap-y-3 tabular-nums @max-[22.5rem]:grid-cols-1"
					>
						<BalanceFact facts={facts} />
						<NextLessonFact facts={facts} secondZone={secondZone} />
						<BalanceEndsFact facts={facts} secondZone={secondZone} />
					</div>
					<p
						data-slot="chat-facts-checked"
						className="border-t border-border pt-2 text-caption text-muted-foreground tabular-nums"
					>
						Checked {formatWhen(checked, defaultTimeZone, yearInZone(checked, defaultTimeZone))}{' '}
						{zoneLabel(defaultTimeZone, checked)}
					</p>
				</div>
			</Panel>
			{followUp !== undefined && facts.followUp === 'since_payment' ? (
				<Button
					variant="secondary"
					size="compact"
					data-slot="chat-follow-up"
					disabled={followUp.busy}
					className="self-start"
					leadingIcon={SendArrow}
					onClick={() => followUp.onSend({ id: student.id, displayName: student.displayName })}
				>
					{CHAT_FOLLOW_UP_TEXT}
				</Button>
			) : null}
		</div>
	)
}

export function StudentFactsSkeleton() {
	return (
		<Panel>
			<div role="status" aria-label="Loading student records" className="flex flex-col gap-3 p-4">
				<div className="flex items-center gap-2">
					<Skeleton className="size-6 rounded-full" />
					<Skeleton className="h-5 w-32" />
				</div>
				<div className="grid grid-cols-2 gap-x-6 gap-y-3">
					<div className="flex flex-col gap-1">
						<Skeleton className="h-4 w-12" />
						<Skeleton className="h-5 w-28" />
					</div>
					<div className="flex flex-col gap-1">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-5 w-36" />
					</div>
				</div>
			</div>
		</Panel>
	)
}
