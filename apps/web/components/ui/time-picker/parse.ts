'use client'

import { DEFAULT_TIME_PICKER_I18N, normalizeTyped } from './format'
import type { TimePickerHourCycle, TimePickerLabels, TimePickerPeriod, TimePickerTime } from './types'

export function parseTimeInput(
	text: string,
	options: {
		hourCycle?: TimePickerHourCycle
		period?: TimePickerPeriod
		labels?: Pick<TimePickerLabels, 'am' | 'pm'>
	} = {}
): TimePickerTime | null {
	const labels = options.labels ?? DEFAULT_TIME_PICKER_I18N.labels
	const { source, period } = inputPeriod(normalizeTyped(text).trim(), labels)
	const fields = inputFields(source)
	if (!fields) return null
	const typedHour = Number(fields[0])
	const minute = Number(fields[1] ?? 0)
	const second = Number(fields[2] ?? 0)
	if (minute > 59 || second > 59) return null
	const hour = inputHour(typedHour, period, options)
	return hour === null ? null : { hour, minute, second }
}

function inputPeriod(source: string, labels: Pick<TimePickerLabels, 'am' | 'pm'>) {
	let period: TimePickerPeriod | undefined
	for (const [label, value] of [
		[labels.pm, 'pm'],
		[labels.am, 'am'],
	] as const) {
		const needle = normalizeTyped(label).trim()
		if (needle && source.includes(needle)) {
			period = value
			source = source.replace(needle, ' ').trim()
			break
		}
	}
	if (!period) {
		const suffix = /\s*([ap])\.?\s*(?:m\.?)?$/.exec(source)
		if (suffix) {
			period = suffix[1] === 'a' ? 'am' : 'pm'
			source = source.slice(0, suffix.index)
		}
	}
	return { source, period }
}

function inputFields(source: string): string[] | null {
	if (/[^\d\s:.h]/.test(source)) return null
	const parts = source.split(/[^\d]+/).filter(Boolean)
	let fields = parts
	if (parts.length === 1 && parts[0].length > 2) {
		const digits = parts[0]
		if (digits.length > 6) return null
		const hourLength = digits.length % 2 === 1 ? 1 : 2
		fields = [digits.slice(0, hourLength)]
		for (let index = hourLength; index < digits.length; index += 2) {
			fields.push(digits.slice(index, index + 2))
		}
	}
	if (fields.length === 0 || fields.length > 3) return null
	if (fields.slice(1).some((field) => field.length !== 2)) return null
	return fields
}

function inputHour(
	hour: number,
	period: TimePickerPeriod | undefined,
	options: { hourCycle?: TimePickerHourCycle; period?: TimePickerPeriod }
): number | null {
	const resolved =
		period ?? (options.hourCycle === 12 && hour >= 1 && hour <= 12 ? (options.period ?? 'am') : undefined)
	if (resolved) {
		if (hour < 1 || hour > 12) return null
		hour = (hour % 12) + (resolved === 'pm' ? 12 : 0)
	}
	return hour < 24 ? hour : null
}
