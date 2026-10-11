'use client'

import { periodOf } from './format'
import type { TimeGrid } from './grid'
import type {
	TimePickerColumnType,
	TimePickerGranularity,
	TimePickerHourCycle,
	TimePickerI18nConfig,
	TimePickerPeriod,
	TimePickerTime,
} from './types'

type TimePickerOption = {
	value: number | TimePickerPeriod
	label: string
	typed: number | null
	disabled: boolean
}

function columnValueOf(time: TimePickerTime, type: TimePickerColumnType) {
	return type === 'period' ? periodOf(time.hour) : time[type]
}
function columnPeriod(display: TimePickerTime | null, firstEnabled: TimePickerTime | null): TimePickerPeriod {
	if (display) return periodOf(display.hour)
	return firstEnabled ? periodOf(firstEnabled.hour) : 'am'
}
function columnHidden(type: TimePickerColumnType, hourCycle: TimePickerHourCycle, granularity: TimePickerGranularity) {
	return (
		(type === 'period' && hourCycle !== 12) ||
		(type === 'minute' && granularity === 'hour') ||
		(type === 'second' && granularity !== 'second')
	)
}
function columnOptions(
	type: TimePickerColumnType,
	grid: TimeGrid,
	flags: boolean[],
	hourCycle: TimePickerHourCycle,
	period: TimePickerPeriod,
	i18n: TimePickerI18nConfig
): TimePickerOption[] {
	const { formatSegment } = i18n.functions
	if (type === 'period') {
		return (['am', 'pm'] as const).map((value, index) => ({
			value,
			label: i18n.labels[value],
			typed: null,
			disabled: !flags[index],
		}))
	}
	if (type === 'hour') {
		return grid.hours.flatMap((hour, index) => {
			if (hourCycle === 12 && periodOf(hour) !== period) return []
			const shown = hourCycle === 12 ? hour % 12 || 12 : hour
			return [
				{
					value: hour,
					label: formatSegment(shown, 'hour'),
					typed: shown,
					disabled: !flags[index],
				},
			]
		})
	}
	const values = type === 'minute' ? grid.minutes : grid.seconds
	return values.map((value, index) => ({
		value,
		label: formatSegment(value, type),
		typed: value,
		disabled: !flags[index],
	}))
}
function highlightFor(
	options: TimePickerOption[],
	enabled: number[],
	selectedIndex: number,
	current: number | TimePickerPeriod | undefined,
	first: number | TimePickerPeriod | undefined
) {
	if (selectedIndex !== -1) return selectedIndex
	if (typeof current === 'number') {
		const below = findLast(enabled, (index) => {
			const value = options[index].value
			return typeof value === 'number' && value < current
		})
		return below ?? enabled[0] ?? -1
	}
	const preferred = enabled.find((index) => options[index].value === first)
	return preferred ?? enabled[0] ?? -1
}
function findLast<T>(items: T[], test: (item: T) => boolean) {
	for (let index = items.length - 1; index >= 0; index--) {
		if (test(items[index])) return items[index]
	}
	return undefined
}

export { columnOptions, columnValueOf, columnPeriod, columnHidden, findLast, highlightFor, type TimePickerOption }
