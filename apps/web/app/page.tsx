'use client'

import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { Elevated } from '@/lib/elevated'

export default function Page() {
	const { resolvedTheme, setTheme } = useTheme()
	return (
		<main className="flex min-h-dvh items-center justify-center bg-surface-1 p-4">
			<Elevated offset={1} shadowLevel={2} className="flex flex-col items-start gap-4 rounded-2xl p-6">
				<h1 className="text-display font-semibold tracking-tight">dv-lab</h1>
				<p className="text-body text-muted-foreground">Workspace is being set up.</p>
				<Button variant="secondary" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
					Toggle theme
				</Button>
			</Elevated>
		</main>
	)
}
