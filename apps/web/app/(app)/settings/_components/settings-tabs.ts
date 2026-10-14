export const SETTINGS_TABS = ['general', 'calendar', 'assistant'] as const

export type SettingsTab = (typeof SETTINGS_TABS)[number]

export function resolveTab(tab: string | undefined): SettingsTab {
	return SETTINGS_TABS.find((item) => item === tab) ?? 'general'
}

export function activeTabOf(searchParams: { get: (name: string) => string | null }): SettingsTab {
	return searchParams.get('google') !== null ? 'calendar' : resolveTab(searchParams.get('tab') ?? undefined)
}
