import type { CrmThemeSettings } from '@teacher-crm/api-types'

export type ThemeColorControlsProps = {
	colors: CrmThemeSettings['colors']
	onColorChange: (key: keyof CrmThemeSettings['colors'], value: string) => void
}

export type ColorRowProps = {
	label: string
	onChange: (value: string) => void
	value: string
}
