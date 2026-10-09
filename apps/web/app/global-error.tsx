'use client'

import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/jetbrains-mono'

import { ErrorPage } from '@/components/app/status-pages'
import { ThemeProvider } from '@/components/app/theme-provider'

import './globals.css'

export default function GlobalError() {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="app-scale font-sans antialiased">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
					<div className="isolate">
						<ErrorPage hardHomeLink onRefresh={() => window.location.reload()} />
					</div>
				</ThemeProvider>
			</body>
		</html>
	)
}
