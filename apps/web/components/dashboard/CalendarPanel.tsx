import { CalendarClock, Link2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { selectCalendarStatus } from '@/lib/crm/model'

import type { CalendarConnection, CalendarSyncRecord } from '@teacher-crm/api-types'

type CalendarPanelProps = {
	connection: CalendarConnection
	syncRecords: CalendarSyncRecord[]
	onConnect: () => void
}

export function CalendarPanel({ connection, syncRecords, onConnect }: CalendarPanelProps) {
	const calendarStatus = selectCalendarStatus(connection, syncRecords)

	return (
		<Card id="calendar" className="border-line bg-surface rounded-lg shadow-none">
			<CardHeader className="border-line-soft flex flex-row items-center justify-between gap-3 border-b">
				<div>
					<CardTitle className="text-ink text-base">Google Calendar</CardTitle>
					<p className="text-ink-muted mt-1 text-sm">Same Google account as login.</p>
				</div>
				<CalendarClock className="text-sage h-5 w-5" />
			</CardHeader>
			<CardContent className="space-y-4 pt-4">
				<div className="flex items-center justify-between gap-3">
					<div className="min-w-0">
						<p className="text-ink truncate text-sm font-medium">{connection.email ?? 'No account connected'}</p>
						<p className="text-ink-muted truncate text-xs">
							{connection.selectedCalendarName ?? 'Calendar is not selected'}
						</p>
					</div>
					<Badge tone={calendarStatus.connected ? 'green' : 'amber'}>{connection.status}</Badge>
				</div>
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div className="border-line bg-surface-muted rounded-md border p-3">
						<p className="text-ink-muted text-xs">Synced events</p>
						<p className="text-ink mt-1 font-mono text-lg font-semibold tabular-nums">{calendarStatus.syncedEvents}</p>
					</div>
					<div className="border-line bg-surface-muted rounded-md border p-3">
						<p className="text-ink-muted text-xs">Failed syncs</p>
						<p className="text-ink mt-1 font-mono text-lg font-semibold tabular-nums">{calendarStatus.failedSyncs}</p>
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
