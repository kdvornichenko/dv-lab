'use client'

import type { ReactNode } from 'react'

import { useSearchParams } from 'next/navigation'

import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'

import { ConnectionSkeleton } from './calendar-card'
import {
	BudgetLoading,
	ChatModelLoading,
	Hint,
	ModelsLoading,
	NumberShape,
	ROW_CENTER,
	ROW_TOP,
	SelectShape,
} from './settings-loading-parts'
import { activeTabOf } from './settings-tabs'

function ignore() {}

function GeneralLoading() {
	return (
		<div role="status" aria-label="Loading settings" className="flex max-w-180 flex-col gap-4">
			<Panel
				id="settings-default-time-zone"
				title="Default time zone"
				description="The zone your schedule is built in. Lesson times, Today and balances use it."
			>
				<div className={`${ROW_TOP} px-4 py-3`}>
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-body text-foreground">Time zone</span>
						<Hint />
					</div>
					<div className="w-full md:w-65 md:shrink-0">
						<SelectShape />
					</div>
				</div>
				<p className="px-4 pt-1 pb-3 text-caption text-muted-foreground">
					New lessons and series are created in this zone. Lessons and series you already have keep the zone they were
					created in.
				</p>
				<div className="px-4 pb-4">
					<p className="text-caption text-muted-foreground">Saved to your account.</p>
				</div>
			</Panel>
			<Panel
				id="settings-time-zones"
				title="Second time zone"
				description="Shown beside every lesson time, so you can read it in a student's time."
			>
				<div className={`${ROW_TOP} px-4 py-3`}>
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-body text-foreground">Second zone</span>
						<p className="text-caption text-muted-foreground">Shown next to the default zone</p>
					</div>
					<div className="w-full md:w-65 md:shrink-0">
						<SelectShape />
					</div>
				</div>
				<p className="px-4 pt-1 pb-4 text-caption text-muted-foreground">Saved in this browser.</p>
			</Panel>
			<Panel id="settings-payments" title="Payments" description="Decide when a student counts as paying soon.">
				<div className={`${ROW_CENTER} px-4 py-3`}>
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-body text-foreground">Pays soon threshold (lessons)</span>
						<p className="text-caption text-muted-foreground">
							Students with this many lessons left or fewer appear in Pays soon on Today.
						</p>
					</div>
					<NumberShape className="h-9 w-24 shrink-0" />
				</div>
				<p className="px-4 pt-1 pb-4 text-caption text-muted-foreground">Saved to your account.</p>
			</Panel>
		</div>
	)
}

function CalendarLoading() {
	return (
		<div className="flex max-w-180 flex-col gap-4">
			<Panel id="settings-calendar-connection" title="Connection">
				<div className="flex flex-col gap-3 px-4 pt-1 pb-4">
					<ConnectionSkeleton />
				</div>
			</Panel>
			<Panel id="settings-calendar-sync" title="Sync" description="Calendar requests and their confirmation status.">
				<div className="flex flex-col gap-3 px-4 pt-1 pb-4 text-body" role="status">
					<p className="text-muted-foreground">Loading calendar requests…</p>
				</div>
			</Panel>
		</div>
	)
}

function AssistantLoading() {
	return (
		<div className="flex max-w-180 flex-col gap-4">
			<ChatModelLoading />
			<ModelsLoading />
			<BudgetLoading />
		</div>
	)
}

export function SettingsLoading() {
	const tab = activeTabOf(useSearchParams())
	const body: Record<typeof tab, ReactNode> = {
		general: <GeneralLoading />,
		calendar: <CalendarLoading />,
		assistant: <AssistantLoading />,
	}
	return (
		<PageScroll>
			<PageHeader title="Settings" />
			<Tabs value={tab} onValueChange={ignore}>
				<div className="flex w-fit max-w-full min-w-0 rounded-xl bg-muted">
					<TabsList
						aria-label="Settings sections"
						className="scroll-fade-x no-scrollbar bg-transparent [--scroll-fade-size:var(--scroll-fade-size-compact)] max-sm:min-w-0 max-sm:flex-1 max-sm:overflow-x-auto"
					>
						<TabItem value="general" label="General" />
						<TabItem value="calendar" label="Google Calendar" />
						<TabItem value="assistant" label="Assistant" />
					</TabsList>
				</div>
				<TabPanel value={tab} className="mt-4">
					{body[tab]}
				</TabPanel>
			</Tabs>
		</PageScroll>
	)
}
