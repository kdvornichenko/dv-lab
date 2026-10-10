'use client'

import { useRouter } from 'next/navigation'

import { PageHeader, PageScroll, Panel } from '@/components/app/layout-parts'
import { TimeZonePicker, useSecondZone } from '@/components/app/time-zone-picker'
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs'
import { zoneLabel } from '@/lib/time-zones'

import { SCHEDULE_TIME_ZONE } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'

const SETTINGS_TABS = ['general'] as const

type SettingsTab = (typeof SETTINGS_TABS)[number]

function resolveTab(tab: string | undefined): SettingsTab {
	return SETTINGS_TABS.find((item) => item === tab) ?? 'general'
}

function TimeZonesCard() {
	const [zone, setZone] = useSecondZone()
	const toast = useToast()
	const now = new Date()
	const lead = 'Lesson times are shown in Vietnam time (VN)'
	const description = zone ? `${lead}, with a second zone (${zoneLabel(zone, now)}) beside it.` : `${lead}.`

	function change(next: string | null) {
		if (next === zone) return
		setZone(next)
		toast.show({ title: 'Saved', description: `Second zone: ${next ?? 'None'}.` })
	}

	return (
		<Panel id="settings-time-zones" title="Time zones" description={description}>
			<div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:justify-between md:gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<label htmlFor="settings-second-zone" className="text-body text-foreground">
						Second zone
					</label>
					<p id="settings-second-zone-hint" className="text-caption text-muted-foreground">
						Shown next to the main zone
					</p>
				</div>
				<div className="w-full md:w-75 md:shrink-0">
					<TimeZonePicker
						trigger="field"
						id="settings-second-zone"
						aria-describedby="settings-second-zone-hint"
						value={zone}
						onChange={change}
						allowNone
						excludeMain
					/>
				</div>
			</div>
			<p className="px-4 pt-1 pb-4 text-caption text-muted-foreground">Saved in this browser.</p>
		</Panel>
	)
}

export function SettingsScreen({ tab }: { tab: string | undefined }) {
	const router = useRouter()
	return (
		<PageScroll>
			<PageHeader title="Settings" />
			<Tabs value={resolveTab(tab)} onValueChange={(next) => router.replace(`/settings?tab=${resolveTab(next)}`)}>
				<TabsList aria-label="Settings sections" className="max-sm:w-0 max-sm:min-w-full max-sm:overflow-x-auto">
					<TabItem value="general" label="General" />
				</TabsList>
				<TabPanel value="general" className="mt-4">
					<div className="flex max-w-180 flex-col gap-4">
						<TimeZonesCard />
					</div>
				</TabPanel>
			</Tabs>
		</PageScroll>
	)
}
