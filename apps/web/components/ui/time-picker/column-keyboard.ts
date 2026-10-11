import type { KeyboardEvent, RefObject } from 'react'

import { findLast, type TimePickerOption } from './column-options'
import { LIST_SELECTOR, type TimePickerContextValue } from './context'
import { normalizeTyped, pad } from './format'
import type { TimePickerColumnType, TimePickerPeriod } from './types'

type ColumnKeyState = {
	context: TimePickerContextValue
	type: TimePickerColumnType
	options: TimePickerOption[]
	enabled: number[]
	current: number | TimePickerPeriod | undefined
	selectedIndex: number
	highlightIndex: number
	highlighted: TimePickerOption | undefined
	typeahead: RefObject<{ text: string; at: number }>
	pick: (option: TimePickerOption) => void
}

export function handleColumnKey(event: KeyboardEvent<HTMLDivElement>, state: ColumnKeyState) {
	if (event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return
	if (event.altKey) {
		if (event.key === 'ArrowUp' && state.context.open) {
			event.preventDefault()
			state.context.confirm()
		}
		return
	}
	const position = columnPosition(state, event.key === 'ArrowDown' || event.key === 'PageDown')
	const move = (index: number | undefined) => {
		event.preventDefault()
		if (index !== undefined) state.pick(state.options[index])
	}
	if (moveColumn(event.key, state.enabled, position, move)) return
	if (columnAction(event, state)) return
	const key = normalizeTyped(event.key)
	if (key.length !== 1) return
	if (state.type === 'period') {
		typePeriod(key, state, move)
		return
	}
	if (!/\d/.test(key)) return
	typeNumber(key, event.timeStamp, state, move)
}

function columnPosition({ selectedIndex, current, options, highlightIndex }: ColumnKeyState, down: boolean) {
	if (selectedIndex !== -1) return selectedIndex
	const above =
		typeof current === 'number'
			? options.findIndex((option) => typeof option.value === 'number' && option.value > current)
			: -1
	if (typeof current === 'number') return (above === -1 ? options.length : above) - 0.5
	return highlightIndex === -1 ? -0.5 : highlightIndex + (down ? -0.5 : 0.5)
}

function moveColumn(key: string, enabled: number[], position: number, move: (index: number | undefined) => void) {
	const last = enabled[enabled.length - 1]
	switch (key) {
		case 'ArrowDown':
			move(enabled.find((index) => index > position))
			break
		case 'ArrowUp':
			move(findLast(enabled, (index) => index < position))
			break
		case 'Home':
			move(enabled[0])
			break
		case 'End':
			move(last)
			break
		case 'PageDown':
			move(enabled.find((index) => index >= position + 5) ?? last)
			break
		case 'PageUp':
			move(findLast(enabled, (index) => index <= position - 5) ?? enabled[0])
			break
		default:
			return false
	}
	return true
}

function columnAction(event: KeyboardEvent<HTMLDivElement>, state: ColumnKeyState) {
	const { context, highlighted, highlightIndex, selectedIndex, pick } = state
	switch (event.key) {
		case 'ArrowLeft':
		case 'ArrowRight': {
			event.preventDefault()
			const lists = Array.from(context.getColumns()?.querySelectorAll<HTMLElement>(LIST_SELECTOR) ?? [])
			const at = lists.indexOf(event.currentTarget)
			lists[at + (event.key === 'ArrowRight' ? 1 : -1)]?.focus()
			return true
		}
		case ' ':
		case 'Enter':
			event.preventDefault()
			if (highlighted && highlightIndex !== selectedIndex) pick(highlighted)
			if (event.key === 'Enter') context.confirm()
			return true
		case 'Escape':
			if (!context.open && context.hasDraft) {
				event.preventDefault()
				event.stopPropagation()
				context.discardDraft()
			}
			return true
		default:
			return false
	}
}

function typePeriod(key: string, state: ColumnKeyState, move: (index: number | undefined) => void) {
	const { enabled, options, highlightIndex } = state
	const found = enabled.filter((index) => {
		const option = options[index]
		return (
			option.value === (key === 'a' ? 'am' : key === 'p' ? 'pm' : '') || normalizeTyped(option.label).startsWith(key)
		)
	})
	if (found.length === 0) return
	move(found[(found.indexOf(highlightIndex) + 1) % found.length])
}

function typeNumber(key: string, at: number, state: ColumnKeyState, move: (index: number | undefined) => void) {
	const { options, typeahead } = state
	const buffer = typeahead.current
	const fresh = at - buffer.at > 1000
	let typed = !fresh && buffer.text.length === 1 ? buffer.text + key : key
	const find = (text: string) => options.findIndex((option) => !option.disabled && option.typed === Number(text))
	let index = find(typed)
	if (index === -1 && typed.length === 2) {
		typed = key
		index = find(typed)
	}
	if (index === -1) {
		index = options.findIndex(
			(option) => !option.disabled && option.typed !== null && pad(option.typed).startsWith(typed)
		)
	}
	typeahead.current = { text: typed, at }
	if (index !== -1) move(index)
}
