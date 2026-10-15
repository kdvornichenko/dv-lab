'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { Info, LoaderCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { EFFORT_LABEL, EffortSlider, clampEffort } from '@/components/app/effort-slider'
import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { apiRequest, peekApi } from '@/lib/api-client'
import { dollars, toCents } from '@/lib/usd-text'

import {
	CHAT_EFFORTS,
	saveAssistantSettingsRequest,
	type AssistantSettingsResponse,
	type ChatEffort,
} from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'
import { ModelsForm } from './assistant-models'
import { CommandPromptsCard, PrivacyCard } from './assistant-prompts'
import { BudgetUsage } from './budget-usage'
import {
	BUDGET_DESCRIPTION,
	BudgetLoading,
	CHAT_MODEL_DESCRIPTION,
	ChatModelLoading,
	ModelsLoading,
} from './settings-loading-parts'

type LoadState = 'loading' | 'ready' | 'failed'

const FIELD = 'settings-monthly-limit'
const FIELD_ERROR = 'Enter a monthly budget above zero.'
const SAVE_ERROR = 'Could not save the setting. Try again.'

function validCap(text: string): string | null {
	const trimmed = text.trim()
	const parsed = saveAssistantSettingsRequest.safeParse({ monthlyCapUsd: trimmed })
	return parsed.success ? trimmed : null
}

