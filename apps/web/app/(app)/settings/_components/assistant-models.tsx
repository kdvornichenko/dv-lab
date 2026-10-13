'use client'

import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { ArrowDown, ArrowUp, Check, LoaderCircle, Pencil, Plus } from 'lucide-react'

import { EFFORT_LABEL, clampEffort } from '@/components/app/effort-slider'
import { Panel } from '@/components/app/layout-parts'
import { DotShape } from '@/components/app/status-dot'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { apiRequest } from '@/lib/api-client'
import { cn } from '@/lib/utils'

import {
	CHAT_EFFORTS,
	CHAT_MAX_INPUT_TOKENS_LIMIT,
	CHAT_MAX_INPUT_TOKENS_MIN,
	CHAT_MAX_OUTPUT_TOKENS_LIMIT,
	CHAT_MAX_OUTPUT_TOKENS_MIN,
	CHAT_MODELS_MAX,
	chatModelEntry,
	saveAssistantSettingsRequest,
	type AssistantSettingsResponse,
	type ChatEffort,
	type ChatModelEntry,
} from '@dv-lab/contracts'

type Draft = {
	key: string
	id: string
	name: string
	description: string
	efforts: ChatEffort[]
	defaultEffort: ChatEffort | ''
	recommendedEffort: ChatEffort | ''
	input: string
	cacheWrite: string
	cacheRead: string
	output: string
	editing: boolean
	touched: boolean
}

type RowErrors = Partial<
	Record<
		| 'name'
		| 'description'
		| 'id'
		| 'efforts'
		| 'defaultEffort'
		| 'recommendedEffort'
		| 'input'
		| 'cacheWrite'
		| 'cacheRead'
		| 'output',
		string
	>
>

const PRICE_PATTERN = /^\d{1,6}(\.\d{1,6})?$/
const SAVE_ERROR = 'Could not save the models. Try again.'
const PRICE_ERROR = 'Enter a price in USD above zero.'
const NUMBER_FORMAT = new Intl.NumberFormat('en-US')

let counter = 0
const nextKey = () => `model-${++counter}`

function toDraft(entry: ChatModelEntry): Draft {
	return {
		key: nextKey(),
		id: entry.id,
		name: entry.name,
		description: entry.description,
		efforts: [...entry.efforts],
		defaultEffort: entry.defaultEffort,
		recommendedEffort: entry.recommendedEffort,
		input: entry.pricing.inputPerMTok,
		cacheWrite: entry.pricing.cacheWrite5mPerMTok,
		cacheRead: entry.pricing.cacheReadPerMTok,
		output: entry.pricing.outputPerMTok,
		editing: false,
		touched: false,
	}
}

function emptyDraft(): Draft {
	return {
		key: nextKey(),
		id: '',
		name: '',
		description: '',
		efforts: [...CHAT_EFFORTS],
		defaultEffort: 'medium',
		recommendedEffort: 'medium',
		input: '',
		cacheWrite: '',
		cacheRead: '',
		output: '',
		editing: true,
		touched: false,
	}
}

function toEntry(draft: Draft): unknown {
	return {
		id: draft.id.trim(),
		name: draft.name.trim(),
		description: draft.description.trim(),
		efforts: draft.efforts,
		defaultEffort: draft.defaultEffort,
		recommendedEffort: draft.recommendedEffort,
		pricing: {
			inputPerMTok: draft.input.trim(),
			cacheWrite5mPerMTok: draft.cacheWrite.trim(),
			cacheReadPerMTok: draft.cacheRead.trim(),
			outputPerMTok: draft.output.trim(),
		},
	}
}

function validPrice(text: string): boolean {
	const value = text.trim()
	return PRICE_PATTERN.test(value) && /[1-9]/.test(value)
}

function idIssue(draft: Draft): boolean {
	const parsed = chatModelEntry.safeParse(toEntry(draft))
	return !parsed.success && parsed.error.issues.some((issue) => issue.path[0] === 'id')
}

