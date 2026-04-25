'use client'

import * as React from 'react'

import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from 'next-themes'

import { SidebarSettingsProvider } from '@/components/SidebarSettingsProvider'

export function Providers({ children, themeProps }: { children: React.ReactNode; themeProps?: ThemeProviderProps }) {
	return (
		<NextThemesProvider attribute="class" defaultTheme="light" enableSystem={false} {...themeProps}>
			<SidebarSettingsProvider>{children}</SidebarSettingsProvider>
		</NextThemesProvider>
	)
}
