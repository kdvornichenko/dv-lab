import { CalendarClock, Link2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { selectCalendarStatus } from '@/lib/crm/model'

import type { CalendarConnection, CalendarListEntry, CalendarSyncRecord } from '@teacher-crm/api-types'

type CalendarPanelProps = {
	connection: CalendarConnection
	calendarOptions?: CalendarListEntry[]
	syncRecords: CalendarSyncRecord[]
	onConnect: () => void
	onSelectCalendar?: (calendarId: string, calendarName: string) => void
	previewMode?: boolean
}

export function CalendarPanel({
	connection,
	calendarOptions = [],
	syncRecords,
	onConnect,
	onSelectCalendar,
	previewMode = false,
}: CalendarPanelProps) {
	const calendarStatus = selectCalendarStatus(connection, syncRecords)
	const selectedPlaceholderValue = 'calendar-not-selected'
	const selectedCalendarId = connection.selectedCalendarId ?? selectedPlaceholderValue
	const selectedCalendarMissing =
		Boolean(connection.selectedCalendarId) &&
		!calendarOptions.some((calendar) => calendar.id === connection.selectedCalendarId)

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
							<p className="font-heading text-ink truncate text-sm font-semibold">
								{connection.email ?? 'No account connected'}
							</p>
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
				<div className="grid gap-2">
					<p className="text-ink-muted text-xs font-medium">Target calendar</p>
					<Select
						value={selectedCalendarId}
						disabled={previewMode || !calendarStatus.connected || calendarOptions.length === 0}
						onValueChange={(calendarId) => {
							if (calendarId === selectedPlaceholderValue) return
							const calendar = calendarOptions.find((item) => item.id === calendarId)
							onSelectCalendar?.(calendarId, calendar?.name ?? calendarId)
						}}
					>
						<SelectTrigger>
							<SelectValue placeholder={calendarStatus.connected ? 'Choose calendar' : 'Connect Google first'} />
						</SelectTrigger>
						<SelectContent>
							{!connection.selectedCalendarId && (
								<SelectItem value={selectedPlaceholderValue} disabled>
									{calendarStatus.connected ? 'Choose calendar' : 'Connect Google first'}
								</SelectItem>
							)}
							{selectedCalendarMissing && connection.selectedCalendarId && (
								<SelectItem value={connection.selectedCalendarId}>
									{connection.selectedCalendarName ?? connection.selectedCalendarId}
								</SelectItem>
							)}
							{calendarOptions.map((calendar) => (
								<SelectItem key={calendar.id} value={calendar.id}>
									{calendar.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					{calendarStatus.connected && calendarOptions.length === 0 && (
						<p className="text-warning text-xs">Writable calendars are not loaded yet.</p>
					)}
				</div>
				<Button
					className="w-full"
					variant={calendarStatus.connected ? 'secondary' : 'primary'}
					onClick={onConnect}
					disabled={previewMode}
				>
					<Link2 className="h-4 w-4" />
					{calendarStatus.connected ? 'Reconnect calendar' : 'Authorize Google Calendar'}
				</Button>
			</CardContent>
		</Card>
	)
}
