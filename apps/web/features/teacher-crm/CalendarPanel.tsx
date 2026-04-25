import { CalendarClock, Link2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import type { TeacherCrmState } from './types'

export function CalendarPanel({ state, onConnect }: { state: TeacherCrmState; onConnect: () => void }) {
	const connection = state.calendarConnection
	const failedSyncs = state.calendarSyncRecords.filter((record) => record.status === 'failed').length
	const hasCalendarGrant =
		connection.tokenAvailable && connection.requiredScopes.every((scope) => connection.grantedScopes.includes(scope))

	return (
		<Card id="calendar">
			<CardHeader className="flex flex-row items-center justify-between gap-3">
				<CardTitle>Google Calendar</CardTitle>
				<CalendarClock className="h-5 w-5 text-sky-700" />
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="text-sm font-medium text-zinc-950">{connection.email ?? 'No account connected'}</p>
						<p className="text-xs text-zinc-500">{connection.selectedCalendarName ?? 'Calendar is not selected'}</p>
					</div>
					<Badge tone={connection.status === 'connected' && hasCalendarGrant ? 'green' : 'amber'}>
						{connection.status}
					</Badge>
				</div>
				<div className="grid grid-cols-2 gap-3 text-sm">
					<div className="rounded-md border border-zinc-200 p-3">
						<p className="text-xs text-zinc-500">Synced events</p>
						<p className="mt-1 text-lg font-semibold">
							{state.calendarSyncRecords.filter((record) => record.status === 'synced').length}
						</p>
					</div>
					<div className="rounded-md border border-zinc-200 p-3">
						<p className="text-xs text-zinc-500">Failed syncs</p>
						<p className="mt-1 text-lg font-semibold">{failedSyncs}</p>
					</div>
				</div>
				<Button
					className="w-full"
					variant={connection.status === 'connected' ? 'secondary' : 'primary'}
					onClick={onConnect}
				>
					<Link2 className="h-4 w-4" />
					{connection.status === 'connected' ? 'Reconnect calendar' : 'Verify calendar access'}
				</Button>
			</CardContent>
		</Card>
	)
}
