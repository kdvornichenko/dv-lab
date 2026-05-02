import type { ReactNode } from 'react'

import type { LucideIcon } from 'lucide-react'

import type { CrmErrorLogEntry } from '@/lib/crm/error-log'

export type LogType = 'all' | 'calendar' | 'students' | 'lessons' | 'payments' | 'settings' | 'system'

export type LogEntryType = Exclude<LogType, 'all'>

export type LogEntryView = CrmErrorLogEntry & {
	endpoint: string | null
	eventId: string
	type: LogEntryType
	typeLabel: string
	createdDate: Date
	timeLabel: string
	dateLabel: string
	traceId: string
}

export type LogTypeOption = {
	value: LogType
	label: string
}

export type LogTypeMeta = {
	label: string
	icon: LucideIcon
	badge: 'blue' | 'green' | 'amber' | 'neutral' | 'red'
}

export type LogTableRowProps = {
	entry: LogEntryView
	active: boolean
	onSelect: () => void
	onDelete: () => void
}

export type LogDetailSheetProps = {
	entry: LogEntryView | null
	onClose: () => void
	onDelete: (errorId: string) => Promise<void>
}

export type LogSectionProps = {
	title: string
	copyValue?: string
	children: ReactNode
}

export type KeyValProps = {
	label: string
	value: string
	copy?: boolean
}
