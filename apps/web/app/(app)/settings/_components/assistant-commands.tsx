'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { LoaderCircle, Plus, RefreshCw, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Panel } from '@/components/app/layout-parts'
import { ReloadNotice } from '@/components/app/reload-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, peekApi } from '@/lib/api-client'

import {
	CHAT_COMMAND_BLOCKS_MAX,
	CHAT_COMMAND_BLOCK_NAME_MAX,
	CHAT_COMMAND_DESCRIPTION_MAX,
	CHAT_COMMAND_NAME,
	CHAT_PROMPT_MAX_LENGTH,
	type CommandLimits,
	type CommandLimitsResponse,
	type CommandResponse,
	type CommandsResponse,
	type StoredCommand,
} from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'

type LoadState = 'loading' | 'ready' | 'failed'
type Format = 'text' | 'list'
type DraftBlock = { name: string; format: Format; template: string }
type Draft = {
	id: string | null
	revision: number
	name: string
	description: string
	prompt: string
	student: boolean
	tools: string[]
	blocks: DraftBlock[]
	status: 'active' | 'archived'
}

const TITLE = 'Commands'
const DESCRIPTION = 'Your own slash commands for the chat.'
const NOTE =
	'A command asks the assistant with your prompt, lets it read the chosen data, and answers in the blocks you describe. Each block has a Copy button.'
const SAVE_ERROR = 'Could not save the command. Try again.'
const CONFLICT_TEXT = 'This command changed elsewhere. Your edits have been kept. Reload it before saving.'
const FORMATS: { value: Format; label: string }[] = [
	{ value: 'text', label: 'Text' },
	{ value: 'list', label: 'List' },
]
const ERROR_TEXT: Record<string, string> = {
	name_taken: 'A command with this name already exists.',
	name_reserved: 'This name belongs to a built-in command.',
	too_many_tools: 'The chosen tools and blocks do not fit into one request. Remove some.',
	tool_not_allowed: 'One of the tools cannot be used in a command.',
}

const codePoints = (text: string) => [...text.trim()].length

function emptyDraft(): Draft {
	return {
		id: null,
		revision: 0,
		name: '/',
		description: '',
		prompt: '',
		student: false,
		tools: [],
		blocks: [],
		status: 'active',
	}
}

function toDraft(command: StoredCommand): Draft {
	return {
		id: command.id,
		revision: command.revision,
		name: command.name,
		description: command.description,
		prompt: command.prompt,
		student: command.student,
		tools: command.tools,
		blocks: command.blocks.map(({ name, format, template }) => ({ name, format, template })),
		status: command.status,
	}
}

function useCommands() {
	const router = useRouter()
	const [data, setData] = useState<CommandsResponse | null>(() => {
		const cached = peekApi<CommandsResponse>('/settings/assistant/commands')
		return cached !== null && cached.ok ? cached.data : null
	})
	const [loadState, setLoadState] = useState<LoadState>(() => (data === null ? 'loading' : 'ready'))
	const [attempt, setAttempt] = useState(0)

	useEffect(() => {
		let current = true
		void apiRequest<CommandsResponse>('GET', '/settings/assistant/commands').then((result) => {
			if (!current) return
			if (!result.ok) {
				if (result.status === 401 || result.status === 403)
					router.replace(result.status === 401 ? '/login?reason=expired' : '/')
				setLoadState('failed')
				return
			}
			setData(result.data)
			setLoadState('ready')
		})
		return () => {
			current = false
		}
	}, [attempt, router])

	const refresh = useCallback(() => {
		setLoadState('loading')
		setAttempt((value) => value + 1)
	}, [])

	const upsert = useCallback((next: StoredCommand) => {
		setData((current) => {
			if (current === null) return current
			const exists = current.commands.some((item) => item.id === next.id)
			const commands = exists
				? current.commands.map((item) => (item.id === next.id ? next : item))
				: [...current.commands, next]
			return { ...current, commands }
		})
	}, [])

	return { data, loadState, refresh, upsert }
}

function limitsLine(limits: CommandLimits | null, max: CommandLimits): string {
	if (limits === null) return ''
	return `Request size: ${limits.strict} of ${max.strict} strict, ${limits.optional} of ${max.optional} optional, ${limits.union} of ${max.union} union.`
}

