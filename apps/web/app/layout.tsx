import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

import { ThemeProvider } from '@/components/app/theme-provider'

import './globals.css'

export const metadata: Metadata = {
	title: { default: 'dv-lab', template: '%s · dv-lab' },
	robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
			<body className="font-sans antialiased">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<div className="isolate">{children}</div>
				</ThemeProvider>
			</body>
		</html>
	)
}
