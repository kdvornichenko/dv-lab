import type { Dispatch, SetStateAction } from 'react'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

export type ThemeShapeControlsProps = {
	draft: CrmThemeSettings
	onDraftChange: Dispatch<SetStateAction<CrmThemeSettings>>
}

export type RadiusButtonProps = {
	active: boolean
	label: string
	onSelect: () => void
	preview: string
}
