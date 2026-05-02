import { CalendarClock, Database, Settings, Terminal, Users, WalletCards } from 'lucide-react'

import type { CrmErrorLogEntry } from '@/lib/crm/error-log'

import type { LogEntryType, LogEntryView, LogTypeMeta, LogTypeOption } from './error-log.types'

export const LOG_TYPES: LogTypeOption[] = [
	{ value: 'all', label: 'All types' },
	{ value: 'calendar', label: 'Calendar' },
	{ value: 'students', label: 'Students' },
	{ value: 'lessons', label: 'Lessons' },
	{ value: 'payments', label: 'Payments' },
	{ value: 'settings', label: 'Settings' },
	{ value: 'system', label: 'System' },
]

export const LOG_TYPE_META: Record<LogEntryType, LogTypeMeta> = {
	calendar: { label: 'Calendar', icon: CalendarClock, badge: 'blue' },
	students: { label: 'Students', icon: Users, badge: 'green' },
	lessons: { label: 'Lessons', icon: Database, badge: 'amber' },
	payments: { label: 'Payments', icon: WalletCards, badge: 'green' },
	settings: { label: 'Settings', icon: Settings, badge: 'neutral' },
	system: { label: 'System', icon: Terminal, badge: 'red' },
}

export function formatLogTime(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).format(new Date(value))
}

export function formatLogDate(value: string) {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: '2-digit',
		year: 'numeric',
	}).format(new Date(value))
}

export function inferLogType(error: CrmErrorLogEntry): LogEntryType {
	const text = `${error.source} ${error.message}`.toLowerCase()
	if (text.includes('calendar') || text.includes('google')) return 'calendar'
	if (text.includes('student')) return 'students'
	if (text.includes('lesson') || text.includes('attendance')) return 'lessons'
	if (text.includes('payment') || text.includes('billing')) return 'payments'
	if (text.includes('settings') || text.includes('sidebar') || text.includes('theme')) return 'settings'
	return 'system'
}

export function extractEndpoint(message: string) {
	const match = message.match(/\b(GET|POST|PATCH|PUT|DELETE)\s+(\/?api\/[^\s:]+)/i)
	if (!match) return null

	const method = match[1].toUpperCase()
	const endpoint = match[2].startsWith('/') ? match[2] : `/${match[2]}`
	return `${method} ${endpoint}`
}

export function normalizeLogEntry(error: CrmErrorLogEntry): LogEntryView {
	const type = inferLogType(error)
	return {
		...error,
		endpoint: extractEndpoint(error.message),
		eventId: `log_${error.id.slice(-6)}`,
		type,
		typeLabel: LOG_TYPE_META[type].label,
		createdDate: new Date(error.createdAt),
		timeLabel: formatLogTime(error.createdAt),
		dateLabel: formatLogDate(error.createdAt),
		traceId: `tr_${error.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`,
	}
}

export function matchLogQuery(entry: LogEntryView, query: string) {
	if (!query) return true
	return [entry.eventId, entry.traceId, entry.typeLabel, entry.endpoint, entry.source, entry.message]
		.join(' ')
		.toLowerCase()
		.includes(query)
}
