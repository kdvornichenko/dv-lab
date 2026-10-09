'use client'

import { useSyncExternalStore } from 'react'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'

function subscribe() {
	return () => {}
}

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme()
	const mounted = useSyncExternalStore(
		subscribe,
		() => true,
		() => false
	)
	return (
		<Tooltip content="Light or dark theme" delayDuration={200}>
			<Button
				variant="ghost"
				size="icon-compact"
				aria-label="Dark theme"
				aria-pressed={mounted ? resolvedTheme === 'dark' : undefined}
				onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
			>
				<Sun className="dark:hidden" />
				<Moon className="hidden dark:block" />
			</Button>
		</Tooltip>
	)
}