function rowErrors(draft: Draft, rows: readonly Draft[]): RowErrors {
	const errors: RowErrors = {}
	const name = draft.name.trim()
	if (name === '' || name.length > 60) errors.name = 'Enter a name.'
	const description = draft.description.trim()
	if (description === '' || description.length > 120) errors.description = 'Enter a short description.'
	const id = draft.id.trim()
	if (id === '') errors.id = 'Enter the model id.'
	else if (rows.some((other) => other.key !== draft.key && other.id.trim() === id))
		errors.id = 'This id is already in the list.'
	else if (idIssue(draft)) errors.id = 'Enter the id as Anthropic lists it, in lowercase with dashes.'
	if (draft.efforts.length === 0) errors.efforts = 'Choose at least one effort level.'
	if (draft.defaultEffort === '' || !draft.efforts.includes(draft.defaultEffort))
		errors.defaultEffort = 'Choose a default effort.'
	if (draft.recommendedEffort === '' || !draft.efforts.includes(draft.recommendedEffort))
		errors.recommendedEffort = 'Choose a recommended effort.'
	if (!validPrice(draft.input)) errors.input = PRICE_ERROR
	if (!validPrice(draft.cacheWrite)) errors.cacheWrite = PRICE_ERROR
	if (!validPrice(draft.cacheRead)) errors.cacheRead = PRICE_ERROR
	if (!validPrice(draft.output)) errors.output = PRICE_ERROR
	return errors
}

function limitError(text: string, min: number, max: number): string | null {
	const digits = text.replace(/[^\d]/g, '')
	const value = Number(digits)
	if (digits === '' || !Number.isInteger(value) || value < min || value > max)
		return `Enter a whole number from ${NUMBER_FORMAT.format(min)} to ${NUMBER_FORMAT.format(max)}.`
	return null
}

function effortSummary(draft: Draft): string {
	const levels = CHAT_EFFORTS.filter((level) => draft.efforts.includes(level))
	const first = levels[0]
	const last = levels[levels.length - 1]
	if (first === undefined || last === undefined) return 'No effort levels'
	const contiguous = CHAT_EFFORTS.indexOf(last) - CHAT_EFFORTS.indexOf(first) + 1 === levels.length
	const range =
		levels.length === 1
			? EFFORT_LABEL[first]
			: contiguous
				? `${EFFORT_LABEL[first]} to ${EFFORT_LABEL[last]}`
				: levels.map((level) => EFFORT_LABEL[level]).join(', ')
	const word = (level: ChatEffort | '') => (level === '' ? 'none' : EFFORT_LABEL[level])
	return `Effort ${range} · default ${word(draft.defaultEffort)} · recommended ${word(draft.recommendedEffort)}`
}

function Field({
	id,
	label,
	error,
	className,
	children,
}: {
	id: string
	label: string
	error?: string
	className?: string
	children: ReactNode
}) {
	return (
		<div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
			<label htmlFor={id} className="text-caption text-muted-foreground">
				{label}
			</label>
			{children}
			{error ? (
				<p id={`${id}-error`} className="text-caption text-destructive">
					{error}
				</p>
			) : null}
		</div>
	)
}

function PriceField({
	id,
	label,
	value,
	error,
	onChange,
}: {
	id: string
	label: string
	value: string
	error?: string
	onChange: (value: string) => void
}) {
	return (
		<Field id={id} label={label} error={error}>
			<div className="relative">
				<span
					aria-hidden
					className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-muted-foreground"
				>
					$
				</span>
				<Input
					id={id}
					inputMode="decimal"
					autoComplete="off"
					value={value}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? `${id}-error` : undefined}
					className="pl-6 text-right tabular-nums"
					onChange={(event) => onChange(event.target.value)}
				/>
			</div>
		</Field>
	)
}

