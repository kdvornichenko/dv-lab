'use client'

import * as React from 'react'

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

import { SidebarSettingsProvider } from '@/components/SidebarSettingsProvider'
import { ThemeSettingsProvider } from '@/components/ThemeSettingsProvider'
import { PrivacyModeProvider } from '@/components/PrivacyModeProvider'
import { Toaster } from '@/components/ui/sonner'

export function ThemeProviders({
	children,
	themeProps,
}: {
	children: React.ReactNode
	themeProps?: ThemeProviderProps
}) {
	return (
		<NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} {...themeProps}>
			<ThemeSettingsProvider>
				<PrivacyModeProvider>{children}</PrivacyModeProvider>
				<Toaster position="top-right" />
			</ThemeSettingsProvider>
		</NextThemesProvider>
	)
}

export function WorkspaceProviders({ children }: { children: React.ReactNode }) {
	return <SidebarSettingsProvider>{children}</SidebarSettingsProvider>
}
