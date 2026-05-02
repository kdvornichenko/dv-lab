import type { Dispatch, SetStateAction } from 'react'

import { fontOptions } from '@/lib/theme/theme-settings'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

export type FontSettingKey = 'headingFont' | 'bodyFont' | 'numberFont'

export type FontSectionKey = 'heading' | 'body' | 'numbers'

export type ThemeFontStackedAccordionProps = {
	draft: CrmThemeSettings
	onDraftChange: Dispatch<SetStateAction<CrmThemeSettings>>
}

export type FontSection = {
	description: string
	key: FontSettingKey
	label: string
	sample: string
	value: CrmThemeSettings['headingFont']
	section: FontSectionKey
}

export type FontOptionButtonProps = {
	onSelect: () => void
	option: (typeof fontOptions)[number]
	sample: string
	selected: boolean
}
