import { Check } from 'lucide-react'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

export function ThemePresetCard({
	active,
	label,
	onSelect,
	theme,
}: {
	active: boolean
	label: string
	onSelect: () => void
	theme: CrmThemeSettings
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			className="border-line-soft bg-surface-muted hover:border-sage-line hover:bg-sage-soft/45 aria-pressed:border-sage-line aria-pressed:bg-sage-soft group relative rounded-xl border p-3 text-left transition-colors"
			onClick={onSelect}
		>
			<div className="border-line-soft flex h-16 overflow-hidden rounded-lg border">
				<span className="flex-1" style={{ backgroundColor: theme.colors.background }} />
				<span className="flex-1" style={{ backgroundColor: theme.colors.primary }} />
				<span className="flex-1" style={{ backgroundColor: theme.colors.accent }} />
			</div>
			<div className="mt-3 flex items-center justify-between gap-2">
				<span className="text-ink text-sm font-semibold">{label}</span>
				{active ? <Check className="text-sage size-4" /> : null}
			</div>
		</button>
	)
}
