import type { PropsWithChildren } from 'react'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

export type ThemeSettingsProviderProps = PropsWithChildren

export type ThemeSettingsContextValue = {
	theme: CrmThemeSettings
	loading: boolean
	applySavedTheme: (theme: CrmThemeSettings) => void
	saveTheme: (theme: CrmThemeSettings) => Promise<void>
	resetTheme: () => Promise<void>
}
