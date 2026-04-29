import type { ReactNode } from 'react'

import type { Metadata } from 'next'
import {
	Geist,
	Geist_Mono,
	IBM_Plex_Sans,
	Inter,
	JetBrains_Mono,
	Manrope,
	Merriweather,
	Nunito_Sans,
	Playfair_Display,
	Roboto,
	Roboto_Mono,
} from 'next/font/google'

import './globals.css'
import { ThemeProviders } from './providers'

const geistSans = Geist({
	subsets: ['latin'],
	variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({
	subsets: ['latin'],
	variable: '--font-geist-mono',
})

const inter = Inter({
	subsets: ['latin', 'cyrillic'],
	variable: '--font-inter',
})

const manrope = Manrope({
	subsets: ['latin', 'cyrillic'],
	variable: '--font-manrope',
})

const nunitoSans = Nunito_Sans({
	subsets: ['latin', 'cyrillic'],
	variable: '--font-nunito',
})

const roboto = Roboto({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '700'],
	variable: '--font-roboto',
})

const ibmPlexSans = IBM_Plex_Sans({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '600', '700'],
	variable: '--font-ibm-plex',
})

const playfair = Playfair_Display({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '600', '700'],
	variable: '--font-playfair',
})

const merriweather = Merriweather({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '700'],
	variable: '--font-merriweather',
})

const jetbrainsMono = JetBrains_Mono({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '700'],
	variable: '--font-jetbrains-mono',
})

const robotoMono = Roboto_Mono({
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '700'],
	variable: '--font-roboto-mono',
})

export const metadata: Metadata = {
	title: 'Teacher English CRM',
	description: 'Students, individual lessons, payments, and calendar control for an English teacher.',
}

