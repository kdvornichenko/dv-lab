import type { ReactNode } from 'react'

import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

import './globals.css'

export const metadata = {
	title: 'dv-lab',
	robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
			<body className="font-sans">{children}</body>
		</html>
	)
}
