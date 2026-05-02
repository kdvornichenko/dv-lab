'use client'

import type { FC } from 'react'

import { radiusOptions } from '@/lib/theme/theme-settings'

import type { RadiusButtonProps, ThemeShapeControlsProps } from './ThemeShapeControls.types'

export const ThemeShapeControls: FC<ThemeShapeControlsProps> = ({ draft, onDraftChange }) => {
	return (
		<div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
			{radiusOptions.map((option) => (
				<RadiusButton
					key={option.value}
					active={draft.radius === option.value}
					label={option.label}
					preview={option.preview}
					onSelect={() => onDraftChange((current) => ({ ...current, radius: option.value }))}
				/>
			))}
		</div>
	)
}

const RadiusButton: FC<RadiusButtonProps> = ({ active, label, onSelect, preview }) => {
	return (
		<button
			type="button"
			aria-pressed={active}
			className="border-line-soft bg-surface-muted hover:border-sage-line hover:bg-sage-soft/45 aria-pressed:border-sage-line aria-pressed:bg-sage-soft rounded-xl border p-3 text-left transition-colors"
			onClick={onSelect}
		>
			<span className="border-line-strong bg-surface block h-10 border" style={{ borderRadius: preview }} />
			<span className="text-ink mt-2 block text-xs font-semibold">{label}</span>
		</button>
	)
}
