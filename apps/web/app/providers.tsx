'use client'

import type { FC } from 'react'

import { ThemeProvider as NextThemesProvider } from 'next-themes'

import { PrivacyModeProvider } from '@/components/PrivacyModeProvider'
import { SidebarSettingsProvider } from '@/components/SidebarSettingsProvider'
import { ThemeSettingsProvider } from '@/components/ThemeSettingsProvider'
import { WebsitePetProvider } from '@/components/pet/WebsitePetProvider'
import { Toaster } from '@/components/ui/sonner'

import type { ThemeProvidersProps, WorkspaceProvidersProps } from './providers.types'

export const ThemeProviders: FC<ThemeProvidersProps> = ({ children, themeProps }) => {
	return (
		<NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} {...themeProps}>
			<ThemeSettingsProvider>
				<PrivacyModeProvider>{children}</PrivacyModeProvider>
				<Toaster position="top-right" />
			</ThemeSettingsProvider>
		</NextThemesProvider>
	)
}

export const WorkspaceProviders: FC<WorkspaceProvidersProps> = ({ children }) => {
	return (
		<SidebarSettingsProvider>
			<WebsitePetProvider>{children}</WebsitePetProvider>
		</SidebarSettingsProvider>
	)
}
