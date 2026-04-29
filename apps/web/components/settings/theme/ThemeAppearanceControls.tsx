'use client'

import type { Dispatch, SetStateAction } from 'react'

import { Palette, RotateCcw, Save, Shuffle, Type } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

import { ThemeColorControls } from './ThemeColorControls'
import { ThemeFontStackedAccordion } from './ThemeFontStackedAccordion'
import { ThemePresetCard } from './ThemePresetCard'
import { ThemeSettingsSection } from './ThemeSettingsSection'
import { ThemeShapeControls } from './ThemeShapeControls'
import { presetThemes } from './theme-presets'

type ThemeAppearanceControlsProps = {
	activePreset: string
	draft: CrmThemeSettings
	hasChanges: boolean
	isSaving: boolean
	onApplyPreset: (presetId: string) => void
	onColorChange: (key: keyof CrmThemeSettings['colors'], value: string) => void
	onDraftChange: Dispatch<SetStateAction<CrmThemeSettings>>
	onReset: () => void
	onSave: () => void
	onShuffle: () => void
	onUndo: () => void
}

export function ThemeAppearanceControls({
	activePreset,
	draft,
	hasChanges,
	isSaving,
	onApplyPreset,
	onColorChange,
	onDraftChange,
	onReset,
	onSave,
	onShuffle,
	onUndo,
}: ThemeAppearanceControlsProps) {
	return (
		<section className="space-y-4">
			<header className="border-line bg-surface rounded-2xl border p-5 shadow-[0_18px_55px_-46px_var(--shadow-sage)]">
				<div className="flex items-start justify-between gap-4">
					<div>
						<p className="text-ink-muted font-mono text-[10px] uppercase tracking-[0.25em]">Settings · Appearance</p>
						<h1 className="font-heading text-ink mt-3 text-2xl font-semibold">Make it yours</h1>
						<p className="text-ink-muted mt-2 max-w-xl text-sm leading-6">
							Tune the CRM palette, typography, and shape system from one screen. The preview uses real teacher CRM
							blocks before the theme is saved.
						</p>
					</div>
					<Badge tone={hasChanges ? 'amber' : 'green'} className="font-mono text-[10px] uppercase">
						{hasChanges ? 'draft' : 'saved'}
					</Badge>
				</div>
				<div className="mt-5 flex flex-wrap gap-2">
					<Button type="button" size="sm" variant="outline" onClick={onShuffle} disabled={isSaving}>
						<Shuffle className="h-4 w-4" />
						Shuffle
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={onUndo} disabled={!hasChanges || isSaving}>
						<RotateCcw className="h-4 w-4" />
						Undo
					</Button>
					<Button type="button" size="sm" variant="outline" onClick={onReset} disabled={isSaving}>
						Reset
					</Button>
					<Button type="button" size="sm" onClick={onSave} disabled={!hasChanges || isSaving}>
						<Save className="h-4 w-4" />
						Save theme
					</Button>
				</div>
			</header>

			<ThemeSettingsSection
				icon={<Palette className="h-4 w-4" />}
				title="Palette"
				hint="Start from a full theme preset."
			>
				<div className="grid gap-2 sm:grid-cols-3">
					{presetThemes.map((preset) => (
						<ThemePresetCard
							key={preset.id}
							active={activePreset === preset.id}
							label={preset.label}
							theme={preset.theme}
							onSelect={() => onApplyPreset(preset.id)}
						/>
					))}
				</div>
			</ThemeSettingsSection>

			<ThemeSettingsSection
				icon={<Type className="h-4 w-4" />}
				title="Typography"
				hint="Configure heading, body, and numeric fonts independently."
			>
				<ThemeFontStackedAccordion draft={draft} onDraftChange={onDraftChange} />
			</ThemeSettingsSection>

			<ThemeSettingsSection title="Shape" hint="Controls cards, inputs, buttons, tables, and popovers.">
				<ThemeShapeControls draft={draft} onDraftChange={onDraftChange} />
			</ThemeSettingsSection>

			<ThemeSettingsSection
				title="Colors"
				hint="Edit every CRM semantic token directly. Hex values update the preview live."
			>
				<ThemeColorControls colors={draft.colors} onColorChange={onColorChange} />
			</ThemeSettingsSection>
		</section>
	)
}
