import { DEFAULT_CRM_THEME_SETTINGS, type CrmThemeSettings } from '@teacher-crm/api-types'

export const presetThemes: Array<{ id: string; label: string; theme: CrmThemeSettings }> = [
	{ id: 'devl', label: 'Devl', theme: DEFAULT_CRM_THEME_SETTINGS },
	{
		id: 'studio',
		label: 'Studio',
		theme: {
			radius: 'default',
			headingFont: 'geist',
			bodyFont: 'geist',
			numberFont: 'mono',
			fontSizes: { ...DEFAULT_CRM_THEME_SETTINGS.fontSizes },
			colors: {
				background: '#f6f7fb',
				foreground: '#111827',
				card: '#ffffff',
				surfaceMuted: '#e6eaf2',
				primary: '#155eef',
				accent: '#7c3aed',
				success: '#168a4a',
				warning: '#b45309',
				danger: '#be123c',
				chart: '#64748b',
			},
		},
	},
	{
		id: 'contrast',
		label: 'Contrast',
		theme: {
			radius: 'sm',
			headingFont: 'ibm-plex',
			bodyFont: 'ibm-plex',
			numberFont: 'jetbrains-mono',
			fontSizes: { ...DEFAULT_CRM_THEME_SETTINGS.fontSizes },
			colors: {
				background: '#f3f4ef',
				foreground: '#111815',
				card: '#fbfcf8',
				surfaceMuted: '#e2e5dc',
				primary: '#1f6f50',
				accent: '#b45309',
				success: '#047857',
				warning: '#b7791f',
				danger: '#b91c1c',
				chart: '#3f4a45',
			},
		},
	},
]

export const shufflePalettes: CrmThemeSettings['colors'][] = [
	presetThemes[0].theme.colors,
	presetThemes[1].theme.colors,
	presetThemes[2].theme.colors,
	{
		background: '#f8fafc',
		foreground: '#0f172a',
		card: '#ffffff',
		surfaceMuted: '#e2e8f0',
		primary: '#0f766e',
		accent: '#7c3aed',
		success: '#15803d',
		warning: '#ca8a04',
		danger: '#dc2626',
		chart: '#475569',
	},
]
