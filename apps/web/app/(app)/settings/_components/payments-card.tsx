'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { Panel } from '@/components/app/layout-parts'
import { Banner, BannerTitle } from '@/components/ui/banner'
import { Input } from '@/components/ui/input'
import { apiRequest } from '@/lib/api-client'

import {
	PAYS_SOON_LESSONS_MAX,
	PAYS_SOON_LESSONS_MIN,
	updateSettingsRequest,
	type SettingsResponse,
} from '@dv-lab/contracts'
import { lessonsPhrase } from '@dv-lab/core'

import { useToast } from '../../_components/toasts'

const REVERT_DELAY_MS = 2000
const RANGE_ERROR = `Use a whole number from ${PAYS_SOON_LESSONS_MIN} to ${PAYS_SOON_LESSONS_MAX}.`

function parseThreshold(text: string) {
	if (text.trim() === '') return null
	const parsed = updateSettingsRequest.safeParse({ paysSoonLessons: Number(text) })
	return parsed.success ? (parsed.data.paysSoonLessons ?? null) : null
}

export function PaymentsCard({ value, onSaved }: { value: number | null; onSaved: (value: number) => void }) {
	const toast = useToast()
	const [draft, setDraft] = useState<string | null>(null)
	const text = draft ?? (value === null ? '' : String(value))
	const ready = value !== null
	const [error, setError] = useState<string | null>(null)
	const [saveFailed, setSaveFailed] = useState(false)
	const [saving, setSaving] = useState(false)
	const inflight = useRef(false)
	const revert = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		return () => {
			if (revert.current) clearTimeout(revert.current)
		}
	}, [])

	function cancelRevert() {
		if (revert.current) clearTimeout(revert.current)
		revert.current = null
	}

	function putBack() {
		setDraft(null)
		setError(null)
	}

	async function commit(leaving: boolean) {
		if (!ready || inflight.current) return
		const threshold = parseThreshold(text)
		if (threshold === null) {
			setError(RANGE_ERROR)
			if (leaving) {
				cancelRevert()
				revert.current = setTimeout(putBack, REVERT_DELAY_MS)
			}
			return
		}
		setError(null)
		if (threshold === value) return
		inflight.current = true
		setSaving(true)
		setSaveFailed(false)
		try {
			const result = await apiRequest<SettingsResponse>('PATCH', '/settings', { paysSoonLessons: threshold })
			if (!result.ok) {
				setSaveFailed(true)
				putBack()
				return
			}
			onSaved(result.data.settings.paysSoonLessons)
			setDraft(null)
			toast.show({
				title: 'Saved',
				description: `Pays soon threshold: ${lessonsPhrase(result.data.settings.paysSoonLessons, 1)}.`,
			})
		} finally {
			inflight.current = false
			setSaving(false)
		}
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key !== 'Enter') return
		event.preventDefault()
		void commit(false)
	}

	return (
		<Panel id="settings-payments" title="Payments" description="Decide when a student counts as paying soon.">
			{saveFailed ? (
				<div className="px-4 pt-2">
					<Banner status="error">
						<BannerTitle>Could not save the setting. Try again.</BannerTitle>
					</Banner>
				</div>
			) : null}
			<div className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between md:gap-4">
				<div className="flex min-w-0 flex-col gap-1">
					<label htmlFor="settings-pays-soon" className="text-body text-foreground">
						Pays soon threshold (lessons)
					</label>
					<p id="settings-pays-soon-hint" className="text-caption text-muted-foreground">
						Students with this many lessons left or fewer appear in Pays soon on Today.
					</p>
				</div>
				<Input
					id="settings-pays-soon"
					inputMode="numeric"
					autoComplete="off"
					value={text}
					disabled={!ready || saving}
					aria-busy={saving}
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? 'settings-pays-soon-error' : 'settings-pays-soon-hint'}
					className="w-24 shrink-0 text-right tabular-nums"
					onChange={(event) => {
						cancelRevert()
						setError(null)
						setDraft(event.target.value)
					}}
					onFocus={cancelRevert}
					onBlur={() => void commit(true)}
					onKeyDown={onKeyDown}
				/>
			</div>
			{error ? (
				<p id="settings-pays-soon-error" className="px-4 pt-1 pb-4 text-caption text-destructive">
					{error}
				</p>
			) : (
				<p className="px-4 pt-1 pb-4 text-caption text-muted-foreground">Saved to your account.</p>
			)}
		</Panel>
	)
}
