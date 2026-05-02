import type { CalendarTone, View } from './types'

export const VIEW_ORDER: View[] = ['day', 'week', 'month', 'year']
export const WEEK_START_HOUR = 0
export const WEEK_END_HOUR = 23
export const HOUR_PX = 64

export const TONE_EVENT: Record<CalendarTone, string> = {
	default: 'border-sage/40 bg-sage-soft text-ink',
	blue: 'border-chart/40 bg-chart/15 text-ink',
	green: 'border-success/40 bg-success-soft text-ink',
	pink: 'border-danger/40 bg-danger-soft text-ink',
	purple: 'border-warning/40 bg-warning-soft text-ink',
	orange: 'border-warning/40 bg-warning-soft text-ink',
	gray: 'border-line-strong bg-surface-muted text-ink-muted',
}

export const TONE_RAIL: Record<CalendarTone, string> = {
	default: 'bg-sage',
	blue: 'bg-chart',
	green: 'bg-success',
	pink: 'bg-danger',
	purple: 'bg-warning',
	orange: 'bg-warning',
	gray: 'bg-ink-muted',
}
