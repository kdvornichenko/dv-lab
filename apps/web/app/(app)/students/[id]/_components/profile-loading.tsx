'use client'

import { MoreHorizontal, Pencil } from 'lucide-react'

import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { Stat } from '@/components/app/stat'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonAvatar, SkeletonLine } from '@/components/ui/skeleton'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'

import { HeldDates } from './held-dates'

function ignore() {}

function DetailRowLoading({ label, width }: { label: string; width: string }) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<dt className="text-caption text-muted-foreground">{label}</dt>
			<dd>
				<SkeletonLine className={width} />
			</dd>
		</div>
	)
}

function FactLoading({ label }: { label: string }) {
	return (
		<Stat
			size="title"
			label={label}
			value={<SkeletonLine box="h-6" className="h-4 w-14" />}
			hint={<SkeletonLine box="h-(--lh-caption)" className="h-2.5 w-24" />}
			className="px-4 py-3"
		/>
	)
}

function RecentLoading() {
	return (
		<ul className="flex flex-col gap-3 px-4 pb-4" aria-hidden>
			{[0, 1, 2].map((index) => (
				<li key={index} className="flex items-start gap-3">
					<Skeleton className="mt-0.5 size-4 shrink-0 rounded-md" />
					<div className="flex min-w-0 flex-1 flex-col gap-2">
						<Skeleton className="h-2.5 w-32" />
						<Skeleton className="h-3 w-full" />
					</div>
				</li>
			))}
		</ul>
	)
}

function VocabularyLoading() {
	return (
		<div className="flex flex-col gap-3 px-4 pb-4" aria-hidden>
			<Skeleton className="h-2.5 w-36" />
			<div className="flex flex-wrap gap-2">
				{[16, 20, 14, 24, 18, 20].map((width, index) => (
					<Skeleton key={index} className="h-7 rounded-md" style={{ width: `${width * 4}px` }} />
				))}
			</div>
		</div>
	)
}

export function OverviewLeftLoading({ studentName, mainTimeZone }: { studentName: string; mainTimeZone: string }) {
	return (
		<>
			<div className="grid gap-3 sm:grid-cols-3">
				<FactLoading label="Lessons left" />
				<FactLoading label="Next lesson" />
				<FactLoading label="Last payment" />
			</div>
			<HeldDates
				form="short"
				loading
				studentName={studentName}
				dates={[]}
				minutes={0}
				period={{ from: '1970-01-01', to: '1970-01-01' }}
				sincePayment
				lastPaidOn={null}
				beforePayment={[]}
				coverage="complete"
				mainTimeZone={mainTimeZone}
			/>
			<Panel
				id="student-recent"
				title="Recent notes and comments"
				action={
					<Button variant="secondary" size="compact" disabled>
						All notes
					</Button>
				}
			>
				<RecentLoading />
			</Panel>
			<Panel
				id="student-vocabulary"
				title="Vocabulary"
				action={
					<Button variant="secondary" size="compact" disabled>
						All words
					</Button>
				}
			>
				<VocabularyLoading />
			</Panel>
		</>
	)
}

function OverviewLoading() {
	return (
		<div className="flex min-w-0 flex-col gap-4">
			<Panel
				id="student-details"
				title="Details"
				action={
					<Button variant="secondary" size="compact" leadingIcon={Pencil} disabled>
						Edit details
					</Button>
				}
			>
				<dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 pt-1 pb-4 sm:grid-cols-4">
					<DetailRowLoading label="Rate" width="w-28" />
					<DetailRowLoading label="Lesson length" width="w-14" />
					<DetailRowLoading label="No-show" width="w-28" />
					<DetailRowLoading label="Gender" width="w-14" />
					<DetailRowLoading label="Parent" width="w-24" />
					<DetailRowLoading label="Level" width="w-16" />
					<DetailRowLoading label="Goals" width="w-40" />
					<DetailRowLoading label="Time zone" width="w-32" />
				</dl>
			</Panel>
			<OverviewLeftLoading studentName="" mainTimeZone="UTC" />
		</div>
	)
}

export function ProfileLoading() {
	return (
		<PageScroll>
			<PageHeader
				title={
					<span className="flex h-(--lh-display) items-center gap-2">
						<SkeletonAvatar />
						<Skeleton className="h-6 w-40" />
					</span>
				}
				description={
					<div className="flex h-5 items-center gap-4">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-3 w-22" />
						<Skeleton className="h-3 w-26" />
					</div>
				}
				aside={
					<Button variant="tertiary" size="icon" aria-label="Student actions" disabled>
						<MoreHorizontal />
					</Button>
				}
			/>
			<Tabs value="overview" onValueChange={ignore}>
				<div className="flex w-fit max-w-full min-w-0 rounded-xl bg-muted">
					<TabsList
						aria-label="Student sections"
						className="scroll-fade-x no-scrollbar bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto"
					>
						<TabItem value="overview" label="Overview" disabled />
						<TabItem value="lessons" label="Lessons" disabled />
						<TabItem value="payments" label="Payments" disabled />
						<TabItem value="notes" label="Notes" disabled />
						<TabItem value="vocabulary" label="Vocabulary" disabled />
					</TabsList>
				</div>
				<TabPanel value="overview" className="mt-4">
					<OverviewLoading />
				</TabPanel>
			</Tabs>
		</PageScroll>
	)
}
