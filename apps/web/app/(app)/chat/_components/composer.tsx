'use client'

import {
	Fragment,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type KeyboardEvent,
	type MouseEvent,
	type ReactNode,
	type RefObject,
} from 'react'

import { AnimatePresence } from 'framer-motion'
import { ArrowUp, Info, RefreshCw, Square } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Elevated } from '@/lib/elevated'

import { CHAT_MESSAGE_MAX, type MentionBinding, type StudentLessonOption } from '@dv-lab/contracts'

import { BudgetNotice } from './budget-notice'
import { MentionPopup, popupOptionId, type PopupItem, type PopupState } from './mention-popup'
import { ModelControls, choiceUnavailable, readChoice } from './model-controls'
import {
	insertMention,
	matchStudents,
	removeToken,
	replaceText,
	tokenStart,
	type ChatModels,
	type Draft,
	type MentionStudents,
} from './use-chat'

type Trigger = { kind: 'mention'; from: number; query: string } | { kind: 'command'; query: string } | null

export const COMMANDS = [
	{ name: '/today', detail: "Today's lessons", student: false },
	{ name: '/tomorrow', detail: "Tomorrow's lessons", student: false },
	{ name: '/payments', detail: 'Who pays soon', student: false },
	{ name: '/note', detail: 'Add a note to a student', student: true },
	{ name: '/recap', detail: 'Summarise a student', student: true },
	{ name: '/essay', detail: 'Feedback on a pasted essay', student: false },
] as const

export const COMMAND_ROWS = [
	{ name: '@', detail: 'Mention a student', text: '@' },
	...COMMANDS.map((command) => ({
		name: command.name,
		detail: command.detail,
		text: command.student ? `${command.name} @` : `${command.name} `,
	})),
] as const

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

const PLACEHOLDER = 'Type / for commands or @ for a student'
const HINT = 'Shift+Enter — new line'

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
	replying,
	stopping,
	onStop,
	inputRef,
	models,
}: {
	draft: Draft
	onDraft: (draft: Draft) => void
	onType: (text: string) => void
	students: MentionStudents
	onRetryStudents: () => void
	disabled: boolean
	sending: boolean
	onSend: () => void
	replying: boolean
	stopping: boolean
	onStop: () => void
	inputRef: RefObject<HTMLTextAreaElement | null>
	models: ChatModels
}) {
	const [menuOpen, setMenuOpen] = useState(false)
	const choice = readChoice(models)
	const budget = models.assistant.kind === 'ready' ? models.assistant.data.budget : null
	const reached = budget?.state === 'reached'
	const unavailable = choice !== null && choiceUnavailable(choice)
	const configFailed = models.assistant.kind === 'failed'
	const closed = reached || unavailable || configFailed
	const tooLong = Array.from(draft.text).length > CHAT_MESSAGE_MAX
	const canSend = !disabled && !replying && !sending && !draft.stale && !closed && !tooLong && draft.text.trim() !== ''
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
	const hidesEmpty =
		trigger?.kind === 'mention' && students.kind === 'ready' && /\s/.test(trigger.query) && items.length === 0
	const open =
		focused &&
		!disabled &&
		!replying &&
		!reached &&
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

	function focusField(event: MouseEvent<HTMLDivElement>) {
		const target = event.target
		if (!(target instanceof Element) || !event.currentTarget.contains(target)) return
		if (target.closest('button, a, textarea, input, [role="option"]')) return
		event.preventDefault()
		inputRef.current?.focus()
	}

	return (
		<div className="flex flex-col gap-2" onMouseDown={focusField}>
			{budget ? <BudgetNotice budget={budget} /> : null}
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
				<Elevated
					offset={2}
					shadowLevel={2}
					className="flex flex-col gap-2 rounded-2xl p-3 focus-within:ring-1 focus-within:ring-[color:var(--focus-ring,#6B97FF)]"
				>
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
							disabled={disabled || replying || reached}
							placeholder={
								reached ? 'Monthly budget reached' : replying ? 'Wait for the reply, or stop it' : PLACEHOLDER
							}
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
							onFocus={() => {
								setFocused(true)
								readCaret()
							}}
							onBlur={() => setFocused(false)}
							onScroll={(event) => {
								if (backdrop.current) backdrop.current.scrollTop = event.currentTarget.scrollTop
							}}
							onKeyDown={onKeyDown}
						/>
					</div>
					<div className="flex items-center justify-between gap-2">
						<div className="min-w-0 flex-1">
							<ModelControls
								models={models}
								disabled={disabled || replying || reached}
								menuOpen={menuOpen}
								onMenuOpenChange={setMenuOpen}
							/>
						</div>
						{replying ? (
							<Button
								variant="secondary"
								size="compact"
								leadingIcon={Square}
								data-slot="chat-stop"
								className="rounded-full"
								loading={stopping}
								onClick={onStop}
							>
								{stopping ? 'Stopping reply…' : 'Stop reply'}
							</Button>
						) : (
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
						)}
					</div>
				</Elevated>
			</div>
			{unavailable && choice ? (
				<p
					role="status"
					className="flex items-center gap-2 text-caption text-muted-foreground"
					data-slot="model-unavailable"
				>
					<Info aria-hidden className="size-3.5 shrink-0 text-info" />
					<span className="min-w-0 flex-1">
						{choice.model?.name ?? choice.modelId} is not available. Choose another model.
					</span>
					<Button type="button" variant="secondary" size="compact" onClick={() => setMenuOpen(true)}>
						Choose another model
					</Button>
				</p>
			) : null}
			{configFailed ? (
				<p
					role="alert"
					className="flex items-center gap-2 text-caption text-destructive"
					data-slot="model-config-failed"
				>
					<span className="min-w-0 flex-1">Model settings are unavailable. Refresh before sending.</span>
					<Button type="button" variant="tertiary" size="compact" leadingIcon={RefreshCw} onClick={models.refresh}>
						Refresh
					</Button>
				</p>
			) : null}
			{tooLong ? (
				<p role="status" data-slot="chat-too-long" className="text-caption text-destructive">
					This essay is too long for the current chat limit. Shorten it before sending.
				</p>
			) : null}
			{draft.stale ? (
				<p role="status" className="flex items-start gap-2 text-caption text-muted-foreground">
					<Info aria-hidden className="mt-0.5 size-3.5 shrink-0 text-info" />
					<span className="min-w-0 flex-1">This student is no longer available. Choose a student again.</span>
				</p>
			) : null}
			<p id={`${listId}-hint`} className="text-caption text-muted-foreground pointer-coarse:hidden">
				{HINT}
			</p>
		</div>
	)
}

export function ComposerSkeleton() {
	return (
		<div className="flex flex-col gap-2">
			<Elevated offset={2} shadowLevel={2} className="flex flex-col gap-2 rounded-2xl p-3">
				<textarea
					rows={1}
					disabled
					aria-label="Message"
					placeholder={PLACEHOLDER}
					className={`block field-sizing-content max-h-[5lh] min-h-[1lh] w-full resize-none bg-transparent p-0 text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 ${FIELD_TEXT}`}
				/>
				<div className="flex items-center justify-between gap-2">
					<div className="flex min-w-0 flex-1 gap-0.5">
						<Skeleton className="h-7 w-28 rounded-full" />
						<Skeleton className="h-7 w-24 rounded-full" />
					</div>
					<Button variant="primary" size="icon-compact" aria-label="Send" className="rounded-full" disabled>
						<ArrowUp />
					</Button>
				</div>
			</Elevated>
			<p className="text-caption text-muted-foreground pointer-coarse:hidden">{HINT}</p>
		</div>
	)
}
