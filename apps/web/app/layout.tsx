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

import { ThemeProviders } from './providers'

import './globals.css'

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
		const theme = JSON.parse(raw);
		const colors = theme.colors || {};
		const style = document.documentElement.style;
		const hex = /^#[0-9a-fA-F]{6}$/;
		const fontStacks = {
			geist: 'var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			inter: 'var(--font-inter), Inter, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			manrope: 'var(--font-manrope), Manrope, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
			nunito: 'var(--font-nunito), "Nunito Sans", var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
			roboto: 'var(--font-roboto), Roboto, var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
			'ibm-plex': 'var(--font-ibm-plex), "IBM Plex Sans", var(--font-geist-sans), Geist, "Geist Sans", ui-sans-serif, system-ui, sans-serif',
			system: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			serif: 'Georgia, "Times New Roman", ui-serif, serif',
			playfair: 'var(--font-playfair), "Playfair Display", Georgia, "Times New Roman", ui-serif, serif',
			merriweather: 'var(--font-merriweather), Merriweather, Georgia, "Times New Roman", ui-serif, serif',
			mono: 'var(--font-geist-mono), "Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
			'jetbrains-mono': 'var(--font-jetbrains-mono), "JetBrains Mono", var(--font-geist-mono), "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
			'roboto-mono': 'var(--font-roboto-mono), "Roboto Mono", var(--font-geist-mono), "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
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
		style.setProperty('--canvas-warm', 'color-mix(in srgb, var(--canvas) 92%, var(--crm-accent) 8%)');
		style.setProperty('--surface', 'color-mix(in srgb, var(--canvas) 96%, white 4%)');
		style.setProperty('--surface-muted', 'color-mix(in srgb, var(--surface) 92%, var(--ink) 8%)');
		style.setProperty('--ink-muted', 'color-mix(in srgb, var(--ink) 64%, var(--canvas) 36%)');
		style.setProperty('--line', 'color-mix(in srgb, var(--ink) 14%, var(--canvas) 86%)');
		style.setProperty('--line-soft', 'color-mix(in srgb, var(--ink) 9%, var(--canvas) 91%)');
		style.setProperty('--line-strong', 'color-mix(in srgb, var(--ink) 24%, var(--canvas) 76%)');
		style.setProperty('--sage-soft', 'color-mix(in srgb, var(--sage) 14%, var(--canvas) 86%)');
		style.setProperty('--sage-line', 'color-mix(in srgb, var(--sage) 30%, var(--canvas) 70%)');
		style.setProperty('--warning-soft', 'color-mix(in srgb, var(--warning) 14%, var(--canvas) 86%)');
		style.setProperty('--warning-line', 'color-mix(in srgb, var(--warning) 30%, var(--canvas) 70%)');
		style.setProperty('--danger-soft', 'color-mix(in srgb, var(--danger) 14%, var(--canvas) 86%)');
		style.setProperty('--danger-line', 'color-mix(in srgb, var(--danger) 30%, var(--canvas) 70%)');
		style.setProperty('--success-soft', 'color-mix(in srgb, var(--success) 14%, var(--canvas) 86%)');
		style.setProperty('--success-line', 'color-mix(in srgb, var(--success) 30%, var(--canvas) 70%)');
		style.setProperty('--shadow-sage', 'color-mix(in srgb, var(--sage) 20%, transparent)');
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
		<html lang="ru" suppressHydrationWarning>
			<body
				className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${manrope.variable} ${nunitoSans.variable} ${roboto.variable} ${ibmPlexSans.variable} ${playfair.variable} ${merriweather.variable} ${jetbrainsMono.variable} ${robotoMono.variable}`}
			>
				<script dangerouslySetInnerHTML={{ __html: themeHydrationScript }} />
				<ThemeProviders>{children}</ThemeProviders>
			</body>
		</html>
	)
}
