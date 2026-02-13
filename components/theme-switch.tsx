'use client'

import { FC } from 'react'

import { useTheme } from 'next-themes'

import { SunFilledIcon, MoonFilledIcon } from '@/components/icons'

export interface ThemeSwitchProps {
	className?: string
}

export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
	const { theme, setTheme } = useTheme()

	const toggleTheme = () => {
		setTheme(theme === 'light' ? 'dark' : 'light')
	}

	return (
		<button
			onClick={toggleTheme}
			className={`cursor-pointer px-px text-muted-foreground transition-opacity hover:opacity-80 ${className ?? ''}`}
			aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
		>
			{theme === 'light' ? <SunFilledIcon size={22} /> : <MoonFilledIcon size={22} />}
		</button>
	)
}
