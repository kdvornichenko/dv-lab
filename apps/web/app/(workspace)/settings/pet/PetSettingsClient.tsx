'use client'

import { useEffect, useRef, useState } from 'react'
import type { FC } from 'react'

import { Cat, Volume2, Zap } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { teacherCrmSettingsApi } from '@/lib/crm/api'
import { DEFAULT_PET_SETTINGS, setPetSettingsSnapshot } from '@/lib/pet/pet-settings-store'

import type { PetSettings } from '@teacher-crm/api-types'

const activityOptions = [
	{
		value: 'reduced',
		label: 'Reduced',
		description: 'Fewer walks and fewer jumps around the workspace.',
	},
	{
		value: 'normal',
		label: 'Normal',
		description: 'Balanced motion for daily CRM work.',
	},
	{
		value: 'playful',
		label: 'Playful',
		description: 'More frequent movement on marked workspace surfaces.',
	},
] as const satisfies readonly {
	value: PetSettings['activityLevel']
	label: string
	description: string
}[]

export const PetSettingsClient: FC = () => {
	const [settings, setSettings] = useState<PetSettings>(DEFAULT_PET_SETTINGS)
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const requestId = useRef(0)

	useEffect(() => {
		let mounted = true

		async function loadSettings() {
			try {
				const response = await teacherCrmSettingsApi.getPetSettings()
				if (!mounted) return
				setSettings(response.settings)
				setPetSettingsSnapshot(response.settings)
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Pet settings could not be loaded'
				toast.error('Pet settings unavailable', { description: message })
			} finally {
				if (mounted) setLoading(false)
			}
		}

		void loadSettings()

		return () => {
			mounted = false
		}
	}, [])

	async function saveSettings(nextSettings: PetSettings) {
		const previousSettings = settings
		const currentRequest = requestId.current + 1
		requestId.current = currentRequest
		setSettings(nextSettings)
		setSaving(true)

		try {
			const response = await teacherCrmSettingsApi.savePetSettings(nextSettings)
			if (requestId.current !== currentRequest) return
			setSettings(response.settings)
			setPetSettingsSnapshot(response.settings)
			toast.success('Pet settings saved')
		} catch (error) {
			if (requestId.current === currentRequest) setSettings(previousSettings)
			const message = error instanceof Error ? error.message : 'Pet settings were not saved'
			toast.error('Pet settings not saved', { description: message })
		} finally {
			if (requestId.current === currentRequest) setSaving(false)
		}
	}

	function updateSettings(patch: Partial<PetSettings>) {
		void saveSettings({ ...settings, ...patch })
	}

	if (loading) {
		return (
			<main className="p-unit min-h-full">
				<div className="grid w-full gap-5">
					<Skeleton className="bg-surface-muted h-36 rounded-lg" />
					<Skeleton className="bg-surface-muted h-64 rounded-lg" />
				</div>
			</main>
		)
	}

	const activeActivity = activityOptions.find((item) => item.value === settings.activityLevel) ?? activityOptions[1]

	return (
		<main className="p-unit min-h-full">
			<div className="grid w-full gap-5">
				<header className="border-line bg-surface rounded-lg border p-5 shadow-xl">
					<div className="text-sage flex items-center gap-2 text-sm font-semibold">
						<Cat className="h-4 w-4" />
						Workspace pet
					</div>
					<div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
						<div>
							<h1 className="text-ink text-2xl font-semibold">Pet settings</h1>
							<p className="text-ink-muted mt-2 max-w-2xl text-sm leading-6">
								Control the pet overlay for the workspace. Sound stays off until enabled here.
							</p>
						</div>
						<Badge tone={settings.enabled ? 'green' : 'neutral'}>{settings.enabled ? 'Enabled' : 'Hidden'}</Badge>
					</div>
				</header>

				<Card className="border-line bg-surface rounded-lg shadow-none">
					<CardHeader className="border-line-soft border-b">
						<CardTitle className="text-ink text-base">Overlay controls</CardTitle>
						<p className="text-ink-muted text-sm">Changes are saved to the authenticated CRM settings API.</p>
					</CardHeader>
					<CardContent className="grid gap-5 pt-5">
						<section className="border-line-soft grid gap-4 border-b pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
							<div className="flex gap-3">
								<span className="border-sage-line bg-sage-soft text-sage flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
									<Cat className="h-5 w-5" />
								</span>
								<div>
									<Label htmlFor="pet-enabled" className="text-ink font-semibold">
										Show pet
									</Label>
									<p className="text-ink-muted mt-1 text-sm leading-6">
										Show or hide the pet overlay inside the workspace.
									</p>
								</div>
							</div>
							<Switch
								id="pet-enabled"
								checked={settings.enabled}
								disabled={saving}
								onCheckedChange={(enabled) => updateSettings({ enabled })}
							/>
						</section>

						<section className="border-line-soft grid gap-4 border-b pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
							<div className="flex gap-3">
								<span className="border-line bg-surface-muted text-ink-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
									<Volume2 className="h-5 w-5" />
								</span>
								<div>
									<Label htmlFor="pet-sound" className="text-ink font-semibold">
										Sound
									</Label>
									<p className="text-ink-muted mt-1 text-sm leading-6">
										Keep the preference saved for future pet sounds. No audio plays by default.
									</p>
								</div>
							</div>
							<Switch
								id="pet-sound"
								checked={settings.soundEnabled}
								disabled={saving}
								onCheckedChange={(soundEnabled) => updateSettings({ soundEnabled })}
							/>
						</section>

						<section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_16rem] md:items-center">
							<div className="flex gap-3">
								<span className="border-sage-line bg-sage-soft text-sage flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border">
									<Zap className="h-5 w-5" />
								</span>
								<div>
									<Label htmlFor="pet-activity" className="text-ink font-semibold">
										Activity level
									</Label>
									<p className="text-ink-muted mt-1 text-sm leading-6">{activeActivity.description}</p>
								</div>
							</div>
							<Select
								value={settings.activityLevel}
								disabled={saving}
								onValueChange={(activityLevel: PetSettings['activityLevel']) => updateSettings({ activityLevel })}
							>
								<SelectTrigger id="pet-activity" className="bg-surface">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{activityOptions.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</section>
					</CardContent>
				</Card>

				<div className="flex justify-end">
					<Button variant="secondary" disabled={saving} onClick={() => void saveSettings(DEFAULT_PET_SETTINGS)}>
						Reset to defaults
					</Button>
				</div>
			</div>
		</main>
	)
}