function Editor({
	command,
	allowedTools,
	max,
	onSaved,
	onClose,
}: {
	command: StoredCommand | null
	allowedTools: CommandsResponse['allowedTools']
	max: CommandLimits
	onSaved: (next: StoredCommand) => void
	onClose: () => void
}) {
	const toast = useToast()
	const [draft, setDraft] = useState<Draft>(() => (command === null ? emptyDraft() : toDraft(command)))
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [conflict, setConflict] = useState(false)
	const [reloading, setReloading] = useState(false)
	const [limits, setLimits] = useState<CommandLimits | null>(command?.limits ?? null)
	const inflight = useRef(false)
	const creating = draft.id === null
	const archived = draft.status === 'archived'

	const nameValid = !creating || CHAT_COMMAND_NAME.test(draft.name)
	const descriptionLength = codePoints(draft.description)
	const promptLength = codePoints(draft.prompt)
	const blocksValid = draft.blocks.every(
		(block) => codePoints(block.name) >= 1 && codePoints(block.name) <= CHAT_COMMAND_BLOCK_NAME_MAX
	)
	const valid =
		nameValid &&
		descriptionLength >= 1 &&
		descriptionLength <= CHAT_COMMAND_DESCRIPTION_MAX &&
		promptLength >= 1 &&
		promptLength <= CHAT_PROMPT_MAX_LENGTH &&
		blocksValid

	const toolsKey = draft.tools.join(',')
	const blocksKey = JSON.stringify(draft.blocks)
	useEffect(() => {
		let current = true
		const timer = window.setTimeout(() => {
			void apiRequest<CommandLimitsResponse>('POST', '/settings/assistant/commands/limits', {
				tools: toolsKey === '' ? [] : toolsKey.split(','),
				blocks: JSON.parse(blocksKey) as DraftBlock[],
			}).then((result) => {
				if (current && result.ok) setLimits(result.data.limits)
			})
		}, 300)
		return () => {
			current = false
			window.clearTimeout(timer)
		}
	}, [toolsKey, blocksKey])

	function patch(next: Partial<Draft>) {
		setDraft((current) => ({ ...current, ...next }))
		setError(null)
	}

	function patchBlock(index: number, next: Partial<DraftBlock>) {
		patch({ blocks: draft.blocks.map((block, at) => (at === index ? { ...block, ...next } : block)) })
	}

	function toggleTool(name: string) {
		patch({ tools: draft.tools.includes(name) ? draft.tools.filter((tool) => tool !== name) : [...draft.tools, name] })
	}

	async function save() {
		if (inflight.current || !valid || conflict) return
		inflight.current = true
		setSaving(true)
		setError(null)
		try {
			const fields = {
				description: draft.description,
				prompt: draft.prompt,
				student: draft.student,
				tools: draft.tools,
				blocks: draft.blocks,
			}
			const result = creating
				? await apiRequest<CommandResponse>('POST', '/settings/assistant/commands', { name: draft.name, ...fields })
				: await apiRequest<CommandResponse>('PUT', `/settings/assistant/commands/${draft.id}`, {
						...fields,
						expectedRevision: draft.revision,
					})
			if (!result.ok) {
				if (result.error?.code === 'precondition_failed') setConflict(true)
				else setError((result.error && ERROR_TEXT[result.error.code]) ?? SAVE_ERROR)
				return
			}
			onSaved(result.data.command)
			toast.show({ title: 'Saved', description: `${result.data.command.name} saved.` })
			onClose()
		} finally {
			inflight.current = false
			setSaving(false)
		}
	}

	async function changeStatus(action: 'archive' | 'restore') {
		if (inflight.current || draft.id === null) return
		inflight.current = true
		setSaving(true)
		setError(null)
		try {
			const result = await apiRequest<CommandResponse>('POST', `/settings/assistant/commands/${draft.id}/${action}`, {
				expectedRevision: draft.revision,
			})
			if (!result.ok) {
				if (result.error?.code === 'precondition_failed') setConflict(true)
				else setError(SAVE_ERROR)
				return
			}
			onSaved(result.data.command)
			toast.show({
				title: action === 'archive' ? 'Archived' : 'Restored',
				description: `${result.data.command.name} ${action === 'archive' ? 'archived' : 'restored'}.`,
			})
			onClose()
		} finally {
			inflight.current = false
			setSaving(false)
		}
	}

	async function reload() {
		if (reloading || draft.id === null) return
		setReloading(true)
		try {
			const result = await apiRequest<CommandsResponse>('GET', '/settings/assistant/commands')
			const fresh = result.ok ? result.data.commands.find((item) => item.id === draft.id) : undefined
			if (!fresh) {
				setError(SAVE_ERROR)
				return
			}
			onSaved(fresh)
			setDraft(toDraft(fresh))
			setLimits(fresh.limits)
			setConflict(false)
			setError(null)
		} finally {
			setReloading(false)
		}
	}

	const readOnly = saving || archived

	return (
		<div className="flex flex-col gap-4" data-slot="command-editor">
			<div className="flex flex-col gap-1">
				<label htmlFor="command-name" className="text-body text-foreground">
					Name
				</label>
				<Input
					id="command-name"
					value={draft.name}
					readOnly={!creating || saving}
					autoComplete="off"
					aria-invalid={creating && !nameValid ? true : undefined}
					className="h-8 font-mono"
					onChange={(event) => patch({ name: event.target.value.toLowerCase() })}
				/>
				<p className="text-caption text-muted-foreground">
					{creating
						? 'Starts with a slash: lowercase letters, digits, - and _. Cannot be changed later.'
						: 'The name cannot be changed. Archive the command and create a new one instead.'}
				</p>
			</div>
			<div className="flex flex-col gap-1">
				<label htmlFor="command-description" className="text-body text-foreground">
					Description
				</label>
				<Input
					id="command-description"
					value={draft.description}
					readOnly={readOnly}
					autoComplete="off"
					className="h-8"
					onChange={(event) => patch({ description: event.target.value })}
				/>
				<p className="text-caption text-muted-foreground tabular-nums">
					{`Shown in the slash menu. ${descriptionLength} / ${CHAT_COMMAND_DESCRIPTION_MAX}`}
				</p>
			</div>
			<div className="flex flex-col gap-1">
				<label htmlFor="command-prompt" className="text-body text-foreground">
					Prompt
				</label>
				<Textarea
					id="command-prompt"
					value={draft.prompt}
					readOnly={readOnly}
					className="max-h-80 min-h-33 overflow-y-auto"
					onChange={(event) => patch({ prompt: event.target.value })}
				/>
				<p
					className={`text-caption tabular-nums ${promptLength > CHAT_PROMPT_MAX_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}
				>
					{`${promptLength.toLocaleString('en-US')} / ${CHAT_PROMPT_MAX_LENGTH.toLocaleString('en-US')}`}
				</p>
			</div>
			<div className="flex items-center justify-between gap-3">
				<span className="text-body text-foreground">Needs a student</span>
				<Switch
					label="Needs a student"
					size="compact"
					checked={draft.student}
					disabled={readOnly}
					onToggle={() => patch({ student: !draft.student })}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<span className="text-body text-foreground">Data the assistant can use</span>
				{allowedTools.map((tool) => (
					<div key={tool.name} className="flex items-center justify-between gap-3">
						<span className="min-w-0 truncate font-mono text-caption text-foreground">
							{tool.name}
							<span className="ml-2 font-sans text-muted-foreground">{tool.effect === 'show' ? 'Shows' : 'Reads'}</span>
						</span>
						<Switch
							label={tool.name}
							size="compact"
							checked={draft.tools.includes(tool.name)}
							disabled={readOnly}
							onToggle={() => toggleTool(tool.name)}
						/>
					</div>
				))}
			</div>
			<div className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-2">
					<span className="text-body text-foreground">Answer blocks</span>
					<Button
						type="button"
						variant="secondary"
						size="compact"
						leadingIcon={Plus}
						disabled={readOnly || draft.blocks.length >= CHAT_COMMAND_BLOCKS_MAX}
						onClick={() => patch({ blocks: [...draft.blocks, { name: '', format: 'text', template: '' }] })}
					>
						Add block
					</Button>
				</div>
				{draft.blocks.length === 0 ? (
					<p className="text-caption text-muted-foreground">Without blocks the assistant answers in free form.</p>
				) : null}
				{draft.blocks.map((block, index) => (
					<div key={index} className="flex flex-col gap-2 rounded-lg bg-hover p-3" data-slot="command-block-editor">
						<div className="flex items-center gap-2">
							<Input
								aria-label={`Block ${index + 1} name`}
								value={block.name}
								readOnly={readOnly}
								placeholder="Block name"
								autoComplete="off"
								className="h-8 min-w-0 flex-1"
								onChange={(event) => patchBlock(index, { name: event.target.value })}
							/>
							<Select
								value={block.format}
								onValueChange={(value) => patchBlock(index, { format: value === 'list' ? 'list' : 'text' })}
								disabled={readOnly}
							>
								<SelectTrigger aria-label={`Block ${index + 1} format`} className="w-28 shrink-0" />
								<SelectContent>
									{FORMATS.map((item, at) => (
										<SelectItem key={item.value} index={at} value={item.value}>
											{item.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								type="button"
								variant="secondary"
								size="icon-compact"
								aria-label={`Remove block ${index + 1}`}
								disabled={readOnly}
								onClick={() => patch({ blocks: draft.blocks.filter((_, at) => at !== index) })}
							>
								<X />
							</Button>
						</div>
						<Textarea
							aria-label={`Block ${index + 1} template`}
							value={block.template}
							readOnly={readOnly}
							placeholder="What this block should contain"
							className="max-h-60 min-h-20 overflow-y-auto"
							onChange={(event) => patchBlock(index, { template: event.target.value })}
						/>
					</div>
				))}
			</div>
			{limits !== null ? <p className="text-caption text-muted-foreground">{limitsLine(limits, max)}</p> : null}
			{conflict ? (
				<ReloadNotice
					status="warning"
					text={CONFLICT_TEXT}
					reloadLabel="Reload command"
					pending={reloading}
					onReload={() => void reload()}
				/>
			) : null}
			<div className="flex flex-wrap items-center justify-between gap-2">
				{saving ? (
					<p className="flex items-center gap-2 text-caption text-muted-foreground">
						<LoaderCircle size={14} className="animate-spin" aria-hidden />
						Saving…
					</p>
				) : error ? (
					<p role="alert" className="text-caption text-destructive">
						{error}
					</p>
				) : (
					<span />
				)}
				<div className="flex shrink-0 gap-2">
					{creating ? null : (
						<Button
							type="button"
							variant="secondary"
							size="compact"
							disabled={saving}
							onClick={() => void changeStatus(archived ? 'restore' : 'archive')}
						>
							{archived ? 'Restore' : 'Archive'}
						</Button>
					)}
					<Button type="button" variant="secondary" size="compact" disabled={saving} onClick={onClose}>
						Cancel
					</Button>
					<Button
						type="button"
						size="compact"
						disabled={saving || archived || !valid || conflict}
						onClick={() => void save()}
					>
						Save
					</Button>
				</div>
			</div>
		</div>
	)
}

export function CommandsCard() {
	const { data, loadState, refresh, upsert } = useCommands()
	const [editing, setEditing] = useState<string | 'new' | null>(null)

	if (data === null && loadState === 'loading')
		return (
			<Panel id="settings-commands" title={TITLE} description={DESCRIPTION}>
				<div role="status" aria-label="Loading commands" className="flex flex-col gap-3 px-4 pt-1 pb-4">
					<Skeleton className="h-4 w-3/5" />
					<Skeleton className="h-4 w-2/5" />
				</div>
			</Panel>
		)

	if (data === null || loadState === 'failed')
		return (
			<Panel id="settings-commands" title={TITLE} description={DESCRIPTION}>
				<div className="flex flex-col items-start gap-2 px-4 pt-1 pb-4">
					<p role="alert" className="text-caption text-destructive">
						Could not read the commands.
					</p>
					<Button type="button" variant="secondary" size="compact" leadingIcon={RefreshCw} onClick={refresh}>
						Refresh
					</Button>
				</div>
			</Panel>
		)

	const current = editing === null || editing === 'new' ? null : data.commands.find((item) => item.id === editing)

	return (
		<Panel id="settings-commands" title={TITLE} description={DESCRIPTION}>
			<div className="flex flex-col gap-4 px-4 pt-1 pb-4" data-commands-state="ready">
				<p className="text-caption text-muted-foreground">{NOTE}</p>
				{editing !== null && (editing === 'new' || current) ? (
					<Editor
						key={editing}
						command={current ?? null}
						allowedTools={data.allowedTools}
						max={data.limits}
						onSaved={upsert}
						onClose={() => setEditing(null)}
					/>
				) : (
					<>
						{data.commands.length === 0 ? (
							<p className="text-caption text-muted-foreground">No commands yet.</p>
						) : (
							<ul className="flex flex-col gap-2">
								{data.commands.map((command) => (
									<li key={command.id} className="flex items-center gap-3" data-slot="command-row">
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<span className="font-mono font-semibold text-foreground">{command.name}</span>
												{command.status === 'archived' ? (
													<Badge size="compact" style={{ backgroundColor: 'var(--hover)' }}>
														Archived
													</Badge>
												) : null}
											</div>
											<p className="truncate text-caption text-muted-foreground">{command.description}</p>
										</div>
										<Button type="button" variant="secondary" size="compact" onClick={() => setEditing(command.id)}>
											Edit
										</Button>
									</li>
								))}
							</ul>
						)}
						<div>
							<Button type="button" size="compact" leadingIcon={Plus} onClick={() => setEditing('new')}>
								New command
							</Button>
						</div>
					</>
				)}
			</div>
		</Panel>
	)
}
