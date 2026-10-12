import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/jetbrains-mono'

import { Suspense, type ReactNode } from 'react'

import type { Metadata } from 'next'

import { ThemeProvider } from '@/components/app/theme-provider'

import Loading from './(app)/loading'
import './globals.css'

export const metadata: Metadata = {
	title: { default: 'dv-lab', template: '%s · dv-lab' },
	robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="app-scale font-sans antialiased">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<div className="isolate">
						<Suspense fallback={<Loading />}>{children}</Suspense>
					</div>
				</ThemeProvider>
			</body>
		</html>
	)
}
