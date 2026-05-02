'use client'

import * as React from 'react'
import type { FC } from 'react'

import { usePathname } from 'next/navigation'
import { toast } from 'sonner'

import { teacherCrmApi } from '@/lib/crm/api'
import {
	applyCrmTheme,
	cloneTheme,
	migrateCrmTheme,
	normalizeTheme,
	readLocalCrmTheme,
	writeLocalCrmTheme,
} from '@/lib/theme/theme-settings'

import { DEFAULT_CRM_THEME_SETTINGS, type CrmThemeSettings } from '@teacher-crm/api-types'

import type { ThemeSettingsContextValue, ThemeSettingsProviderProps } from './ThemeSettingsProvider.types'

const ThemeSettingsContext = React.createContext<ThemeSettingsContextValue | null>(null)

export const ThemeSettingsProvider: FC<ThemeSettingsProviderProps> = ({ children }) => {
	const pathname = usePathname()
	const [theme, setTheme] = React.useState<CrmThemeSettings>(() => cloneTheme(DEFAULT_CRM_THEME_SETTINGS))
	const [loading, setLoading] = React.useState(true)

	const applySavedTheme = React.useCallback((nextTheme: CrmThemeSettings) => {
		const cloned = cloneTheme(normalizeTheme(migrateCrmTheme(nextTheme)))
		applyCrmTheme(cloned)
		writeLocalCrmTheme(cloned)
		setTheme(cloned)
	}, [])

	React.useEffect(() => {
		let cancelled = false

		async function hydrateTheme() {
			const localTheme = readLocalCrmTheme()
			if (localTheme) {
				applySavedTheme(localTheme)
				setLoading(false)
				return
			}

			const canLoadRemoteTheme = pathname !== '/login' && !pathname.startsWith('/auth')
			if (!canLoadRemoteTheme) {
				const defaultTheme = cloneTheme(DEFAULT_CRM_THEME_SETTINGS)
				applyCrmTheme(defaultTheme)
				setTheme(defaultTheme)
				setLoading(false)
				return
			}

			try {
				const response = await teacherCrmApi.getThemeSettings()
				if (cancelled) return
				applySavedTheme(response.theme)
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Failed to load theme settings'
				toast.error('Theme settings unavailable', { description: message })
			} finally {
				if (!cancelled) setLoading(false)
			}
		}

		void hydrateTheme()
		return () => {
			cancelled = true
		}
	}, [applySavedTheme, pathname])

	const saveTheme = React.useCallback(
		async (nextTheme: CrmThemeSettings) => {
			const optimisticTheme = cloneTheme(normalizeTheme(nextTheme))
			applySavedTheme(optimisticTheme)
			const response = await teacherCrmApi.saveThemeSettings(optimisticTheme)
			applySavedTheme(response.theme)
		},
		[applySavedTheme]
	)

	const resetTheme = React.useCallback(async () => saveTheme(cloneTheme(DEFAULT_CRM_THEME_SETTINGS)), [saveTheme])

	const value = React.useMemo<ThemeSettingsContextValue>(
		() => ({
			theme,
			loading,
			applySavedTheme,
			saveTheme,
			resetTheme,
		}),
		[applySavedTheme, loading, resetTheme, saveTheme, theme]
	)

	return <ThemeSettingsContext.Provider value={value}>{children}</ThemeSettingsContext.Provider>
}

export function useThemeSettings() {
	const value = React.useContext(ThemeSettingsContext)
	if (!value) throw new Error('useThemeSettings must be used within ThemeSettingsProvider.')
	return value
}
