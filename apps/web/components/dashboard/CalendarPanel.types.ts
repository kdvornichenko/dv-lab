import type { CalendarConnection, CalendarListEntry, CalendarSyncRecord } from '@teacher-crm/api-types'

export type CalendarPanelProps = {
	connection: CalendarConnection
	calendarOptions?: CalendarListEntry[]
	syncRecords: CalendarSyncRecord[]
	onConnect: () => void
	onSelectCalendar?: (calendarId: string, calendarName: string) => void
	previewMode?: boolean
}
