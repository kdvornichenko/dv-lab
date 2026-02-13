import { Analytics } from '@vercel/analytics/react'

import { Metadata, Viewport } from 'next'

import { Navbar } from '@/components/navbar'
import { fontSans } from '@/config/fonts'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

import '../styles/globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
	title: {
		default: siteConfig.name,
		template: `%s - ${siteConfig.name}`,
	},
	description: siteConfig.description,
	icons: {
		icon: '/favicon.ico',
	},
}

export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: 'white' },
		{ media: '(prefers-color-scheme: dark)', color: 'black' },
	],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html suppressHydrationWarning lang="en">
			<head />
			<body className={cn('min-h-screen bg-background font-sans antialiased', fontSans.variable)}>
				<Providers themeProps={{ attribute: 'class', defaultTheme: 'dark' }}>
					<Analytics />
					<div className="relative flex h-screen flex-col">
						<Navbar />
						<main className="h-full w-full pt-20">{children}</main>
					</div>
				</Providers>
			</body>
		</html>
	)
}
