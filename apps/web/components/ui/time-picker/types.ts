'use client'

export type TimePickerTime = {
	hour: number
	minute: number
	second: number
}
export type TimePickerGranularity = 'hour' | 'minute' | 'second'
export type TimePickerHourCycle = 12 | 24
export type TimePickerPeriod = 'am' | 'pm'
export type TimePickerPeriodPosition = 'start' | 'end'
export type TimePickerUnit = 'hour' | 'minute' | 'second'
export type TimePickerColumnType = TimePickerUnit | 'period'
export type TimePickerLabels = {
	placeholder: string
	hour: string
	minute: string
	second: string
	period: string
	am: string
	pm: string
	now: string
	clear: string
	confirm: string
	panelLabel: string
	openPicker: string
}
export type TimePickerFormatContext = {
	hourCycle: TimePickerHourCycle
	granularity: TimePickerGranularity
	periodPosition: TimePickerPeriodPosition
	labels: TimePickerLabels
	formatSegment: TimePickerFunctions['formatSegment']
}
export type TimePickerFunctions = {
	formatSegment: (value: number, unit: TimePickerUnit) => string
	formatValue: (time: TimePickerTime, context: TimePickerFormatContext) => string
}
export type TimePickerI18nConfig = {
	labels: TimePickerLabels
	functions: TimePickerFunctions
}
export type TimePickerI18nOverrides = {
	labels?: Partial<TimePickerLabels>
	functions?: Partial<TimePickerFunctions>
}