function EffortSelect({
	id,
	value,
	options,
	error,
	onChange,
}: {
	id: string
	value: ChatEffort | ''
	options: readonly ChatEffort[]
	error?: string
	onChange: (value: ChatEffort) => void
}) {
	return (
		<Select
			value={value}
			onValueChange={(next) => {
				const level = CHAT_EFFORTS.find((item) => item === next)
				if (level) onChange(level)
			}}
		>
			<SelectTrigger id={id} placeholder="Choose" error={error} className="w-full min-w-0" />
			<SelectContent>
				{CHAT_EFFORTS.filter((level) => options.includes(level)).map((level, index) => (
					<SelectItem key={level} index={index} value={level}>
						{EFFORT_LABEL[level]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

function ModelForm({
	draft,
	errors,
	isDefault,
	last,
	onChange,
	onDefault,
	onRemove,
	onClose,
}: {
	draft: Draft
	errors: RowErrors
	isDefault: boolean
	last: boolean
	onChange: (change: Partial<Draft>) => void
	onDefault: () => void
	onRemove: () => void
	onClose: () => void
}) {
	const base = useId()
	const shown = (field: keyof RowErrors) => (draft.touched ? errors[field] : undefined)
	const touch = () => {
		if (!draft.touched) onChange({ touched: true })
	}

	function toggle(level: ChatEffort) {
		const efforts = draft.efforts.includes(level)
			? draft.efforts.filter((item) => item !== level)
			: CHAT_EFFORTS.filter((item) => item === level || draft.efforts.includes(item))
		const keep = (current: ChatEffort | '') =>
			efforts.length === 0 ? current : current === '' ? current : clampEffort(efforts, current)
		onChange({
			efforts,
			defaultEffort: keep(draft.defaultEffort),
			recommendedEffort: keep(draft.recommendedEffort),
		})
	}

	return (
		<div className="mt-3 flex flex-col gap-3" onBlur={touch} data-slot="model-form">
			<div className="grid gap-3 md:grid-cols-2">
				<Field id={`${base}-name`} label="Name" error={shown('name')}>
					<Input
						id={`${base}-name`}
						value={draft.name}
						autoComplete="off"
						aria-invalid={shown('name') ? true : undefined}
						aria-describedby={shown('name') ? `${base}-name-error` : undefined}
						onChange={(event) => onChange({ name: event.target.value })}
					/>
				</Field>
				<Field id={`${base}-id`} label="Model id" error={shown('id')}>
					<Input
						id={`${base}-id`}
						value={draft.id}
						autoComplete="off"
						spellCheck={false}
						aria-invalid={shown('id') ? true : undefined}
						aria-describedby={shown('id') ? `${base}-id-error` : undefined}
						className="font-mono"
						onChange={(event) => onChange({ id: event.target.value })}
					/>
				</Field>
			</div>
			<Field id={`${base}-description`} label="Short description" error={shown('description')}>
				<Input
					id={`${base}-description`}
					value={draft.description}
					autoComplete="off"
					aria-invalid={shown('description') ? true : undefined}
					aria-describedby={shown('description') ? `${base}-description-error` : undefined}
					onChange={(event) => onChange({ description: event.target.value })}
				/>
			</Field>
			<div className="flex flex-col gap-1.5">
				<span className="text-caption text-muted-foreground" id={`${base}-efforts`}>
					Effort levels
				</span>
				<div role="group" aria-labelledby={`${base}-efforts`} className="flex flex-wrap gap-2">
					{CHAT_EFFORTS.map((level) => {
						const on = draft.efforts.includes(level)
						return (
							<Button
								key={level}
								type="button"
								variant="tertiary"
								size="compact"
								active={on}
								aria-pressed={on}
								leadingIcon={on ? Check : undefined}
								onClick={() => toggle(level)}
							>
								{EFFORT_LABEL[level]}
							</Button>
						)
					})}
				</div>
				{shown('efforts') ? <p className="text-caption text-destructive">{errors.efforts}</p> : null}
			</div>
			<div className="grid gap-3 md:grid-cols-2">
				<Field id={`${base}-default`} label="Default effort">
					<EffortSelect
						id={`${base}-default`}
						value={draft.defaultEffort}
						options={draft.efforts}
						error={shown('defaultEffort')}
						onChange={(level) => onChange({ defaultEffort: level })}
					/>
				</Field>
				<Field id={`${base}-recommended`} label="Recommended effort">
					<EffortSelect
						id={`${base}-recommended`}
						value={draft.recommendedEffort}
						options={draft.efforts}
						error={shown('recommendedEffort')}
						onChange={(level) => onChange({ recommendedEffort: level })}
					/>
				</Field>
			</div>
			<div className="flex flex-col gap-1.5">
				<span className="text-caption text-muted-foreground">Rates, USD per 1M tokens</span>
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4">
					<PriceField
						id={`${base}-input`}
						label="Input"
						value={draft.input}
						error={shown('input')}
						onChange={(value) => onChange({ input: value })}
					/>
					<PriceField
						id={`${base}-cache-write`}
						label="Cache write"
						value={draft.cacheWrite}
						error={shown('cacheWrite')}
						onChange={(value) => onChange({ cacheWrite: value })}
					/>
					<PriceField
						id={`${base}-cache-read`}
						label="Cache read"
						value={draft.cacheRead}
						error={shown('cacheRead')}
						onChange={(value) => onChange({ cacheRead: value })}
					/>
					<PriceField
						id={`${base}-output`}
						label="Output"
						value={draft.output}
						error={shown('output')}
						onChange={(value) => onChange({ output: value })}
					/>
				</div>
			</div>
			<div className="flex flex-col gap-1">
				<Switch
					label="Default model"
					checked={isDefault}
					onToggle={onDefault}
					disabled={isDefault}
					className="w-full flex-row-reverse justify-between px-0 py-0"
				/>
				<p className="pr-13 text-caption text-muted-foreground">
					New chats start with it. The Model field of Chat model shows the same choice.
				</p>
			</div>
			<div className="flex items-center justify-between gap-2">
				<Button
					type="button"
					variant="tertiary"
					size="compact"
					className="text-destructive"
					disabled={last}
					onClick={onRemove}
				>
					Remove model
				</Button>
				<Button type="button" variant="ghost" size="compact" onClick={onClose}>
					Close
				</Button>
			</div>
		</div>
	)
}

function ModelRow({
	draft,
	place,
	first,
	last,
	only,
	isDefault,
	unavailable,
	errors,
	onChange,
	onMove,
	onDefault,
	onRemove,
}: {
	draft: Draft
	place: number
	first: boolean
	last: boolean
	only: boolean
	isDefault: boolean
	unavailable: boolean
	errors: RowErrors
	onChange: (change: Partial<Draft>) => void
	onMove: (delta: -1 | 1) => void
	onDefault: () => void
	onRemove: () => void
}) {
	const label = draft.name.trim() || 'new model'
	return (
		<li
			className={cn(
				'rounded-xl p-3 ring-1 ring-border',
				draft.editing && 'ring-input',
				unavailable && !draft.editing && 'opacity-70'
			)}
			data-slot="model-entry"
			data-model={draft.id}
		>
			<div className="flex items-start gap-3">
				<span className="w-4 pt-0.5 text-caption text-muted-foreground tabular-nums">{place}</span>
				<div className="flex flex-col">
					<Button
						type="button"
						variant="ghost"
						size="icon-compact"
						aria-label={`Move ${label} up`}
						disabled={first}
						onClick={() => onMove(-1)}
					>
						<ArrowUp />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-compact"
						aria-label={`Move ${label} down`}
						disabled={last}
						onClick={() => onMove(1)}
					>
						<ArrowDown />
					</Button>
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-0.5">
					<div className="flex items-center gap-2">
						<span className="truncate text-body font-medium text-foreground">{draft.name.trim() || 'New model'}</span>
						{isDefault ? (
							<span className="shrink-0 rounded-full bg-hover px-1.5 text-micro text-foreground">Default</span>
						) : null}
					</div>
					<span className="truncate font-mono text-micro text-muted-foreground">{draft.id || 'No id yet'}</span>
					<span className="text-caption text-muted-foreground">{effortSummary(draft)}</span>
					<span className="text-caption text-muted-foreground tabular-nums">
						Input ${draft.input || '–'} · Cache write ${draft.cacheWrite || '–'} · Cache read ${draft.cacheRead || '–'}{' '}
						· Output ${draft.output || '–'} per 1M tokens
					</span>
					{unavailable ? (
						<span className="flex items-center gap-1.5 text-caption text-muted-foreground">
							<DotShape tone="amber" />
							Not available with your API key. The chat menu skips it.
						</span>
					) : null}
				</div>
				{draft.editing ? null : (
					<Button
						type="button"
						variant="ghost"
						size="compact"
						leadingIcon={Pencil}
						aria-label={`Edit ${label}`}
						onClick={() => onChange({ editing: true })}
					>
						Edit
					</Button>
				)}
			</div>
			{draft.editing ? (
				<ModelForm
					draft={draft}
					errors={errors}
					isDefault={isDefault}
					last={only}
					onChange={onChange}
					onDefault={onDefault}
					onRemove={onRemove}
					onClose={() => onChange({ editing: false })}
				/>
			) : null}
		</li>
	)
}

export function ModelsForm({
	data,
	onSaved,
}: {
	data: AssistantSettingsResponse
	onSaved: (data: AssistantSettingsResponse) => void
}) {
	const { settings, capabilities } = data
	const [initial] = useState(() => {
		const initialRows = settings.models.map(toDraft)
		const wanted = settings.model ?? settings.models[0]?.id
		const defaultOf = initialRows.find((row) => row.id === wanted)?.key ?? initialRows[0]?.key ?? ''
		return { rows: initialRows, defaultOf }
	})
	const [rows, setRows] = useState<Draft[]>(initial.rows)
	const [defaultKey, setDefaultKey] = useState(initial.defaultOf)
	const [maxInput, setMaxInput] = useState(String(settings.maxInputTokens))
	const [maxOutput, setMaxOutput] = useState(String(settings.maxOutputTokens))
	const [saving, setSaving] = useState(false)
	const [saveError, setSaveError] = useState(false)
	const inflight = useRef(false)

	const allErrors = rows.map((row) => rowErrors(row, rows))
	const rowsValid = allErrors.every((errors) => Object.keys(errors).length === 0)
	const inputError = limitError(maxInput, CHAT_MAX_INPUT_TOKENS_MIN, CHAT_MAX_INPUT_TOKENS_LIMIT)
	const outputError = limitError(maxOutput, CHAT_MAX_OUTPUT_TOKENS_MIN, CHAT_MAX_OUTPUT_TOKENS_LIMIT)
	const valid = rowsValid && inputError === null && outputError === null && rows.length > 0

	const signature = (list: readonly Draft[], defaultOf: string, input: string, output: string) =>
		JSON.stringify([
			list.map((row) => [toEntry(row), row.key === defaultOf]),
			input.replace(/[^\d]/g, ''),
			output.replace(/[^\d]/g, ''),
		])
	const [initialSignature] = useState(() =>
		signature(initial.rows, initial.defaultOf, String(settings.maxInputTokens), String(settings.maxOutputTokens))
	)
	const dirty = signature(rows, defaultKey, maxInput, maxOutput) !== initialSignature

	function update(key: string, change: Partial<Draft>) {
		setRows((current) => current.map((row) => (row.key === key ? { ...row, ...change } : row)))
		setSaveError(false)
	}

	function move(index: number, delta: -1 | 1) {
		setRows((current) => {
			const target = index + delta
			if (target < 0 || target >= current.length) return current
			const next = [...current]
			const [row] = next.splice(index, 1)
			if (row) next.splice(target, 0, row)
			return next
		})
		setSaveError(false)
	}

	function remove(key: string) {
		if (rows.length <= 1) return
		const next = rows.filter((row) => row.key !== key)
		setRows(next)
		if (defaultKey === key) setDefaultKey(next[0]?.key ?? '')
		setSaveError(false)
	}

	async function save(event: FormEvent) {
		event.preventDefault()
		if (inflight.current || !dirty || !valid) return
		const body = {
			models: rows.map(toEntry),
			model: rows.find((row) => row.key === defaultKey)?.id.trim() ?? null,
			...(defaultKey === initial.defaultOf ? {} : { effort: null }),
			maxInputTokens: Number(maxInput.replace(/[^\d]/g, '')),
			maxOutputTokens: Number(maxOutput.replace(/[^\d]/g, '')),
		}
		if (!saveAssistantSettingsRequest.safeParse(body).success) {
			setSaveError(true)
			return
		}
		inflight.current = true
		setSaving(true)
		setSaveError(false)
		try {
			const result = await apiRequest<AssistantSettingsResponse>('PATCH', '/settings/assistant', body)
			if (!result.ok) {
				setSaveError(true)
				return
			}
			onSaved(result.data)
		} finally {
			inflight.current = false
			setSaving(false)
		}
	}

	const status = saving ? (
		<p className="flex items-center gap-2 text-caption text-muted-foreground">
			<LoaderCircle size={14} className="animate-spin" aria-hidden />
			Saving…
		</p>
	) : saveError ? (
		<p role="alert" className="text-caption text-destructive">
			{SAVE_ERROR}
		</p>
	) : (
		<p className="text-caption text-muted-foreground">{dirty ? 'Unsaved changes' : 'Saved to your account.'}</p>
	)

	return (
		<Panel
			id="settings-models"
			title="Models and limits"
			description="The models the assistant may use, in the order of the chat menu, and what a request may cost."
		>
			<form
				className="flex flex-col gap-4 px-4 pt-1 pb-4"
				aria-busy={saving}
				onSubmit={(event) => void save(event)}
				noValidate
			>
				<ul className="flex flex-col gap-3" data-slot="model-list">
					{rows.map((row, index) => (
						<ModelRow
							key={row.key}
							draft={row}
							place={index + 1}
							first={index === 0}
							last={index === rows.length - 1}
							only={rows.length <= 1}
							isDefault={row.key === defaultKey}
							unavailable={capabilities.find((item) => item.id === row.id)?.available === false}
							errors={allErrors[index] ?? {}}
							onChange={(change) => update(row.key, change)}
							onMove={(delta) => move(index, delta)}
							onDefault={() => setDefaultKey(row.key)}
							onRemove={() => remove(row.key)}
						/>
					))}
				</ul>
				{rows.length <= 1 ? (
					<p className="text-caption text-muted-foreground">
						At least one model is needed, so the last one cannot be removed.
					</p>
				) : null}
				<div>
					<Button
						type="button"
						variant="tertiary"
						size="compact"
						leadingIcon={Plus}
						disabled={rows.length >= CHAT_MODELS_MAX}
						onClick={() => {
							setRows((current) => [...current, emptyDraft()])
							setSaveError(false)
						}}
					>
						Add model
					</Button>
				</div>
				<div className="flex flex-col gap-3 border-t border-border pt-3">
					<LimitRow
						id="settings-max-input"
						label="Max input tokens"
						hint="The largest request the assistant will send."
						value={maxInput}
						error={inputError}
						onChange={setMaxInput}
					/>
					<LimitRow
						id="settings-max-output"
						label="Max output tokens"
						hint="The longest answer it may write."
						value={maxOutput}
						error={outputError}
						onChange={setMaxOutput}
					/>
				</div>
				<p className="text-caption text-muted-foreground">
					Prices come from Anthropic&apos;s published price list, as of 12 Oct 2026. Change them here if the list
					changes.
				</p>
				<div className="flex items-center justify-between gap-3">
					{status}
					<Button type="submit" size="compact" disabled={!dirty || !valid || saving}>
						Save
					</Button>
				</div>
			</form>
		</Panel>
	)
}

function LimitRow({
	id,
	label,
	hint,
	value,
	error,
	onChange,
}: {
	id: string
	label: string
	hint: string
	value: string
	error: string | null
	onChange: (value: string) => void
}) {
	const digits = value.replace(/[^\d]/g, '')
	const shown = digits === '' ? '' : NUMBER_FORMAT.format(Number(digits))
	return (
		<div className="flex flex-col gap-1">
			<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<label htmlFor={id} className="text-body text-foreground">
						{label}
					</label>
					<p id={`${id}-hint`} className="text-caption text-muted-foreground">
						{hint}
					</p>
				</div>
				<Input
					id={id}
					inputMode="numeric"
					autoComplete="off"
					value={shown}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? `${id}-error` : `${id}-hint`}
					className="h-8 w-full text-right tabular-nums md:w-35 md:shrink-0"
					onChange={(event) => onChange(event.target.value)}
				/>
			</div>
			{error ? (
				<p id={`${id}-error`} className="text-caption text-destructive">
					{error}
				</p>
			) : null}
		</div>
	)
}
