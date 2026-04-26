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
		<Card id="calendar" className="overflow-hidden shadow-[0_18px_55px_-44px_var(--shadow-sage)]">
			<CardHeader className="border-line-soft bg-surface-muted flex flex-row items-center justify-between gap-3 border-b">
				<div>
					<p className="text-sage font-mono text-xs font-semibold uppercase">Sync</p>
					<CardTitle className="mt-1 text-lg">Google Calendar</CardTitle>
					<p className="text-ink-muted mt-1 text-sm">Same Google account as login.</p>
				</div>
				<span className="border-sage-line bg-sage-soft text-sage flex size-9 items-center justify-center rounded-lg border">
					<CalendarClock className="h-4 w-4" />
				</span>
			</CardHeader>
			<CardContent className="space-y-4 pt-5">
				<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
					<div className="flex items-center justify-between gap-3">
						<div className="min-w-0">
							<p className="text-ink truncate text-sm font-semibold">{connection.email ?? 'No account connected'}</p>
							<p className="text-ink-muted mt-1 truncate text-xs">
								{connection.selectedCalendarName ?? 'Calendar is not selected'}
							</p>
						</div>
						<Badge tone={calendarStatus.connected ? 'green' : 'amber'}>{connection.status}</Badge>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
						<p className="text-ink-muted text-xs font-medium">Synced events</p>
						<p className="text-ink mt-1 font-mono text-lg font-semibold tabular-nums">{calendarStatus.syncedEvents}</p>
					</div>
					<div className="border-line-soft bg-surface-muted rounded-lg border p-3">
						<p className="text-ink-muted text-xs font-medium">Failed syncs</p>
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
