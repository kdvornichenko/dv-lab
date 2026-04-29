'use client'

import { useEffect, useMemo, useState } from 'react'

import { toast } from 'sonner'

import { useThemeSettings } from '@/components/ThemeSettingsProvider'
import { ThemeAppearanceControls } from '@/components/settings/theme/ThemeAppearanceControls'
import { ThemeBlocksPreview } from '@/components/settings/theme/ThemeBlocksPreview'
import { presetThemes, shufflePalettes } from '@/components/settings/theme/theme-presets'
import { Skeleton } from '@/components/ui/skeleton'
import { cloneTheme, radiusOptions } from '@/lib/theme/theme-settings'

import { DEFAULT_CRM_THEME_SETTINGS, type CrmThemeSettings } from '@teacher-crm/api-types'

function themesEqual(a: CrmThemeSettings, b: CrmThemeSettings) {
	return JSON.stringify(a) === JSON.stringify(b)
}

export function ThemeSettingsClient() {
	const { loading, resetTheme, saveTheme, theme } = useThemeSettings()
	const [draft, setDraft] = useState(() => cloneTheme(theme))
	const [activePreset, setActivePreset] = useState('devl')
	const [isSaving, setIsSaving] = useState(false)
	const hasChanges = useMemo(() => !themesEqual(draft, theme), [draft, theme])

	useEffect(() => {
		setDraft(cloneTheme(theme))
	}, [theme])

	function updateColor(key: keyof CrmThemeSettings['colors'], value: string) {
		setDraft((current) => ({
			...current,
			colors: {
				...current.colors,
				[key]: value,
			},
		}))
	}

	function applyPreset(presetId: string) {
		const preset = presetThemes.find((item) => item.id === presetId)
		if (!preset) return
		setActivePreset(presetId)
		setDraft(cloneTheme(preset.theme))
	}

	function shuffleTheme() {
		const palette = shufflePalettes[Math.floor(Math.random() * shufflePalettes.length)]
		const radius = radiusOptions[Math.floor(Math.random() * radiusOptions.length)].value
		setDraft((current) => ({
			...current,
			radius,
			colors: { ...palette },
		}))
	}

	async function handleSave() {
		setIsSaving(true)
		try {
			await saveTheme(draft)
			toast.success('Theme saved')
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Saved locally, but database sync failed'
			toast.error('Theme saved locally', { description: message })
		} finally {
			setIsSaving(false)
		}
	}

	async function handleReset() {
		setIsSaving(true)
		try {
			setDraft(cloneTheme(DEFAULT_CRM_THEME_SETTINGS))
			setActivePreset('devl')
			await resetTheme()
			toast.success('Theme reset')
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Reset locally, but database sync failed'
			toast.error('Theme reset locally', { description: message })
		} finally {
			setIsSaving(false)
		}
	}

	if (loading) {
		return (
			<main className="bg-canvas text-ink min-h-full px-4 py-6 sm:px-6">
				<div className="mx-auto grid w-full gap-5 lg:grid-cols-[minmax(22rem,0.4fr)_minmax(0,1.35fr)]">
					<Skeleton className="h-168 bg-surface-muted rounded-2xl" />
					<Skeleton className="h-168 bg-surface-muted rounded-2xl" />
				</div>
			</main>
		)
	}

	return (
		<main className="bg-canvas text-ink min-h-full px-4 py-6 sm:px-6">
			<div className="mx-auto grid w-full gap-5 lg:grid-cols-[minmax(22rem,0.4fr)_minmax(0,1.35fr)]">
				<ThemeAppearanceControls
					activePreset={activePreset}
					draft={draft}
					hasChanges={hasChanges}
					isSaving={isSaving}
					onApplyPreset={applyPreset}
					onColorChange={updateColor}
					onDraftChange={setDraft}
					onReset={() => void handleReset()}
					onSave={() => void handleSave()}
					onShuffle={shuffleTheme}
					onUndo={() => setDraft(cloneTheme(theme))}
				/>

				<section className="border-line bg-surface min-w-0 overflow-hidden rounded-2xl border shadow-[0_18px_55px_-46px_var(--shadow-sage)] lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)]">
					<div className="border-line-soft flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
						<div>
							<h2 className="font-heading text-ink text-base font-semibold">Live preview</h2>
							<p className="text-ink-muted text-xs">Real CRM blocks rendered with draft tokens.</p>
						</div>
						<div className="text-ink-muted flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
							<span className="bg-success size-1.5 rounded-full" />
							Preview only
						</div>
					</div>
					<ThemeBlocksPreview theme={draft} />
				</section>
			</div>
		</main>
	)
}
