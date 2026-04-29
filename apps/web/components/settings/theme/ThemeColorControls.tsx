'use client'

import { ColorPicker } from '@/components/ui/color-picker'
import { Input } from '@/components/ui/input'
import { colorLabels, themeColorGroups } from '@/lib/theme/theme-settings'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

export function ThemeColorControls({
	colors,
	onColorChange,
}: {
	colors: CrmThemeSettings['colors']
	onColorChange: (key: keyof CrmThemeSettings['colors'], value: string) => void
}) {
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

function ColorRow({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
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
