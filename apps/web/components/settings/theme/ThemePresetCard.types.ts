import type { CrmThemeSettings } from '@teacher-crm/api-types'

export type ThemePresetCardProps = {
	active: boolean
	label: string
	onSelect: () => void
	theme: CrmThemeSettings
}
