'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Info, LoaderCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Panel } from '@/components/app/layout-parts'
import { ReloadNotice } from '@/components/app/reload-notice'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { apiRequest, peekApi } from '@/lib/api-client'

import {
	CHAT_PROMPT_MAX_LENGTH,
	type ChatPromptCommand,
	type CommandPrompt,
	type CommandPromptResponse,
	type CommandPromptsResponse,
} from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'

type LoadState = 'loading' | 'ready' | 'failed'

const PROMPTS_TITLE = 'Command prompts'
const PROMPTS_DESCRIPTION = 'The instructions behind /recap and /essay in the chat.'
const PROMPTS_NOTE =
	'Only the wording is edited here. What each command does, such as reading the essay or the layout of the feedback, is part of the app.'
const SAVE_ERROR = 'Could not save the prompt. Try again.'
const EMPTY_ERROR = 'The prompt cannot be empty.'
const CONFLICT_TEXT = 'This prompt changed elsewhere. Your text has been kept. Reload the saved prompt before saving.'
const PRIVACY_TEXT =
	'The assistant reads the titles of your Google Calendar events for the range you ask about and sends them to the model provider with your question.'
const LIMIT_TEXT = CHAT_PROMPT_MAX_LENGTH.toLocaleString('en-US')
const COMMANDS: ChatPromptCommand[] = ['/recap', '/essay']

const ABOUT: Record<ChatPromptCommand, string> = {
	'/recap': "Summarises a student's lessons for a period, for the teacher.",
	'/essay': 'Reviews an IELTS essay: four criteria, overall band, what to improve.',
}

const codePoints = (text: string) => [...text.trim()].length

function slug(command: ChatPromptCommand): string {
	return command.slice(1)
}

