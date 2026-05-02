export type CalendarSyncRecordView = {
	id: string
	lessonId: string
	status: string
	updatedAt: string
	lastError: string | null
}

export type CalendarSyncPanelProps = {
	syncRecords: CalendarSyncRecordView[]
	lessonTitles: Map<string, string>
}
