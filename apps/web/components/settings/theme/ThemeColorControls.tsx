'use client'

import type { FC } from 'react'

import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { colorLabels, themeColorGroups } from '@/lib/theme/theme-settings'

import type { ColorRowProps, ThemeColorControlsProps } from './ThemeColorControls.types'

export const ThemeColorControls: FC<ThemeColorControlsProps> = ({ colors, onColorChange }) => {
	return (
		<div className="space-y-3">
			{themeColorGroups.map((group) => (
				<div key={group.title} className="border-line-soft bg-surface-muted rounded-xl border p-3">
					<div className="mb-3">
						<p className="text-ink text-sm font-semibold">{group.title}</p>
						<p className="text-ink-muted mt-1 text-xs leading-5">{group.description}</p>
					</div>
					<div className="grid gap-2 sm:grid-cols-2">
						{group.keys.map((key) => (
							<ColorRow
								key={key}
								label={colorLabels[key]}
								value={colors[key]}
								onChange={(value) => onColorChange(key, value)}
							/>
						))}
					</div>
				</div>
			))}
		</div>
	)
}

const ColorRow: FC<ColorRowProps> = ({ label, onChange, value }) => {
	return (
		<div className="border-line-soft bg-surface grid gap-2 rounded-lg border p-2">
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="text-ink truncate text-xs font-medium">{label}</p>
					<p className="text-ink-muted font-mono text-[10px]">{value}</p>
				</div>
				<ColorPicker
					value={value}
					onChange={onChange}
					className="border-line-strong hover:border-sage-line h-8 w-8 rounded-md p-0 shadow-none"
				/>
			</div>
			<Input value={value} onChange={(event) => onChange(event.target.value)} className="h-8 font-mono text-xs" />
		</div>
	)
}
