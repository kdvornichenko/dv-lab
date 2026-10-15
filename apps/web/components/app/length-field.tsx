'use client'

import {
	Fragment,
	useId,
	useRef,
	useState,
	type ChangeEvent,
	type FocusEvent,
	type KeyboardEvent,
	type Ref,
} from 'react'

import { Input } from '@/components/ui/input'
import { draftOf, normalizeDraft, stepDraft, type LengthDraft } from '@/lib/lesson-length'

type Part = keyof LengthDraft

interface LengthFieldProps {
	id: string
	initialMinutes: number
	onCommit: (minutes: number | null) => void
	helper?: string
	error?: string
	disabled?: boolean
	label?: string
	hoursRef?: Ref<HTMLInputElement>
}

export function LengthField({
	id,
	initialMinutes,
	onCommit,
	helper,
	error,
	disabled,
	label = 'Length',
	hoursRef,
}: LengthFieldProps) {
	const [draft, setDraft] = useState<LengthDraft>(() => draftOf(initialMinutes))
	const draftRef = useRef(draft)
	const minutesInput = useRef<HTMLInputElement>(null)
	const group = useRef<HTMLDivElement>(null)
	const labelId = useId()
	const noteId = `${id}-note`
	const invalid = error ? true : undefined

	function update(next: LengthDraft) {
		draftRef.current = next
		setDraft(next)
	}

	function commit() {
		const result = normalizeDraft(draftRef.current)
		update(result.draft)
		onCommit(result.minutes)
	}

	function change(part: Part, event: ChangeEvent<HTMLInputElement>) {
		const digits = event.target.value.replace(/\D/g, '').slice(0, 2)
		update({ ...draftRef.current, [part]: digits })
		if (part === 'hours' && digits.length === 2) minutesInput.current?.focus()
	}

	function keyDown(part: Part, event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Enter') {
			event.preventDefault()
			commit()
			return
		}
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
		event.preventDefault()
		const stepped = stepDraft(draftRef.current, part, event.key === 'ArrowUp' ? 1 : -1)
		update(stepped)
		onCommit(normalizeDraft(stepped).minutes)
	}

	function blur(part: Part, event: FocusEvent<HTMLInputElement>) {
		const next = event.relatedTarget
		if (next instanceof Node && group.current?.contains(next)) {
			if (part === 'hours') update({ ...draftRef.current, hours: draftRef.current.hours.padStart(2, '0') })
			return
		}
		commit()
	}

	const parts = [
		{ part: 'hours', ref: hoursRef, inputId: id, placeholder: 'HH' },
		{ part: 'minutes', ref: minutesInput, inputId: `${id}-minutes`, placeholder: 'MM' },
	] as const

	return (
		<div className="flex min-w-0 flex-col gap-unit-0.5">
			<span id={labelId} className="text-body text-muted-foreground">
				{label}
			</span>
			<div ref={group} role="group" aria-labelledby={labelId} className="flex items-center gap-2">
				{parts.map(({ part, ref, inputId, placeholder }) => (
					<Fragment key={part}>
						{part === 'minutes' ? (
							<span aria-hidden className="text-body text-foreground select-none">
								:
							</span>
						) : null}
						<Input
							ref={ref}
							id={inputId}
							name={inputId}
							value={draft[part]}
							disabled={disabled}
							inputMode="numeric"
							autoComplete="off"
							maxLength={2}
							placeholder={placeholder}
							aria-label={`${label}, ${part}`}
							aria-invalid={invalid}
							aria-describedby={error || helper ? noteId : undefined}
							className="w-16 flex-none px-0 text-center tabular-nums"
							onChange={(event) => change(part, event)}
							onKeyDown={(event) => keyDown(part, event)}
							onBlur={(event) => blur(part, event)}
							onFocus={(event) => event.currentTarget.select()}
							onMouseUp={(event) => {
								if (event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) event.preventDefault()
							}}
						/>
					</Fragment>
				))}
			</div>
			{error ? (
				<p id={noteId} className="text-caption text-destructive">
					{error}
				</p>
			) : helper ? (
				<p id={noteId} className="text-caption text-muted-foreground">
					{helper}
				</p>
			) : null}
		</div>
	)
}
