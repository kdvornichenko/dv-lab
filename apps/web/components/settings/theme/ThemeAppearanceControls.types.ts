import type { Dispatch, SetStateAction } from 'react'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

export type ThemeAppearanceControlsProps = {
	activePreset: string
	draft: CrmThemeSettings
	hasChanges: boolean
	isSaving: boolean
	onApplyPreset: (presetId: string) => void
	onColorChange: (key: keyof CrmThemeSettings['colors'], value: string) => void
	onDraftChange: Dispatch<SetStateAction<CrmThemeSettings>>
	onReset: () => void
	onSave: () => void
	onShuffle: () => void
	onUndo: () => void
}

export type FontSizeInputProps = {
	label: string
	value: number
	field: keyof CrmThemeSettings['fontSizes']
	onDraftChange: Dispatch<SetStateAction<CrmThemeSettings>>
}
