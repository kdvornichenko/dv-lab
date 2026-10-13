'use client'

import type { ReactNode } from 'react'

import { Pencil, Wallet } from 'lucide-react'

import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Skeleton, SkeletonAvatar, SkeletonLine } from '@/components/ui/skeleton'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'

import { BackButton } from './back-button'

function ignore() {}

function DetailRowLoading({ label, width }: { label: string; width: string }) {
	return (
		<div className="flex items-center justify-between gap-4 px-4 pb-2">
			<dt className="w-32 shrink-0 text-body text-muted-foreground">{label}</dt>
			<dd>
				<SkeletonLine className={width} />
			</dd>
		</div>
	)
}

function FieldLoading({ label, helper }: { label: string; helper: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-2">
			<span className="text-body text-muted-foreground">{label}</span>
			<Skeleton className="h-9 w-full rounded-md" />
			<p className="text-caption text-muted-foreground">{helper}</p>
		</div>
	)
}

function OverviewLoading() {
	return (
		<div className="grid gap-4 md:gap-6 lg:grid-cols-2">
			<Panel
				id="student-details"
				title="Details"
				action={
					<Button variant="ghost" size="compact" leadingIcon={Pencil} disabled>
						Edit details
					</Button>
				}
			>
				<dl className="flex flex-col pt-2">
					<DetailRowLoading label="Rate" width="w-28" />
					<DetailRowLoading label="Lesson length" width="w-14" />
					<DetailRowLoading label="No-show" width="w-28" />
					<DetailRowLoading label="Parent" width="w-24" />
					<DetailRowLoading label="Level" width="w-16" />
					<DetailRowLoading label="Goals" width="w-40" />
					<DetailRowLoading label="Time zone" width="w-32" />
				</dl>
			</Panel>
			<div className="flex min-w-0 flex-col gap-4 md:gap-6">
				<Panel
					id="student-opening-balance"
					title="Opening balance"
					description="Lessons left on the day you start counting here."
				>
					<div className="flex flex-col gap-4 px-4 pt-2 pb-4">
						<div className="flex items-center justify-between gap-4 text-body">
							<span className="text-muted-foreground">Balance now</span>
							<SkeletonLine className="w-28" />
						</div>
						<FieldLoading label="Lessons left" helper="Up to two decimals, for example 1.5." />
						<FieldLoading
							label="As of"
							helper="Payments dated on or before this date are already counted in the number."
						/>
						<div>
							<Skeleton className="h-9 w-37 rounded-md" />
						</div>
					</div>
				</Panel>
				<Panel id="student-account" title="Account" description="Sign-in for this student.">
					<div className="flex flex-col gap-4 px-4 pb-4">
						<div className="flex flex-col gap-2">
							<Skeleton className="h-9 w-full rounded-lg" />
							<Skeleton className="h-9 w-full rounded-lg" />
							<Skeleton className="h-9 w-full rounded-lg" />
						</div>
						<div>
							<Skeleton className="h-9 w-37 rounded-md" />
						</div>
					</div>
				</Panel>
			</div>
		</div>
	)
}

export function ProfileLoading() {
	return (
		<PageScroll>
			<BackButton />
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
				actions={
					<>
						<Skeleton className="h-9 w-24 rounded-md" />
						<Button leadingIcon={Wallet}>Record payment</Button>
					</>
				}
			/>
			<Tabs value="overview" onValueChange={ignore}>
				<div className="flex w-fit max-w-full min-w-0 rounded-xl bg-muted">
					<TabsList
						aria-label="Student sections"
						className="scroll-fade-x bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto"
					>
						<TabItem value="overview" label="Overview" disabled />
						<TabItem value="notes" label="Notes" disabled />
						<TabItem value="vocabulary" label="Vocabulary" disabled />
						<TabItem value="payments" label="Payments" disabled />
					</TabsList>
				</div>
				<TabPanel value="overview" className="mt-4">
					<OverviewLoading />
				</TabPanel>
			</Tabs>
		</PageScroll>
	)
}
