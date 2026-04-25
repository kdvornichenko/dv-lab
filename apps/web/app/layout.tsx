import type { ReactNode } from 'react'

import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
	title: 'Teacher English CRM',
	description: 'Students, lessons, attendance, payments, and calendar control for an English teacher.',
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>{children}</body>
		</html>
	)
}