const themeHydrationScript = `
(() => {
	try {
		const raw = window.localStorage.getItem('teacher-crm-theme');
		if (!raw) return;
		let theme = JSON.parse(raw);
		const legacyDefault = {
			radius: 'default',
			headingFont: 'geist',
			bodyFont: 'geist',
			numberFont: 'geist',
			colors: {
				background: '#f7f5ef',
				foreground: '#181713',
				primary: '#2f6f5e',
				accent: '#9a6a1f',
				success: '#3f7a4d',
				warning: '#9a6a1f',
				danger: '#a64235',
				chart: '#7d7a72'
			}
		};
		const devlDefault = {
			radius: 'default',
			headingFont: 'geist',
			bodyFont: 'geist',
			numberFont: 'mono',
			colors: {
				background: '#f8fafc',
				foreground: '#0f172a',
				primary: '#2f6f5e',
				accent: '#d97706',
				success: '#059669',
				warning: '#d97706',
				danger: '#dc2626',
				chart: '#64748b'
			}
		};
		const blueDefault = {
			...devlDefault,
			colors: {
				...devlDefault.colors,
				primary: '#2563eb'
			}
		};
		const sameTheme = (a, b) => a && b &&
			a.radius === b.radius &&
			a.headingFont === b.headingFont &&
			a.bodyFont === b.bodyFont &&
			a.numberFont === b.numberFont &&
			Object.keys(b.colors).every((key) => a.colors?.[key] === b.colors[key]);
		const resolvedTheme = sameTheme(theme, legacyDefault) || sameTheme(theme, blueDefault) ? devlDefault : theme;
		if (resolvedTheme !== theme) window.localStorage.setItem('teacher-crm-theme', JSON.stringify(resolvedTheme));
		theme = resolvedTheme;
		const colors = theme.colors || {};
		const style = document.documentElement.style;
		const hex = /^#[0-9a-fA-F]{6}$/;
		const fontStacks = {
			geist: 'var(--font-geist-sans), var(--font-inter), Geist, "Geist Sans", Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			inter: 'var(--font-inter), Inter, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			manrope: 'var(--font-manrope), Manrope, var(--font-inter), Inter, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
			nunito: 'var(--font-nunito), "Nunito Sans", var(--font-inter), Inter, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
			roboto: 'var(--font-roboto), Roboto, var(--font-inter), Inter, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
			'ibm-plex': 'var(--font-ibm-plex), "IBM Plex Sans", var(--font-inter), Inter, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
			system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			serif: 'Georgia, "Times New Roman", ui-serif, serif',
			playfair: 'var(--font-playfair), "Playfair Display", Georgia, "Times New Roman", ui-serif, serif',
			merriweather: 'var(--font-merriweather), Merriweather, Georgia, "Times New Roman", ui-serif, serif',
			mono: 'var(--font-geist-mono), var(--font-jetbrains-mono), "Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
			'jetbrains-mono': 'var(--font-jetbrains-mono), "JetBrains Mono", var(--font-geist-mono), "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
			'roboto-mono': 'var(--font-roboto-mono), "Roboto Mono", var(--font-jetbrains-mono), "JetBrains Mono", var(--font-geist-mono), "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
		};
		const radii = { none: '0rem', sm: '0.375rem', default: '0.5rem', lg: '0.75rem', xl: '1rem' };
		const readableTextOn = (value) => {
			if (!hex.test(value)) return '#ffffff';
			const red = Number.parseInt(value.slice(1, 3), 16);
			const green = Number.parseInt(value.slice(3, 5), 16);
			const blue = Number.parseInt(value.slice(5, 7), 16);
			const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
			return luminance > 0.62 ? '#181713' : '#ffffff';
		};
		const headingFont = fontStacks[theme.headingFont] || fontStacks.geist;
		const bodyFont = fontStacks[theme.bodyFont] || fontStacks.geist;
		const numberFont = fontStacks[theme.numberFont] || fontStacks.mono;
		style.setProperty('--font-heading', headingFont);
		style.setProperty('--font-body', bodyFont);
		style.setProperty('--font-numeric', numberFont);
		style.setProperty('--font-sans', bodyFont);
		style.setProperty('--font-mono', numberFont);
		style.setProperty('--radius', radii[theme.radius] || radii.default);
		if (hex.test(colors.background)) style.setProperty('--canvas', colors.background);
		if (hex.test(colors.foreground)) style.setProperty('--ink', colors.foreground);
		if (hex.test(colors.primary)) style.setProperty('--sage', colors.primary);
		if (hex.test(colors.accent)) style.setProperty('--crm-accent', colors.accent);
		if (hex.test(colors.success)) style.setProperty('--success', colors.success);
		if (hex.test(colors.warning)) style.setProperty('--warning', colors.warning);
		if (hex.test(colors.danger)) style.setProperty('--danger', colors.danger);
		if (hex.test(colors.chart)) style.setProperty('--chart', colors.chart);
		style.setProperty('--canvas-warm', 'color-mix(in srgb, var(--canvas) 96%, var(--chart) 4%)');
		style.setProperty('--surface', 'color-mix(in srgb, var(--canvas) 10%, #ffffff 90%)');
		style.setProperty('--surface-muted', 'color-mix(in srgb, var(--canvas) 78%, var(--ink) 7%)');
		style.setProperty('--ink-muted', 'color-mix(in srgb, var(--ink) 58%, var(--canvas) 42%)');
		style.setProperty('--line', 'color-mix(in srgb, var(--ink) 12%, var(--canvas) 88%)');
		style.setProperty('--line-soft', 'color-mix(in srgb, var(--ink) 7%, var(--canvas) 93%)');
		style.setProperty('--line-strong', 'color-mix(in srgb, var(--ink) 20%, var(--canvas) 80%)');
		style.setProperty('--sage-soft', 'color-mix(in srgb, var(--sage) 10%, var(--surface) 90%)');
		style.setProperty('--sage-line', 'color-mix(in srgb, var(--sage) 24%, var(--surface) 76%)');
		style.setProperty('--warning-soft', 'color-mix(in srgb, var(--warning) 12%, var(--surface) 88%)');
		style.setProperty('--warning-line', 'color-mix(in srgb, var(--warning) 28%, var(--surface) 72%)');
		style.setProperty('--danger-soft', 'color-mix(in srgb, var(--danger) 10%, var(--surface) 90%)');
		style.setProperty('--danger-line', 'color-mix(in srgb, var(--danger) 24%, var(--surface) 76%)');
		style.setProperty('--success-soft', 'color-mix(in srgb, var(--success) 10%, var(--surface) 90%)');
		style.setProperty('--success-line', 'color-mix(in srgb, var(--success) 24%, var(--surface) 76%)');
		style.setProperty('--shadow-sage', 'color-mix(in srgb, var(--ink) 14%, transparent)');
		style.setProperty('--background', 'var(--canvas)');
		style.setProperty('--foreground', 'var(--ink)');
		style.setProperty('--card', 'var(--surface)');
		style.setProperty('--card-foreground', 'var(--ink)');
		style.setProperty('--popover', 'var(--surface)');
		style.setProperty('--popover-foreground', 'var(--ink)');
		style.setProperty('--primary', 'var(--sage)');
		style.setProperty('--primary-foreground', readableTextOn(colors.primary));
		style.setProperty('--secondary', 'var(--sage-soft)');
		style.setProperty('--secondary-foreground', 'var(--sage)');
		style.setProperty('--muted', 'var(--surface-muted)');
		style.setProperty('--muted-foreground', 'var(--ink-muted)');
		style.setProperty('--accent', 'color-mix(in srgb, var(--crm-accent) 16%, var(--canvas) 84%)');
		style.setProperty('--accent-foreground', readableTextOn(colors.accent));
		style.setProperty('--destructive', 'var(--danger)');
		style.setProperty('--border', 'var(--line)');
		style.setProperty('--input', 'var(--line-strong)');
		style.setProperty('--ring', 'var(--sage)');
		style.setProperty('--sidebar', 'var(--surface-muted)');
		style.setProperty('--sidebar-foreground', 'var(--ink)');
		style.setProperty('--sidebar-primary', 'var(--sage)');
		style.setProperty('--sidebar-primary-foreground', readableTextOn(colors.primary));
		style.setProperty('--sidebar-accent', 'var(--sage-soft)');
		style.setProperty('--sidebar-accent-foreground', 'var(--sage)');
		style.setProperty('--sidebar-border', 'var(--line)');
		style.setProperty('--sidebar-ring', 'var(--sage)');
	} catch {}
})();
`

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html
			lang="ru"
			suppressHydrationWarning
			className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${manrope.variable} ${nunitoSans.variable} ${roboto.variable} ${ibmPlexSans.variable} ${playfair.variable} ${merriweather.variable} ${jetbrainsMono.variable} ${robotoMono.variable}`}
		>
			<body>
				<script dangerouslySetInnerHTML={{ __html: themeHydrationScript }} />
				<ThemeProviders>{children}</ThemeProviders>
			</body>
		</html>
	)
}