function useAssistantSettings() {
	const router = useRouter()
	const [data, setData] = useState<AssistantSettingsResponse | null>(() => {
		const cached = peekApi<AssistantSettingsResponse>('/settings/assistant')
		return cached !== null && cached.ok ? cached.data : null
	})
	const [loadState, setLoadState] = useState<LoadState>(() => (data === null ? 'loading' : 'ready'))
	const [attempt, setAttempt] = useState(0)

	useEffect(() => {
		let current = true
		void apiRequest<AssistantSettingsResponse>('GET', '/settings/assistant').then((result) => {
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

	return { data, setData, loadState, refresh }
}

function BudgetCard({ state }: { state: ReturnType<typeof useAssistantSettings> }) {
	const toast = useToast()
	const { data, setData, loadState, refresh } = state
	const [draft, setDraft] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)
	const [fieldError, setFieldError] = useState(false)
	const inflight = useRef(false)

	if (loadState === 'loading' && data === null) return <BudgetLoading />

	if (loadState === 'failed' || data === null)
		return (
			<Panel id="settings-budget" title="Budget" description={BUDGET_DESCRIPTION}>
				<div className="flex flex-col items-start gap-2 px-4 pt-1 pb-4" data-budget-state="unavailable">
					<p role="alert" className="text-caption text-destructive">
						Budget status unavailable. Refresh before sending.
					</p>
					<Button type="button" variant="tertiary" size="compact" leadingIcon={RefreshCw} onClick={refresh}>
						Refresh status
					</Button>
				</div>
			</Panel>
		)

	const { budget, usage, settings } = data
	const text = draft ?? settings.monthlyCapUsd
	const parsed = validCap(text)
	const invalid = fieldError || (draft !== null && parsed === null)
	const dirty = draft !== null && (parsed === null || toCents(parsed, false) !== toCents(settings.monthlyCapUsd, false))
	const cap = toCents(budget.capUsd, false)
	const spent = toCents(budget.spentUsd, true)
	const held = toCents(budget.heldUsd, true)
	const shownCap = parsed === null ? null : toCents(parsed, false)
	const aboveLimit = shownCap !== null && spent + held > shownCap

	async function save(event: FormEvent) {
		event.preventDefault()
		if (inflight.current || !dirty) return
		if (parsed === null) {
			setFieldError(true)
			return
		}
		inflight.current = true
		setSaving(true)
		setSaveError(null)
		try {
			const result = await apiRequest<AssistantSettingsResponse>('PATCH', '/settings/assistant', {
				monthlyCapUsd: parsed,
			})
			if (!result.ok) {
				if (result.status === 400) setFieldError(true)
				else setSaveError(SAVE_ERROR)
				return
			}
			setData(result.data)
			setDraft(null)
			toast.show({
				title: 'Saved',
				description: `Monthly limit: ${dollars(toCents(result.data.settings.monthlyCapUsd, false))}.`,
			})
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
			{saveError}
		</p>
	) : (
		<p className="text-caption text-muted-foreground">{dirty ? 'Unsaved changes' : 'Saved to your account.'}</p>
	)

	return (
		<Panel id="settings-budget" title="Budget" description={BUDGET_DESCRIPTION}>
			<form
				className="flex flex-col gap-4 px-4 pt-1 pb-4"
				data-budget-state={budget.state}
				aria-busy={saving || loadState === 'loading'}
				onSubmit={(event) => void save(event)}
				noValidate
			>
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
					<div className="flex min-w-0 flex-col gap-1">
						<label htmlFor={FIELD} className="text-body text-foreground">
							Monthly limit
						</label>
						<p id={`${FIELD}-hint`} className="text-caption text-muted-foreground">
							In US dollars. New installs start at $10.
						</p>
					</div>
					<div className="relative w-full md:w-30 md:shrink-0">
						<span
							aria-hidden
							className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-muted-foreground"
						>
							$
						</span>
						<Input
							id={FIELD}
							inputMode="decimal"
							autoComplete="off"
							value={text}
							disabled={saving}
							aria-invalid={invalid ? true : undefined}
							aria-describedby={invalid ? `${FIELD}-error` : `${FIELD}-hint`}
							className="h-8 pl-6 text-right tabular-nums"
							onChange={(event) => {
								setFieldError(false)
								setSaveError(null)
								setDraft(event.target.value)
							}}
						/>
					</div>
				</div>
				{invalid ? (
					<p id={`${FIELD}-error`} className="-mt-2 text-caption text-destructive">
						{FIELD_ERROR}
					</p>
				) : null}
				{aboveLimit && !invalid ? (
					<p
						className="-mt-2 flex items-start gap-1.5 text-caption text-muted-foreground"
						data-budget-note="above-limit"
					>
						<Info size={14} className="mt-0.5 shrink-0" aria-hidden />
						<span>
							This month&apos;s estimated usage is above the new limit. The assistant stays paused until next month.
						</span>
					</p>
				) : null}
				<BudgetUsage budget={budget} usage={usage} capCents={shownCap ?? cap} />
				<p className="text-caption text-muted-foreground">Costs count toward your monthly budget.</p>
				<div className="flex items-center justify-between gap-3">
					{status}
					<Button type="submit" size="compact" disabled={!dirty || invalid || saving}>
						Save
					</Button>
				</div>
			</form>
		</Panel>
	)
}

function ChatModelCard({ state }: { state: ReturnType<typeof useAssistantSettings> }) {
	const toast = useToast()
	const { data, setData, loadState, refresh } = state
	const [saving, setSaving] = useState(false)
	const [saveError, setSaveError] = useState(false)
	const [preview, setPreview] = useState<ChatEffort | null>(null)
	const inflight = useRef(false)

	if (loadState === 'loading' && data === null) return <ChatModelLoading />

	if (loadState === 'failed' || data === null)
		return (
			<Panel id="settings-chat-model" title="Chat model" description={CHAT_MODEL_DESCRIPTION}>
				<div className="flex flex-col items-start gap-2 px-4 pt-1 pb-4" data-chat-model-state="unavailable">
					<Select value="" disabled>
						<SelectTrigger placeholder="Models unavailable" className="w-65 max-w-full" aria-label="Model" />
						<SelectContent>
							<SelectItem index={0} value="none">
								None
							</SelectItem>
						</SelectContent>
					</Select>
					<p role="alert" className="text-caption text-destructive">
						Model settings are unavailable. Refresh before sending.
					</p>
					<Button type="button" variant="tertiary" size="compact" leadingIcon={RefreshCw} onClick={refresh}>
						Refresh
					</Button>
				</div>
			</Panel>
		)

	const { settings, capabilities } = data
	const modelId = settings.model ?? settings.models[0]?.id
	const capability = capabilities.find((item) => item.id === modelId)
	const effort: ChatEffort = settings.effort ?? capability?.defaultEffort ?? 'medium'

	async function save(body: { model: string; effort: ChatEffort }): Promise<boolean> {
		if (inflight.current) return false
		inflight.current = true
		setSaving(true)
		setSaveError(false)
		try {
			const result = await apiRequest<AssistantSettingsResponse>('PATCH', '/settings/assistant', body)
			if (!result.ok) {
				setSaveError(true)
				return false
			}
			setData(result.data)
			toast.show({
				title: 'Saved',
				description: `Chat model: ${capabilities.find((item) => item.id === body.model)?.name ?? body.model}, ${EFFORT_LABEL[body.effort].toLowerCase()} effort.`,
			})
			return true
		} finally {
			inflight.current = false
			setSaving(false)
		}
	}

	function chooseModel(id: string) {
		const next = capabilities.find((item) => item.id === id)
		if (!next || id === modelId) return
		void save({ model: id, effort: clampEffort(next.efforts, effort) })
	}

	return (
		<Panel id="settings-chat-model" title="Chat model" description={CHAT_MODEL_DESCRIPTION}>
			<div className="flex flex-col gap-4 px-4 pt-1 pb-4" aria-busy={saving} data-slot="chat-model-card">
				<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
					<div className="flex min-w-0 flex-col gap-1">
						<label htmlFor="settings-chat-model-select" className="text-body text-foreground">
							Model
						</label>
						<p className="text-caption text-muted-foreground">Used for every new chat</p>
					</div>
					<Select value={modelId ?? ''} onValueChange={chooseModel} disabled={saving}>
						<SelectTrigger id="settings-chat-model-select" className="w-full md:w-65 md:shrink-0" />
						<SelectContent>
							{capabilities.map((item, index) => (
								<SelectItem key={item.id} index={index} value={item.id} disabled={!item.available}>
									{item.available
										? `${item.name} · ${item.description}`
										: `${item.name} · Not available with your API key`}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
					<div className="flex min-w-0 flex-col gap-1">
						<span className="text-body text-foreground">
							Effort: {EFFORT_LABEL[capability ? (preview ?? effort) : effort]}
						</span>
						<p className="text-caption text-muted-foreground">
							Faster answers, or smarter ones that take longer and cost more
						</p>
					</div>
					<div className="w-full md:w-65 md:shrink-0">
						{capability ? (
							<EffortSlider
								value={effort}
								supported={capability.efforts}
								modelName={capability.name}
								marker="Recommended"
								markerAt={capability.recommendedEffort}
								label="Effort"
								commit="release"
								onPreview={setPreview}
								disabled={saving || !CHAT_EFFORTS.includes(effort)}
								onChange={(next) => (modelId === undefined ? false : save({ model: modelId, effort: next }))}
							/>
						) : null}
					</div>
				</div>
				{saveError ? (
					<p role="alert" className="text-caption text-destructive">
						{SAVE_ERROR}
					</p>
				) : (
					<p className="text-caption text-muted-foreground">
						Saved to your account. Each chat can change its own model and effort from its composer.
					</p>
				)}
			</div>
		</Panel>
	)
}

function ModelsCard({ state }: { state: ReturnType<typeof useAssistantSettings> }) {
	const { data, setData, loadState } = state
	if (data === null) {
		if (loadState === 'loading') return <ModelsLoading />
		return null
	}
	const { settings } = data
	const key = JSON.stringify([settings.models, settings.model, settings.maxInputTokens, settings.maxOutputTokens])
	return <ModelsForm key={key} data={data} onSaved={setData} />
}

export function AssistantCard() {
	const state = useAssistantSettings()
	return (
		<div className="flex max-w-180 flex-col gap-4">
			<ChatModelCard state={state} />
			<ModelsCard state={state} />
			<BudgetCard state={state} />
			<CommandPromptsCard />
			<PrivacyCard />
		</div>
	)
}
