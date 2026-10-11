'use client'

import type {
	TimePickerGranularity,
	TimePickerI18nConfig,
	TimePickerI18nOverrides,
	TimePickerPeriod,
	TimePickerTime,
} from './types'

export const DEFAULT_TIME_PICKER_I18N: TimePickerI18nConfig = {
	labels: {
		placeholder: 'Choose a time',
		hour: 'Hours',
		minute: 'Minutes',
		second: 'Seconds',
		period: 'AM/PM',
		am: 'AM',
		pm: 'PM',
		now: 'Now',
		clear: 'Clear',
		confirm: 'Done',
		panelLabel: 'Time picker',
		openPicker: 'Open time picker',
	},
	functions: {
		formatSegment: (value) => String(value).padStart(2, '0'),
		formatValue: (time, context) => {
			const { hourCycle, granularity, periodPosition, labels } = context
			const hour = hourCycle === 12 ? time.hour % 12 || 12 : time.hour
			let text = `${context.formatSegment(hour, 'hour')}:${context.formatSegment(time.minute, 'minute')}`
			if (granularity === 'second') {
				text += `:${context.formatSegment(time.second, 'second')}`
			}
			if (hourCycle === 24) return text
			const period = time.hour < 12 ? labels.am : labels.pm
			return periodPosition === 'start' ? `${period} ${text}` : `${text} ${period}`
		},
	},
}
export function mergeTimePickerI18n(overrides?: TimePickerI18nOverrides): TimePickerI18nConfig {
	if (!overrides?.labels && !overrides?.functions) {
		return DEFAULT_TIME_PICKER_I18N
	}
	return {
		labels: { ...DEFAULT_TIME_PICKER_I18N.labels, ...overrides.labels },
		functions: {
			...DEFAULT_TIME_PICKER_I18N.functions,
			...overrides.functions,
		},
	}
}
const pad = (value: number) => String(value).padStart(2, '0')
const toSeconds = (time: TimePickerTime) => time.hour * 3600 + time.minute * 60 + time.second
const periodOf = (hour: number): TimePickerPeriod => (hour < 12 ? 'am' : 'pm')
const sameTime = (a: TimePickerTime | null, b: TimePickerTime | null) =>
	a === b || (!!a && !!b && toSeconds(a) === toSeconds(b))
export function parseTimeValue(value: string | null | undefined): TimePickerTime | null {
	const match = /^\s*(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*$/.exec(value ?? '')
	if (!match) return null
	const time = {
		hour: Number(match[1]),
		minute: Number(match[2]),
		second: Number(match[3] ?? 0),
	}
	return time.hour < 24 && time.minute < 60 && time.second < 60 ? time : null
}
export function formatTimeValue(time: TimePickerTime, granularity: TimePickerGranularity = 'minute'): string {
	const value = `${pad(time.hour)}:${pad(time.minute)}`
	return granularity === 'second' ? `${value}:${pad(time.second)}` : value
}
function normalizeTyped(text: string) {
	return text
		.normalize('NFKC')
		.replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
		.replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
		.replace(/[\u00a0\u202f]/g, ' ')
		.toLowerCase()
}

export { normalizeTyped, pad, periodOf, sameTime, toSeconds }
