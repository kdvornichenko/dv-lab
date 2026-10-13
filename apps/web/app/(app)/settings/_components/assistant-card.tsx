'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import { Info, LoaderCircle, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { Panel } from '@/components/app/layout-parts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { apiRequest } from '@/lib/api-client'

import { saveAssistantSettingsRequest, type AssistantSettingsResponse } from '@dv-lab/contracts'

import { useToast } from '../../_components/toasts'

type LoadState = 'loading' | 'ready' | 'failed'

const FIELD = 'settings-monthly-limit'
const FIELD_ERROR = 'Enter a monthly budget above zero.'
const SAVE_ERROR = 'Could not save the setting. Try again.'

function toCents(text: string, roundUp: boolean): bigint {
	const [whole = '0', fraction = ''] = text.split('.')
	const rest = fraction.slice(2).replace(/0/g, '')
	return BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, '0')) + (roundUp && rest !== '' ? 1n : 0n)
}

function dollars(cents: bigint, short = false): string {
	const whole = cents / 100n
	const part = cents % 100n
	if (short && part === 0n) return `$${whole}`
	return `$${whole}.${part.toString().padStart(2, '0')}`
}

function validCap(text: string): string | null {
	const trimmed = text.trim()
	const parsed = saveAssistantSettingsRequest.safeParse({ monthlyCapUsd: trimmed })
	return parsed.success ? trimmed : null
}

function useAssistantSettings() {
	const router = useRouter()
	const [data, setData] = useState<AssistantSettingsResponse | null>(null)
	const [loadState, setLoadState] = useState<LoadState>('loading')
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

function BudgetSkeleton() {
	return (
		<div className="flex flex-col gap-3 px-4 pt-1 pb-4" role="status" aria-label="Loading budget">
			<Skeleton className="h-8 w-full" />
			<Skeleton className="h-3 w-65 max-w-full" />
			<Skeleton className="h-1.5 w-full" />
			<Skeleton className="h-3 w-50 max-w-full" />
		</div>
	)
}

function BudgetCard({ state }: { state: ReturnType<typeof useAssistantSettings> }) {
	const toast = useToast()
	const { data, setData, loadState, refresh } = state
	const [draft, setDraft] = useState<string | null>(null)
	const [saving, setSaving] = useState(false)
	const [saveError, setSaveError] = useState<string | null>(null)
	const [fieldError, setFieldError] = useState(false)
	const inflight = useRef(false)

	if (loadState === 'loading' && data === null)
		return (
			<Panel id="settings-budget" title="Budget" description={DESCRIPTION}>
				<BudgetSkeleton />
			</Panel>
		)

	if (loadState === 'failed' || data === null)
		return (
			<Panel id="settings-budget" title="Budget" description={DESCRIPTION}>
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
	const remaining = toCents(budget.remainingUsd, false)
	const shownCap = parsed === null ? null : toCents(parsed, false)
	const aboveLimit = shownCap !== null && spent + held > shownCap
	const percent = budget.state === 'reached' || cap === 0n ? 100n : (spent * 100n) / cap
	const fill = percent > 100n ? 100n : percent

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
		<Panel id="settings-budget" title="Budget" description={DESCRIPTION}>
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
				<div className="flex flex-col gap-2" data-budget-usage>
					<p className="text-body tabular-nums">
						Estimated usage this month: {dollars(spent)} of {dollars(cap, true)}.
					</p>
					<div className="h-1.5 overflow-hidden rounded-full bg-selected" aria-hidden>
						<div className="h-full bg-primary" style={{ width: `${fill}%` }} data-budget-fill={String(fill)} />
					</div>
					<p className="text-caption text-muted-foreground tabular-nums">
						Remaining estimate: {dollars(remaining)}.{held > 0n ? ` Reserved estimate: ${dollars(held)}.` : ''}
					</p>
					{budget.unknownAttempts > 0 ? (
						<p className="flex items-center gap-1.5 text-caption text-muted-foreground" data-budget-note="unconfirmed">
							<Info size={14} className="shrink-0" aria-hidden />
							Usage has not been confirmed.
						</p>
					) : null}
				</div>
				{usage.length > 0 ? (
					<div className="flex flex-col gap-2" data-budget-conversations>
						<p className="text-caption text-muted-foreground">Usage by conversation</p>
						<ul className="flex flex-col gap-2">
							{usage.map((row) => (
								<li key={row.conversationId} className="flex justify-between gap-4 text-body">
									<span className="min-w-0 truncate">{row.title}</span>
									<span className="shrink-0 tabular-nums">{dollars(toCents(row.costUsd, true))}</span>
								</li>
							))}
						</ul>
					</div>
				) : null}
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

const DESCRIPTION =
	'When the limit is reached the assistant stops answering until next month. Everything else keeps working.'

export function AssistantCard() {
	const state = useAssistantSettings()
	return (
		<div className="flex max-w-180 flex-col gap-4">
			<BudgetCard state={state} />
		</div>
	)
}
