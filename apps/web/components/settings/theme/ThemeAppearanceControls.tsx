'use client'

import type { FC } from 'react'

import { Palette, RotateCcw, Save, Shuffle, Type } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { FontSizeInputProps, ThemeAppearanceControlsProps } from './ThemeAppearanceControls.types'
import { ThemeColorControls } from './ThemeColorControls'
import { ThemeFontStackedAccordion } from './ThemeFontStackedAccordion'
import { ThemePresetCard } from './ThemePresetCard'
import { ThemeSettingsSection } from './ThemeSettingsSection'
import { ThemeShapeControls } from './ThemeShapeControls'
import { presetThemes } from './theme-presets'

export const ThemeAppearanceControls: FC<ThemeAppearanceControlsProps> = ({
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
}) => {
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
				<div className="mt-3 grid gap-3 sm:grid-cols-3">
					<FontSizeInput label="Body" value={draft.fontSizes.body} field="body" onDraftChange={onDraftChange} />
					<FontSizeInput
						label="Heading"
						value={draft.fontSizes.heading}
						field="heading"
						onDraftChange={onDraftChange}
					/>
					<FontSizeInput label="Small" value={draft.fontSizes.small} field="small" onDraftChange={onDraftChange} />
				</div>
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

const FontSizeInput: FC<FontSizeInputProps> = ({ label, value, field, onDraftChange }) => {
	return (
		<label className="grid gap-1.5">
			<span className="text-ink-muted text-xs font-medium">{label} size</span>
			<Input
				type="number"
				min={field === 'small' ? 10 : 12}
				max={field === 'heading' ? 28 : 20}
				value={value}
				onChange={(event) => {
					const next = Number(event.target.value)
					onDraftChange((current) => ({
						...current,
						fontSizes: {
							...current.fontSizes,
							[field]: Number.isFinite(next) ? next : value,
						},
					}))
				}}
				className="font-mono tabular-nums"
			/>
		</label>
	)
}
