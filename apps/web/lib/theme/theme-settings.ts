'use client'

import type { CSSProperties } from 'react'

import { DEFAULT_CRM_THEME_SETTINGS, crmThemeSettingsSchema, type CrmThemeSettings } from '@teacher-crm/api-types'

export const THEME_STORAGE_KEY = 'teacher-crm-theme'

type ThemeColorKey = keyof CrmThemeSettings['colors']
type ThemeFontKey = CrmThemeSettings['headingFont']
type ThemeRadiusKey = CrmThemeSettings['radius']

export const fontOptions: Array<{ value: ThemeFontKey; label: string; sample: string }> = [
	{ value: 'geist', label: 'Geist', sample: 'Teacher CRM' },
	{ value: 'inter', label: 'Inter', sample: 'Teacher CRM' },
	{ value: 'manrope', label: 'Manrope', sample: 'Teacher CRM' },
	{ value: 'nunito', label: 'Nunito Sans', sample: 'Teacher CRM' },
	{ value: 'roboto', label: 'Roboto', sample: 'Teacher CRM' },
	{ value: 'ibm-plex', label: 'IBM Plex Sans', sample: 'Teacher CRM' },
	{ value: 'system', label: 'System', sample: 'Teacher CRM' },
	{ value: 'serif', label: 'Serif', sample: 'Teacher CRM' },
	{ value: 'playfair', label: 'Playfair Display', sample: 'Teacher CRM' },
	{ value: 'merriweather', label: 'Merriweather', sample: 'Teacher CRM' },
	{ value: 'mono', label: 'Mono', sample: '123 456 ₽' },
	{ value: 'jetbrains-mono', label: 'JetBrains Mono', sample: '123 456 ₽' },
	{ value: 'roboto-mono', label: 'Roboto Mono', sample: '123 456 ₽' },
]

export const radiusOptions: Array<{ value: ThemeRadiusKey; label: string; preview: string }> = [
	{ value: 'none', label: 'None', preview: '0px' },
	{ value: 'sm', label: 'Small', preview: '6px' },
	{ value: 'default', label: 'Default', preview: '8px' },
	{ value: 'lg', label: 'Large', preview: '12px' },
	{ value: 'xl', label: 'Extra large', preview: '16px' },
]

export const themeColorGroups: Array<{
	title: string
	description: string
	keys: ThemeColorKey[]
}> = [
	{
		title: 'Core',
		description: 'Base surface, text, primary action, and accent.',
		keys: ['background', 'foreground', 'primary', 'accent'],
	},
	{
		title: 'Signals',
		description: 'Operational states and chart color.',
		keys: ['success', 'warning', 'danger', 'chart'],
	},
]

export const colorLabels: Record<ThemeColorKey, string> = {
	background: 'Background',
	foreground: 'Foreground',
	primary: 'Primary',
	accent: 'Accent',
	success: 'Success',
	warning: 'Warning',
	danger: 'Danger',
	chart: 'Chart',
}

const fontStacks: Record<ThemeFontKey, string> = {
	geist:
		'var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	inter:
		'var(--font-inter), Inter, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	manrope:
		'var(--font-manrope), Manrope, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
	nunito:
		'var(--font-nunito), "Nunito Sans", var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
	roboto:
		'var(--font-roboto), Roboto, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
	'ibm-plex':
		'var(--font-ibm-plex), "IBM Plex Sans", var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
	system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
	serif: 'Georgia, "Times New Roman", ui-serif, serif',
	playfair: 'var(--font-playfair), "Playfair Display", Georgia, "Times New Roman", ui-serif, serif',
	merriweather: 'var(--font-merriweather), Merriweather, Georgia, "Times New Roman", ui-serif, serif',
	mono: 'var(--font-geist-mono), "Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
	'jetbrains-mono':
		'var(--font-jetbrains-mono), "JetBrains Mono", var(--font-geist-mono), "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
	'roboto-mono':
		'var(--font-roboto-mono), "Roboto Mono", var(--font-geist-mono), "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
}

const radiusValues: Record<ThemeRadiusKey, string> = {
	none: '0rem',
	sm: '0.375rem',
	default: '0.5rem',
	lg: '0.75rem',
	xl: '1rem',
}

export function fontStackFor(key: ThemeFontKey) {
	return fontStacks[key] ?? fontStacks.geist
}

