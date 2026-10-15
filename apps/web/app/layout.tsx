import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/jetbrains-mono'

import { Suspense, type ReactNode } from 'react'

import type { Metadata, Viewport } from 'next'

import { MotionFeatures } from '@/components/app/motion-features'
import { ScrollFadeFallback } from '@/components/app/scroll-fade-fallback'
import { ThemeProvider } from '@/components/app/theme-provider'

import './globals.css'

export const metadata: Metadata = {
	title: { default: 'dv-lab', template: '%s · dv-lab' },
	robots: { index: false, follow: false },
}

export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: '#fafafa' },
		{ media: '(prefers-color-scheme: dark)', color: '#171717' },
	],
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="app-scale font-sans antialiased">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<MotionFeatures>
						<div className="isolate">
							<Suspense fallback={null}>{children}</Suspense>
						</div>
					</MotionFeatures>
					<ScrollFadeFallback />
				</ThemeProvider>
			</body>
		</html>
	)
}
