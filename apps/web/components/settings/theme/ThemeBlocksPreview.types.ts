import type { ReactNode } from 'react'

import type { CrmThemeSettings } from '@teacher-crm/api-types'

export type ThemeBlocksPreviewProps = {
	theme: CrmThemeSettings
}

export type PreviewMetricProps = {
	icon: ReactNode
	label: string
	value: string
}
