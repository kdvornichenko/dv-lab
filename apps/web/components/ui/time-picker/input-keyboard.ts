import type { Dispatch, KeyboardEvent, SetStateAction } from 'react'
import { flushSync } from 'react-dom'

import type { TimePickerContextValue } from './context'
import { gridSize, stepEnabled, walkEnabled } from './grid'
import type { TimePickerTime } from './types'

type InputKeyState = {
	context: TimePickerContextValue
	text: string | null
	read: () => void
	parse: (source: string) => TimePickerTime | null
	setText: Dispatch<SetStateAction<string | null>>
}

export function handleInputKey(event: KeyboardEvent<HTMLInputElement>, state: InputKeyState) {
	if (event.defaultPrevented) return
	const { context, text, read, setText } = state
	if (event.key === 'Enter') {
		flushSync(() => read())
		return
	}
	if (event.key === 'Escape' && text !== null) {
		event.preventDefault()
		setText(null)
		return
	}
	if (event.altKey && event.key === 'ArrowDown') {
		event.preventDefault()
		read()
		context.setOpen(true)
		return
	}
	if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && !event.altKey && !context.readOnly) {
		event.preventDefault()
		stepInput(state, event.key === 'ArrowUp' ? 1 : -1)
	}
}

function stepInput({ context, text, parse, setText }: InputKeyState, direction: 1 | -1) {
	const { grid, time } = context
	const from = (text !== null && parse(text)) || time
	const next = from
		? stepEnabled(grid, from, direction)
		: direction === 1
			? context.firstEnabled
			: walkEnabled(grid, gridSize(grid) - 1, -1, true)
	setText(null)
	if (next) context.commit(next)
}
