'use client'
import type { Ref } from 'react'
import { createContext, useContext } from 'react'

import { formatTimeValue, parseTimeValue } from './format'
import { floorIndex, walkEnabled, type TimeGrid } from './grid'
import type {
	TimePickerGranularity,
	TimePickerHourCycle,
	TimePickerI18nConfig,
	TimePickerPeriodPosition,
	TimePickerTime,
} from './types'

type TimePickerContextValue = {
	id: string
	time: TimePickerTime | null
	display: TimePickerTime | null
	grid: TimeGrid
	firstEnabled: TimePickerTime | null
	hourCycle: TimePickerHourCycle
	granularity: TimePickerGranularity
	periodPosition: TimePickerPeriodPosition
	i18n: TimePickerI18nConfig
	disabled: boolean
	readOnly: boolean
	invalid: boolean
	requireConfirm: boolean
	required: boolean
	label: string | undefined
	labelledBy: string | undefined
	describedBy: string | undefined
	open: boolean
	setOpen: (open: boolean) => void
	select: (time: TimePickerTime | null) => void
	commit: (time: TimePickerTime | null) => void
	confirm: () => void
	hasDraft: boolean
	discardDraft: () => void
	format: (time: TimePickerTime) => string
	getGoal: () => ColumnGoal | null
	setGoal: (goal: ColumnGoal) => void
	registerFocusTarget: (node: HTMLElement | null) => void
	registerColumns: (node: HTMLElement | null) => void
	getColumns: () => HTMLElement | null
}
type ColumnGoal = {
	goal: TimePickerTime
	result: TimePickerTime
}
const TimePickerContext = createContext<TimePickerContextValue | null>(null)
const SurfaceContext = createContext<'inline' | 'popup'>('inline')
function useTimePickerContext(part: string) {
	const context = useContext(TimePickerContext)
	if (!context) throw new Error(`${part} must be used within a TimePicker`)
	return context
}
export type TimePickerApi = {
	value: string | null
	time: TimePickerTime | null
	open: boolean
	setOpen: (open: boolean) => void
	setValue: (value: string | null) => void
	now: () => void
	clear: () => void
	confirm: () => void
}
export function useTimePicker(): TimePickerApi {
	const context = useTimePickerContext('useTimePicker')
	return {
		value: context.time ? formatTimeValue(context.time, context.granularity) : null,
		time: context.time,
		open: context.open,
		setOpen: context.setOpen,
		setValue: (value) => context.commit(parseTimeValue(value)),
		now: () => pickNow(context),
		clear: () => context.select(null),
		confirm: context.confirm,
	}
}
function pickNow(context: TimePickerContextValue) {
	const now = new Date()
	const { grid } = context
	const seconds =
		now.getHours() * 3600 +
		(context.granularity === 'hour' ? 0 : now.getMinutes() * 60) +
		(context.granularity === 'second' ? now.getSeconds() : 0)
	const index = floorIndex(grid, seconds)
	const time = walkEnabled(grid, index, 1, false) ?? walkEnabled(grid, index - 1, -1, false)
	if (time) context.select(time)
}
function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
	if (typeof ref === 'function') ref(node)
	else if (ref) ref.current = node
}

const LIST_SELECTOR = '[data-slot="time-picker-column-list"]:not([aria-disabled="true"])'

export {
	assignRef,
	type ColumnGoal,
	LIST_SELECTOR,
	pickNow,
	SurfaceContext,
	TimePickerContext,
	type TimePickerContextValue,
	useTimePickerContext,
}