function usePrompts() {
	const router = useRouter()
	const [prompts, setPrompts] = useState<CommandPrompt[] | null>(() => {
		const cached = peekApi<CommandPromptsResponse>('/settings/assistant/prompts')
		return cached !== null && cached.ok ? cached.data.prompts : null
	})
	const [loadState, setLoadState] = useState<LoadState>(() => (prompts === null ? 'loading' : 'ready'))
	const [attempt, setAttempt] = useState(0)

	useEffect(() => {
		let current = true
		void apiRequest<CommandPromptsResponse>('GET', '/settings/assistant/prompts').then((result) => {
			if (!current) return
			if (!result.ok) {
				if (result.status === 401 || result.status === 403)
					router.replace(result.status === 401 ? '/login?reason=expired' : '/')
				setLoadState('failed')
				return
			}
			setPrompts(result.data.prompts)
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

	const replace = useCallback((next: CommandPrompt) => {
		setPrompts((current) =>
			current === null ? current : current.map((item) => (item.command === next.command ? next : item))
		)
	}, [])

	return { prompts, loadState, refresh, replace }
}

function PromptBlock({ prompt, onSaved }: { prompt: CommandPrompt; onSaved: (next: CommandPrompt) => void }) {
	const toast = useToast()
	const [draft, setDraft] = useState<string | null>(null)
	const [restored, setRestored] = useState(false)
	const [saving, setSaving] = useState(false)
	const [saveError, setSaveError] = useState(false)
	const [conflict, setConflict] = useState(false)
	const [reloading, setReloading] = useState(false)
	const inflight = useRef(false)
	const nameId = `settings-prompt-${slug(prompt.command)}-name`
	const fieldId = `settings-prompt-${slug(prompt.command)}`
	const statusId = `${fieldId}-status`

	const text = draft ?? prompt.body
	const length = codePoints(text)
	const edited = draft !== null && draft !== prompt.body
	const empty = edited && length === 0
	const over = length - CHAT_PROMPT_MAX_LENGTH
	const tooLong = over > 0
	const atDefault = text.trim() === prompt.defaultBody.trim()
	const invalid = empty || tooLong
	const badge = edited ? 'Edited' : prompt.isDefault ? 'Default' : 'Customised'

	useEffect(() => {
		if (!edited) return
		const guard = (event: BeforeUnloadEvent) => event.preventDefault()
		window.addEventListener('beforeunload', guard)
		return () => window.removeEventListener('beforeunload', guard)
	}, [edited])

	function change(value: string) {
		setDraft(value)
		setRestored(false)
		setSaveError(false)
	}

	function discard() {
		setDraft(null)
		setRestored(false)
		setSaveError(false)
	}

	function restoreDefault() {
		setDraft(prompt.defaultBody)
		setRestored(true)
		setSaveError(false)
	}

	async function save() {
		if (inflight.current || !edited || invalid || conflict) return
		inflight.current = true
		setSaving(true)
		setSaveError(false)
		try {
			const body = text.trim() === prompt.defaultBody.trim() ? null : text
			const result = await apiRequest<CommandPromptResponse>(
				'PUT',
				`/settings/assistant/prompts/${slug(prompt.command)}`,
				{
					body,
					expectedRevision: prompt.revision,
				}
			)
			if (!result.ok) {
				if (result.status === 409) setConflict(true)
				else setSaveError(true)
				return
			}
			onSaved(result.data.prompt)
			setDraft(null)
			setRestored(false)
			toast.show({ title: 'Saved', description: `${prompt.command} prompt saved.` })
		} finally {
			inflight.current = false
			setSaving(false)
		}
	}

	async function reload() {
		if (reloading) return
		setReloading(true)
		try {
			const result = await apiRequest<CommandPromptsResponse>('GET', '/settings/assistant/prompts')
			const fresh = result.ok ? result.data.prompts.find((item) => item.command === prompt.command) : undefined
			if (!fresh) {
				setSaveError(true)
				return
			}
			onSaved(fresh)
			setDraft(null)
			setRestored(false)
			setSaveError(false)
			setConflict(false)
		} finally {
			setReloading(false)
		}
	}

	const status = saving ? (
		<p id={statusId} className="flex items-center gap-2 text-caption text-muted-foreground">
			<LoaderCircle size={14} className="animate-spin" aria-hidden />
			Saving…
		</p>
	) : saveError ? (
		<p id={statusId} role="alert" className="text-caption text-destructive">
			{SAVE_ERROR}
		</p>
	) : empty ? (
		<p id={statusId} role="alert" className="text-caption text-destructive">
			{EMPTY_ERROR}
		</p>
	) : tooLong ? (
		<p id={statusId} role="alert" className="text-caption text-destructive">
			{`The prompt is ${over.toLocaleString('en-US')} ${over === 1 ? 'character' : 'characters'} over the ${LIMIT_TEXT} limit.`}
		</p>
	) : (
		<p id={statusId} className="text-caption text-muted-foreground">
			{restored && edited
				? 'Default text restored. Save to use it.'
				: edited
					? 'Unsaved changes'
					: 'Saved to your account.'}
		</p>
	)

	return (
		<div className="flex flex-col gap-2" data-slot="command-prompt" data-command={prompt.command} data-badge={badge}>
			<div className="flex items-center gap-2">
				<span id={nameId} className="font-mono font-semibold text-foreground">
					{prompt.command}
				</span>
				<Badge size="compact" style={{ backgroundColor: badge === 'Default' ? 'var(--hover)' : 'var(--active)' }}>
					{badge}
				</Badge>
			</div>
			<p className="text-caption text-muted-foreground">{ABOUT[prompt.command]}</p>
			<Textarea
				id={fieldId}
				value={text}
				readOnly={saving}
				aria-labelledby={nameId}
				aria-describedby={statusId}
				aria-invalid={invalid ? true : undefined}
				placeholder={`Write the instructions for ${prompt.command}.`}
				className={`max-h-80 min-h-42 overflow-y-auto sm:min-h-33 ${saving ? 'opacity-50' : ''}`}
				onChange={(event) => change(event.target.value)}
			/>
			{conflict ? (
				<ReloadNotice
					status="warning"
					text={CONFLICT_TEXT}
					reloadLabel="Reload prompt"
					pending={reloading}
					onReload={() => void reload()}
				/>
			) : null}
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-3">
					{status}
					<span
						className={`text-caption tabular-nums ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}
						data-slot="prompt-counter"
					>
						{`${length.toLocaleString('en-US')} / ${LIMIT_TEXT}`}
					</span>
				</div>
				<div className="flex shrink-0 gap-2">
					<Button
						type="button"
						variant="secondary"
						size="compact"
						disabled={saving || atDefault}
						onClick={restoreDefault}
					>
						Restore default
					</Button>
					<Button type="button" variant="secondary" size="compact" disabled={saving || !edited} onClick={discard}>
						Discard
					</Button>
					<Button
						type="button"
						size="compact"
						disabled={saving || !edited || invalid || conflict}
						onClick={() => void save()}
					>
						{saving ? (
							<>
								<LoaderCircle size={14} className="animate-spin" aria-hidden />
								Saving…
							</>
						) : (
							'Save'
						)}
					</Button>
				</div>
			</div>
		</div>
	)
}

function Divider() {
	return <div className="h-px bg-border" aria-hidden />
}

export function PromptsLoading() {
	return (
		<Panel id="settings-command-prompts" title={PROMPTS_TITLE} description={PROMPTS_DESCRIPTION}>
			<div role="status" aria-label="Loading command prompts" className="flex flex-col gap-4 px-4 pt-1 pb-4">
				<p className="text-caption text-muted-foreground">{PROMPTS_NOTE}</p>
				{COMMANDS.map((command, index) => (
					<div key={command} className="flex flex-col gap-4">
						{index > 0 ? <Divider /> : null}
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<span className="font-mono font-semibold text-foreground">{command}</span>
								<Skeleton className="h-4.5 w-14 rounded-full" />
							</div>
							<p className="text-caption text-muted-foreground">{ABOUT[command]}</p>
							<div className="flex min-h-42 flex-col gap-2 rounded-md p-3 ring-1 ring-input ring-inset sm:min-h-33">
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-3 w-11/12" />
								<Skeleton className="h-3 w-3/5" />
							</div>
							<div className="flex items-center justify-between gap-2">
								<Skeleton className="h-3 w-30" />
								<Button type="button" size="compact" disabled>
									Save
								</Button>
							</div>
						</div>
					</div>
				))}
			</div>
		</Panel>
	)
}

export function CommandPromptsCard() {
	const { prompts, loadState, refresh, replace } = usePrompts()

	if (prompts === null && loadState === 'loading') return <PromptsLoading />

	if (prompts === null || loadState === 'failed')
		return (
			<Panel id="settings-command-prompts" title={PROMPTS_TITLE} description={PROMPTS_DESCRIPTION}>
				<div className="flex flex-col items-start gap-2 px-4 pt-1 pb-4" data-prompts-state="unavailable">
					<p role="alert" className="text-caption text-destructive">
						Could not read the prompts.
					</p>
					<Button type="button" variant="secondary" size="compact" leadingIcon={RefreshCw} onClick={refresh}>
						Refresh
					</Button>
				</div>
			</Panel>
		)

	return (
		<Panel id="settings-command-prompts" title={PROMPTS_TITLE} description={PROMPTS_DESCRIPTION}>
			<div className="flex flex-col gap-4 px-4 pt-1 pb-4" data-prompts-state="ready">
				<p className="text-caption text-muted-foreground">{PROMPTS_NOTE}</p>
				{prompts.map((prompt, index) => (
					<div key={prompt.command} className="flex flex-col gap-4">
						{index > 0 ? <Divider /> : null}
						<PromptBlock prompt={prompt} onSaved={replace} />
					</div>
				))}
			</div>
		</Panel>
	)
}

export function PrivacyCard() {
	return (
		<Panel id="settings-privacy" title="Privacy" description="What leaves the app when you use the assistant.">
			<div className="flex items-start gap-3 px-4 pt-1 pb-4">
				<Info size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />
				<p className="text-body text-foreground">{PRIVACY_TEXT}</p>
			</div>
		</Panel>
	)
}