function hexToRgb(hex: string) {
	const value = hex.replace('#', '')
	if (value.length !== 6) return null
	const red = Number.parseInt(value.slice(0, 2), 16)
	const green = Number.parseInt(value.slice(2, 4), 16)
	const blue = Number.parseInt(value.slice(4, 6), 16)
	if ([red, green, blue].some((channel) => Number.isNaN(channel))) return null
	return { red, green, blue }
}

function readableTextOn(hex: string) {
	const rgb = hexToRgb(hex)
	if (!rgb) return '#ffffff'
	const luminance = (0.299 * rgb.red + 0.587 * rgb.green + 0.114 * rgb.blue) / 255
	return luminance > 0.62 ? '#181713' : '#ffffff'
}

function softMix(variableName: string, amount = 14) {
	return `color-mix(in srgb, var(${variableName}) ${amount}%, var(--canvas) ${100 - amount}%)`
}

function lineMix(variableName: string, amount = 30) {
	return `color-mix(in srgb, var(${variableName}) ${amount}%, var(--canvas) ${100 - amount}%)`
}

export function normalizeTheme(value: unknown): CrmThemeSettings {
	return crmThemeSettingsSchema.catch(DEFAULT_CRM_THEME_SETTINGS).parse(value)
}

export function cloneTheme(theme: CrmThemeSettings): CrmThemeSettings {
	return {
		radius: theme.radius,
		headingFont: theme.headingFont,
		bodyFont: theme.bodyFont,
		numberFont: theme.numberFont,
		colors: { ...theme.colors },
	}
}

