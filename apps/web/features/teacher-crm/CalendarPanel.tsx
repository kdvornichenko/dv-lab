import { CalendarClock, Link2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { CalendarConnection, CalendarSyncRecord } from '@teacher-crm/api-types'

import { selectCalendarStatus } from './model'

type CalendarPanelProps = {
	connection: CalendarConnection
	syncRecords: CalendarSyncRecord[]
	onConnect: () => void
}

export function CalendarPanel({ connection, syncRecords, onConnect }: CalendarPanelProps) {
	const calendarStatus = selectCalendarStatus(connection, syncRecords)

	return (
		<Card id="calendar" className="rounded-lg border-[#E6E0D4] bg-white shadow-none">
			<CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[#EFE8DC]">
				<div>
					<CardTitle className="text-base text-[#181713]">Google Calendar</CardTitle>
					<p className="mt-1 text-sm text-[#6F6B63]">Same Google account as login.</p>
				</div>
				<CalendarClock className="h-5 w-5 text-[#2F6F5E]" />
			</CardHeader>
			<CardContent className="space-y-4 pt-4">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<p className="truncate text-sm font-medium text-[#181713]">{connection.email ?? 'No account connected'}</p>
						<p className="truncate text-xs text-[#6F6B63]">
							{connection.selectedCalendarName ?? 'Calendar is not selected'}
						</p>
					</div>
					<Badge tone={calendarStatus.connected ? 'green' : 'amber'}>{connection.status}</Badge>
				</div>
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div className="rounded-md border border-[#E6E0D4] bg-[#FBFAF6] p-3">
						<p className="text-xs text-[#6F6B63]">Synced events</p>
						<p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#181713]">
							{calendarStatus.syncedEvents}
						</p>
					</div>
					<div className="rounded-md border border-[#E6E0D4] bg-[#FBFAF6] p-3">
						<p className="text-xs text-[#6F6B63]">Failed syncs</p>
						<p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#181713]">
							{calendarStatus.failedSyncs}
						</p>
					</div>
				</div>
				<Button className="w-full" variant={calendarStatus.connected ? 'secondary' : 'primary'} onClick={onConnect}>
					<Link2 className="h-4 w-4" />
					{calendarStatus.connected ? 'Reconnect calendar' : 'Verify calendar access'}
				</Button>
			</CardContent>
		</Card>
	)
}
