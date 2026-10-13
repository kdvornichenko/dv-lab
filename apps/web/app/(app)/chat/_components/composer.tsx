'use client'

import {
	Fragment,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type ReactNode,
	type RefObject,
} from 'react'

import { AnimatePresence } from 'framer-motion'
import { ArrowUp, Info } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Elevated } from '@/lib/elevated'

import type { MentionBinding, StudentLessonOption } from '@dv-lab/contracts'

import { MentionPopup, popupOptionId, type PopupItem, type PopupState } from './mention-popup'
import {
	insertMention,
	matchStudents,
	removeToken,
	replaceText,
	tokenStart,
	type Draft,
	type MentionStudents,
} from './use-chat'

type Trigger = { kind: 'mention'; from: number; query: string } | { kind: 'command'; query: string } | null

const COMMANDS = [
	{ name: '/today', detail: "Today's lessons", student: false },
	{ name: '/tomorrow', detail: "Tomorrow's lessons", student: false },
	{ name: '/payments', detail: 'Who pays soon', student: false },
	{ name: '/note', detail: 'Add a note to a student', student: true },
	{ name: '/recap', detail: 'Summarise a student', student: true },
] as const

const QUICK = [
	{ label: 'Was', text: 'was at the lesson today' },
	{ label: "Didn't happen", text: "didn't happen" },
	{ label: 'No-show', text: "didn't come" },
	{ label: 'Moved to…', text: 'moved to ' },
] as const

const QUICK_TEXTS = new Set(QUICK.map((item) => item.text.trim()))

function findTrigger(draft: Draft, caret: number): Trigger {
	const text = draft.text
	if (draft.bindings.some((binding) => caret > tokenStart(text, binding) && caret <= binding.end)) return null
	const head = text.slice(0, caret)
	if (/^\/[a-z]*$/i.test(head)) return { kind: 'command', query: head.slice(1).toLowerCase() }
	const at = head.lastIndexOf('@')
	if (at < 0 || (at > 0 && !/\s/.test(head[at - 1] ?? ''))) return null
	if (draft.bindings.some((binding) => tokenStart(text, binding) === at)) return null
	const query = head.slice(at + 1)
	if (/^\s/.test(query) || query.includes('\n') || Array.from(query).length > 40) return null
	return { kind: 'mention', from: at, query }
}

function nameKey(name: string): string {
	return name.normalize('NFC').toLocaleLowerCase()
}

function studentItems(rows: readonly StudentLessonOption[], query: string): PopupItem[] {
	const counts = new Map<string, number>()
	for (const row of rows) counts.set(nameKey(row.displayName), (counts.get(nameKey(row.displayName)) ?? 0) + 1)
	return matchStudents(rows, query).map((row) => ({
		kind: 'student',
		id: row.id,
		name: row.displayName,
		detail: (counts.get(nameKey(row.displayName)) ?? 0) > 1 ? `Usual lesson ${row.defaultLessonMinutes} min` : null,
	}))
}

function commandItems(query: string): PopupItem[] {
	return COMMANDS.filter((command) => command.name.slice(1).startsWith(query)).map((command) => ({
		kind: 'command',
		id: command.name,
		name: command.name,
		detail: command.detail,
	}))
}

function Highlight({ text, bindings }: { text: string; bindings: readonly MentionBinding[] }) {
	const parts: ReactNode[] = []
	let cursor = 0
	for (const binding of bindings) {
		const start = tokenStart(text, binding)
		if (start < cursor) continue
		parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, start)}</Fragment>)
		parts.push(
			<mark key={`m${start}`} className="rounded-sm bg-active text-transparent">
				{text.slice(start, binding.end)}
			</mark>
		)
		cursor = binding.end
	}
	parts.push(<Fragment key={`t${cursor}`}>{`${text.slice(cursor)}​`}</Fragment>)
	return <>{parts}</>
}

const FIELD_TEXT =
	'text-body pointer-coarse:text-[16px] pointer-coarse:leading-6 whitespace-pre-wrap break-words [overflow-wrap:anywhere] [scrollbar-gutter:stable]'

