'use client'

import { type FC, useEffect } from 'react'

import type { PrivacyModeProviderProps } from './PrivacyModeProvider.types'

const PRIVACY_MODE_STORAGE_KEY = 'teacher-crm-privacy-mode'

function applyPrivacyMode(enabled: boolean) {
	document.documentElement.classList.toggle('privacy-mode', enabled)
}

function isPrivacyModeShortcut(event: KeyboardEvent) {
	const key = event.key.toLowerCase()
	return (event.ctrlKey || event.metaKey) && !event.altKey && (event.code === 'KeyH' || key === 'h' || key === 'р')
}

export const PrivacyModeProvider: FC<PrivacyModeProviderProps> = ({ children }) => {
	useEffect(() => {
		const initial = window.localStorage.getItem(PRIVACY_MODE_STORAGE_KEY) === 'true'
		applyPrivacyMode(initial)

		const handleKeyDown = (event: KeyboardEvent) => {
			if (!isPrivacyModeShortcut(event)) return
			event.preventDefault()
			event.stopPropagation()
			event.stopImmediatePropagation()
			const enabled = !document.documentElement.classList.contains('privacy-mode')
			applyPrivacyMode(enabled)
			window.localStorage.setItem(PRIVACY_MODE_STORAGE_KEY, String(enabled))
		}

		window.addEventListener('keydown', handleKeyDown, { capture: true })
		return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
	}, [])

	return children
}