export function themeCssVariables(theme: CrmThemeSettings): CSSProperties {
	const headingFont = fontStackFor(theme.headingFont)
	const bodyFont = fontStackFor(theme.bodyFont)
	const numberFont = fontStackFor(theme.numberFont)
	const radius = radiusValues[theme.radius] ?? radiusValues.default
	const radiusSm = `max(calc(${radius} - 0.125rem), 0rem)`
	const radiusLg = `calc(${radius} + 0.125rem)`
	const radiusXl = `calc(${radius} + 0.25rem)`
	const styles: Record<string, string> = {
		'--font-heading': headingFont,
		'--font-body': bodyFont,
		'--font-numeric': numberFont,
		'--font-sans': bodyFont,
		'--font-mono': numberFont,
		'--radius': radius,
		'--radius-sm': radiusSm,
		'--radius-md': radius,
		'--radius-lg': radiusLg,
		'--radius-xl': radiusXl,
		'--canvas': theme.colors.background,
		'--ink': theme.colors.foreground,
		'--sage': theme.colors.primary,
		'--crm-accent': theme.colors.accent,
		'--success': theme.colors.success,
		'--warning': theme.colors.warning,
		'--danger': theme.colors.danger,
		'--chart': theme.colors.chart,
		'--canvas-warm': 'color-mix(in srgb, var(--canvas) 92%, var(--crm-accent) 8%)',
		'--surface': 'color-mix(in srgb, var(--canvas) 96%, white 4%)',
		'--surface-muted': 'color-mix(in srgb, var(--surface) 92%, var(--ink) 8%)',
		'--ink-muted': 'color-mix(in srgb, var(--ink) 64%, var(--canvas) 36%)',
		'--line': 'color-mix(in srgb, var(--ink) 14%, var(--canvas) 86%)',
		'--line-soft': 'color-mix(in srgb, var(--ink) 9%, var(--canvas) 91%)',
		'--line-strong': 'color-mix(in srgb, var(--ink) 24%, var(--canvas) 76%)',
		'--sage-soft': softMix('--sage'),
		'--sage-line': lineMix('--sage'),
		'--warning-soft': softMix('--warning'),
		'--warning-line': lineMix('--warning'),
		'--danger-soft': softMix('--danger'),
		'--danger-line': lineMix('--danger'),
		'--success-soft': softMix('--success'),
		'--success-line': lineMix('--success'),
		'--shadow-sage': 'color-mix(in srgb, var(--sage) 20%, transparent)',
		'--background': 'var(--canvas)',
		'--foreground': 'var(--ink)',
		'--card': 'var(--surface)',
		'--card-foreground': 'var(--ink)',
		'--popover': 'var(--surface)',
		'--popover-foreground': 'var(--ink)',
		'--primary': 'var(--sage)',
		'--primary-foreground': readableTextOn(theme.colors.primary),
		'--secondary': 'var(--sage-soft)',
		'--secondary-foreground': 'var(--sage)',
		'--muted': 'var(--surface-muted)',
		'--muted-foreground': 'var(--ink-muted)',
		'--accent': softMix('--crm-accent', 16),
		'--accent-foreground': readableTextOn(theme.colors.accent),
		'--destructive': 'var(--danger)',
		'--border': 'var(--line)',
		'--input': 'var(--line-strong)',
		'--ring': 'var(--sage)',
		'--sidebar': 'var(--surface-muted)',
		'--sidebar-foreground': 'var(--ink)',
		'--sidebar-primary': 'var(--sage)',
		'--sidebar-primary-foreground': readableTextOn(theme.colors.primary),
		'--sidebar-accent': 'var(--sage-soft)',
		'--sidebar-accent-foreground': 'var(--sage)',
		'--sidebar-border': 'var(--line)',
		'--sidebar-ring': 'var(--sage)',
		'--color-background': 'var(--background)',
		'--color-foreground': 'var(--foreground)',
		'--color-card': 'var(--card)',
		'--color-card-foreground': 'var(--card-foreground)',
		'--color-popover': 'var(--popover)',
		'--color-popover-foreground': 'var(--popover-foreground)',
		'--color-primary': 'var(--primary)',
		'--color-primary-foreground': 'var(--primary-foreground)',
		'--color-secondary': 'var(--secondary)',
		'--color-secondary-foreground': 'var(--secondary-foreground)',
		'--color-muted': 'var(--muted)',
		'--color-muted-foreground': 'var(--muted-foreground)',
		'--color-accent': 'var(--accent)',
		'--color-accent-foreground': 'var(--accent-foreground)',
		'--color-destructive': 'var(--destructive)',
		'--color-border': 'var(--border)',
		'--color-input': 'var(--input)',
		'--color-ring': 'var(--ring)',
		'--color-sidebar': 'var(--sidebar)',
		'--color-sidebar-foreground': 'var(--sidebar-foreground)',
		'--color-sidebar-primary': 'var(--sidebar-primary)',
		'--color-sidebar-primary-foreground': 'var(--sidebar-primary-foreground)',
		'--color-sidebar-accent': 'var(--sidebar-accent)',
		'--color-sidebar-accent-foreground': 'var(--sidebar-accent-foreground)',
		'--color-sidebar-border': 'var(--sidebar-border)',
		'--color-sidebar-ring': 'var(--sidebar-ring)',
		'--color-canvas': 'var(--canvas)',
		'--color-surface': 'var(--surface)',
		'--color-surface-muted': 'var(--surface-muted)',
		'--color-ink': 'var(--ink)',
		'--color-ink-muted': 'var(--ink-muted)',
		'--color-line': 'var(--line)',
		'--color-line-soft': 'var(--line-soft)',
		'--color-line-strong': 'var(--line-strong)',
		'--color-sage': 'var(--sage)',
		'--color-sage-soft': 'var(--sage-soft)',
		'--color-sage-line': 'var(--sage-line)',
		'--color-warning': 'var(--warning)',
		'--color-warning-soft': 'var(--warning-soft)',
		'--color-warning-line': 'var(--warning-line)',
		'--color-danger': 'var(--danger)',
		'--color-danger-soft': 'var(--danger-soft)',
		'--color-danger-line': 'var(--danger-line)',
		'--color-success': 'var(--success)',
		'--color-success-soft': 'var(--success-soft)',
		'--color-success-line': 'var(--success-line)',
		'--color-canvas-warm': 'var(--canvas-warm)',
		'--color-shadow-sage': 'var(--shadow-sage)',
		'--color-chart': 'var(--chart)',
	}

	return styles as CSSProperties
}

export function applyCrmTheme(theme: CrmThemeSettings, target: HTMLElement = document.documentElement) {
	const styles = themeCssVariables(theme) as Record<string, string>
	for (const [name, value] of Object.entries(styles)) {
		target.style.setProperty(name, value)
	}
}

export function readLocalCrmTheme() {
	if (typeof window === 'undefined') return null
	const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
	if (!raw) return null
	try {
		return normalizeTheme(JSON.parse(raw))
	} catch {
		return null
	}
}

export function writeLocalCrmTheme(theme: CrmThemeSettings) {
	if (typeof window === 'undefined') return
	window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme))
}
