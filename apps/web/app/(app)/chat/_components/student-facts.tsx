'use client'

import type { ReactNode } from 'react'

import { Avatar } from '@/components/app/avatar'
import { Panel } from '@/components/app/layout-parts'
import { DotShape } from '@/components/app/status-dot'
import { StudentBalance, balanceTone } from '@/components/app/student-balance'
import { TimePair } from '@/components/app/time-pair'
import { useSecondZone } from '@/components/app/time-zone-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { formatWhen, secondWhen, yearInZone } from '@/lib/schedule-format'
import { lessonHref, studentHref } from '@/lib/schedule-links'
import { zoneLabel } from '@/lib/time-zones'

import type { ChatStudentFacts } from '@dv-lab/contracts'
import { balanceState } from '@dv-lab/core'

import { TextLink } from './agent-links'

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
				<p className="text-micro text-muted-foreground">No opening balance yet.</p>
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
				<p className="inline-flex items-center gap-1.5 text-micro text-muted-foreground">
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
				<p className="text-micro text-muted-foreground">The calendar view is not current.</p>
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
				second={secondWhen(at, defaultTimeZone, secondZone)}
				mainClassName="text-body font-medium"
			/>
			{nextLesson.status.state === 'fresh' ? null : (
				<p className="text-micro text-muted-foreground">The calendar view is not current.</p>
			)}
		</Fact>
	)
}

export function StudentFacts({ facts }: { facts: ChatStudentFacts }) {
	const { student, defaultTimeZone, asOf } = facts
	const [secondZone] = useSecondZone(defaultTimeZone)
	const checked = new Date(asOf)
	return (
		<Panel>
			<div role="group" aria-label={`Facts: ${student.displayName}`} className="flex flex-col gap-2 px-4 py-3">
				<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
					<span className="flex shrink-0 [&>span]:size-6 [&>span]:text-micro">
						<Avatar name={student.displayName} />
					</span>
					<span className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">
						<TextLink href={studentHref(student.id)}>{student.displayName}</TextLink>
					</span>
					<p className="text-caption text-muted-foreground tabular-nums max-sm:basis-full max-sm:pl-8">
						Checked {formatWhen(checked, defaultTimeZone, yearInZone(checked, defaultTimeZone))}{' '}
						{zoneLabel(defaultTimeZone, checked)}
					</p>
				</div>
				<div className="grid grid-cols-1 gap-3 pt-1 pl-8 tabular-nums sm:grid-cols-2">
					<BalanceFact facts={facts} />
					<NextLessonFact facts={facts} secondZone={secondZone} />
				</div>
			</div>
		</Panel>
	)
}

export function StudentFactsSkeleton() {
	return (
		<Panel>
			<div role="status" aria-label="Loading student records" className="flex flex-col gap-2 px-4 py-3">
				<div className="flex items-center gap-2">
					<Skeleton className="size-6 rounded-full" />
					<Skeleton className="h-5 w-32" />
				</div>
				<div className="grid grid-cols-1 gap-3 pt-1 pl-8 sm:grid-cols-2">
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