export function Composer({
	draft,
	onDraft,
	onType,
	students,
	onRetryStudents,
	disabled,
	sending,
	onSend,
	inputRef,
}: {
	draft: Draft
	onDraft: (draft: Draft) => void
	onType: (text: string) => void
	students: MentionStudents
	onRetryStudents: () => void
	disabled: boolean
	sending: boolean
	onSend: () => void
	inputRef: RefObject<HTMLTextAreaElement | null>
}) {
	const canSend = !disabled && !sending && !draft.stale && draft.text.trim() !== ''
	const listId = useId()
	const backdrop = useRef<HTMLDivElement>(null)
	const pendingCaret = useRef<number | null>(null)
	const [caret, setCaret] = useState(0)
	const [focused, setFocused] = useState(false)
	const [dismissed, setDismissed] = useState<number | null>(null)
	const [active, setActiveState] = useState({ key: '', index: 0 })

	const trigger = findTrigger(draft, caret)
	const triggerAt = trigger === null ? null : trigger.kind === 'command' ? -1 : trigger.from
	const triggerKey = `${triggerAt}:${trigger?.query ?? ''}`
	const popupState: PopupState =
		trigger?.kind === 'command' ? 'ready' : students.kind === 'ready' ? 'ready' : students.kind
	const items =
		trigger === null
			? []
			: trigger.kind === 'command'
				? commandItems(trigger.query)
				: students.kind === 'ready'
					? studentItems(students.rows, trigger.query)
					: []
	const hidesEmpty = trigger?.kind === 'mention' && /\s/.test(trigger.query) && items.length === 0
	const open =
		focused &&
		!disabled &&
		trigger !== null &&
		triggerAt !== dismissed &&
		!hidesEmpty &&
		!(trigger.kind === 'command' && items.length === 0)
	const activeIndex = active.key === triggerKey ? Math.min(active.index, Math.max(items.length - 1, 0)) : 0
	const listed = open && popupState === 'ready' && items.length > 0

	useLayoutEffect(() => {
		const field = inputRef.current
		if (pendingCaret.current === null || !field) return
		field.setSelectionRange(pendingCaret.current, pendingCaret.current)
		pendingCaret.current = null
	}, [draft, inputRef])

	function setActive(index: number) {
		setActiveState({ key: triggerKey, index })
	}

	function apply(next: { draft: Draft; caret: number }) {
		pendingCaret.current = next.caret
		setCaret(next.caret)
		setDismissed(null)
		onDraft(next.draft)
		inputRef.current?.focus()
	}

	function readCaret() {
		const field = inputRef.current
		if (field) setCaret(field.selectionStart ?? 0)
	}

	function choose(index: number) {
		const item = items[index]
		if (!item || trigger === null) return
		if (trigger.kind === 'command') {
			const command = COMMANDS.find((entry) => entry.name === item.name)
			apply(replaceText(draft, 0, caret, command?.student ? `${item.name} @` : `${item.name} `))
			return
		}
		if (students.kind !== 'ready') return
		const student = students.rows.find((row) => row.id === item.id)
		if (student) apply(insertMention(draft, trigger.from, caret, student))
	}

	function quick(text: string) {
		const binding = draft.bindings[0]
		if (!binding) return
		const tail = draft.text.slice(binding.end).trim().toLocaleLowerCase()
		if (tail === '' || QUICK_TEXTS.has(tail)) apply(replaceText(draft, binding.end, draft.text.length, ` ${text}`))
		else {
			const gap = /\s$/.test(draft.text) ? '' : ' '
			apply(replaceText(draft, draft.text.length, draft.text.length, `${gap}${text}`))
		}
	}

	function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
		if (event.nativeEvent.isComposing || event.keyCode === 229) return
		if (open && event.key === 'Escape') {
			event.preventDefault()
			event.stopPropagation()
			setDismissed(triggerAt)
			return
		}
		if (listed && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
			event.preventDefault()
			const step = event.key === 'ArrowDown' ? 1 : -1
			setActive((activeIndex + step + items.length) % items.length)
			return
		}
		if (listed && (event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
			event.preventDefault()
			choose(activeIndex)
			return
		}
		if (open && event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			return
		}
		const field = event.currentTarget
		const collapsed = field.selectionStart === field.selectionEnd
		const at = field.selectionStart ?? 0
		if (collapsed && event.key === 'Backspace') {
			const binding = draft.bindings.find((item) => item.end === at)
			if (binding) {
				event.preventDefault()
				apply(removeToken(draft, binding))
				return
			}
		}
		if (collapsed && event.key === 'Delete') {
			const binding = draft.bindings.find((item) => tokenStart(draft.text, item) === at)
			if (binding) {
				event.preventDefault()
				apply(removeToken(draft, binding))
				return
			}
		}
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault()
			if (canSend) onSend()
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="relative">
				<AnimatePresence>
					{open ? (
						<MentionPopup
							listId={listId}
							label={trigger?.kind === 'command' ? 'Commands' : 'Students'}
							state={popupState}
							items={items}
							activeIndex={activeIndex}
							onChoose={choose}
							onRetry={onRetryStudents}
						/>
					) : null}
				</AnimatePresence>
				<Elevated offset={2} shadowLevel={2} className="flex flex-col gap-2 rounded-2xl p-3">
					<div className="relative">
						<div
							ref={backdrop}
							aria-hidden
							className={`pointer-events-none absolute inset-0 max-h-[5lh] overflow-hidden text-transparent ${FIELD_TEXT}`}
						>
							<Highlight text={draft.text} bindings={draft.bindings} />
						</div>
						<textarea
							ref={inputRef}
							data-slot="chat-composer-field"
							data-mentions={JSON.stringify(
								draft.bindings.map(({ studentId, start, end }) => ({ studentId, start, end }))
							)}
							value={draft.text}
							rows={1}
							disabled={disabled}
							placeholder="What do you want to ask?"
							aria-label="Message"
							role="combobox"
							aria-expanded={listed}
							aria-controls={listed ? listId : undefined}
							aria-activedescendant={listed ? popupOptionId(listId, activeIndex) : undefined}
							aria-autocomplete="list"
							aria-describedby={`${listId}-hint`}
							className={`relative block field-sizing-content max-h-[5lh] min-h-[1lh] w-full resize-none overflow-y-auto bg-transparent p-0 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 ${FIELD_TEXT}`}
							onChange={(event) => {
								const nextCaret = event.target.selectionStart ?? 0
								if (findTrigger({ ...draft, text: event.target.value }, nextCaret) === null) setDismissed(null)
								onType(event.target.value)
								setCaret(nextCaret)
							}}
							onSelect={readCaret}
							onKeyUp={readCaret}
							onClick={readCaret}
							onFocus={() => setFocused(true)}
							onBlur={() => setFocused(false)}
							onScroll={(event) => {
								if (backdrop.current) backdrop.current.scrollTop = event.currentTarget.scrollTop
							}}
							onKeyDown={onKeyDown}
						/>
					</div>
					{draft.bindings.length > 0 ? (
						<div className="flex flex-wrap gap-2" data-slot="chat-quick-actions">
							{QUICK.map((item) => (
								<Button
									key={item.label}
									variant="secondary"
									size="compact"
									disabled={disabled}
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => quick(item.text)}
								>
									{item.label}
								</Button>
							))}
						</div>
					) : null}
					<div className="flex items-center justify-end">
						<Button
							variant="primary"
							size="icon-compact"
							aria-label="Send"
							data-slot="chat-send"
							className="rounded-full"
							loading={sending}
							disabled={!canSend}
							onMouseDown={(event) => event.preventDefault()}
							onClick={onSend}
						>
							<ArrowUp />
						</Button>
					</div>
				</Elevated>
			</div>
			{draft.stale ? (
				<p role="status" className="flex items-start gap-2 text-caption text-muted-foreground">
					<Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-info" />
					<span className="min-w-0 flex-1">This student is no longer available. Choose a student again.</span>
				</p>
			) : null}
			<p id={`${listId}-hint`} className="text-caption text-muted-foreground">
				Shift+Enter — new line · @ — student
			</p>
		</div>
	)
}
