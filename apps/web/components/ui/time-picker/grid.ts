'use client'

import { formatTimeValue, periodOf, sameTime, toSeconds } from './format'
import type { TimePickerGranularity, TimePickerPeriod, TimePickerTime } from './types'

type TimeGrid = {
	hours: number[]
	minutes: number[]
	seconds: number[]
	min: number | null
	max: number | null
	granularity: TimePickerGranularity
	isTimeDisabled?: (value: string, time: TimePickerTime) => boolean
}
type TimeFilter = Partial<TimePickerTime> & {
	period?: TimePickerPeriod
}
function stepValues(step: number | undefined, limit: number) {
	const size = Math.floor(step ?? 1)
	if (!Number.isFinite(size)) return [0]
	const values: number[] = []
	for (let value = 0; value < limit; value += Math.max(1, size)) {
		values.push(value)
	}
	return values
}
const gridSize = (grid: TimeGrid) => grid.hours.length * grid.minutes.length * grid.seconds.length
function timeAt(grid: TimeGrid, index: number): TimePickerTime {
	const seconds = grid.seconds.length
	const minutes = grid.minutes.length
	return {
		hour: grid.hours[Math.floor(index / (minutes * seconds))],
		minute: grid.minutes[Math.floor(index / seconds) % minutes],
		second: grid.seconds[index % seconds],
	}
}
function lastAtOrBelow(values: number[], limit: number) {
	let found = 0
	for (let index = 0; index < values.length; index++) {
		if (values[index] <= limit) found = index
	}
	return found
}
function floorIndex(grid: TimeGrid, seconds: number) {
	const hour = lastAtOrBelow(grid.hours, seconds / 3600)
	const inHour = seconds - grid.hours[hour] * 3600
	const minute = lastAtOrBelow(grid.minutes, inHour / 60)
	const second = lastAtOrBelow(grid.seconds, inHour - grid.minutes[minute] * 60)
	return (hour * grid.minutes.length + minute) * grid.seconds.length + second
}
function spanInWindow(grid: TimeGrid, from: number, to: number) {
	const { min, max } = grid
	if (min !== null && max !== null && min > max) return to >= min || from <= max
	return (min === null || to >= min) && (max === null || from <= max)
}
function isEnabled(grid: TimeGrid, time: TimePickerTime) {
	const seconds = toSeconds(time)
	return spanInWindow(grid, seconds, seconds) && !grid.isTimeDisabled?.(formatTimeValue(time, grid.granularity), time)
}
function matches(time: TimePickerTime, filter: TimeFilter) {
	return (
		(filter.hour === undefined || time.hour === filter.hour) &&
		(filter.minute === undefined || time.minute === filter.minute) &&
		(filter.second === undefined || time.second === filter.second) &&
		(filter.period === undefined || periodOf(time.hour) === filter.period)
	)
}
function hasEnabled(grid: TimeGrid, filter: TimeFilter) {
	for (const hour of grid.hours) {
		if (filter.hour !== undefined && hour !== filter.hour) continue
		if (filter.period !== undefined && periodOf(hour) !== filter.period) continue
		if (!spanInWindow(grid, hour * 3600, hour * 3600 + 3599)) continue
		if (hasEnabledMinute(grid, filter, hour)) return true
	}
	return false
}

function hasEnabledMinute(grid: TimeGrid, filter: TimeFilter, hour: number) {
	for (const minute of grid.minutes) {
		if (filter.minute !== undefined && minute !== filter.minute) continue
		if (hasEnabledSecond(grid, filter, hour, minute)) return true
	}
	return false
}

function hasEnabledSecond(grid: TimeGrid, filter: TimeFilter, hour: number, minute: number) {
	for (const second of grid.seconds) {
		if (filter.second !== undefined && second !== filter.second) continue
		if (isEnabled(grid, { hour, minute, second })) return true
	}
	return false
}
function nearestEnabled(grid: TimeGrid, target: TimePickerTime, filter: TimeFilter = {}): TimePickerTime | null {
	const goal = toSeconds(target)
	const total = gridSize(grid)
	let back = floorIndex(grid, goal)
	let ahead = back + 1
	while (back >= 0 || ahead < total) {
		const behind = back >= 0 ? timeAt(grid, back) : null
		const next = ahead < total ? timeAt(grid, ahead) : null
		const useBack = !!behind && (!next || goal - toSeconds(behind) <= toSeconds(next) - goal)
		const time = (useBack ? behind : next) as TimePickerTime
		if (matches(time, filter) && isEnabled(grid, time)) return time
		if (useBack) back--
		else ahead++
	}
	return null
}
function walkEnabled(grid: TimeGrid, start: number, direction: 1 | -1, wrap: boolean): TimePickerTime | null {
	const total = gridSize(grid)
	let index = start
	for (let step = 0; step < total; step++) {
		if (index < 0 || index >= total) {
			if (!wrap) return null
			index = (index + total) % total
		}
		const time = timeAt(grid, index)
		if (isEnabled(grid, time)) return time
		index += direction
	}
	return null
}
function stepEnabled(grid: TimeGrid, from: TimePickerTime, direction: 1 | -1) {
	const index = floorIndex(grid, toSeconds(from))
	const onGrid = sameTime(timeAt(grid, index), from)
	const start = direction === 1 ? index + 1 : onGrid ? index - 1 : index
	return walkEnabled(grid, start, direction, true)
}
function firstEnabledTime(grid: TimeGrid) {
	if (grid.min === null) return walkEnabled(grid, 0, 1, true)
	const index = floorIndex(grid, grid.min)
	const start = toSeconds(timeAt(grid, index)) < grid.min ? index + 1 : index
	return walkEnabled(grid, start, 1, true)
}

export {
	firstEnabledTime,
	floorIndex,
	gridSize,
	hasEnabled,
	nearestEnabled,
	spanInWindow,
	stepEnabled,
	stepValues,
	type TimeFilter,
	type TimeGrid,
	walkEnabled,
}
