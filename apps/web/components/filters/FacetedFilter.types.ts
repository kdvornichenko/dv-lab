import type { ComponentProps, ReactNode } from 'react'

import type { Button } from '@/components/ui/button'

export type ButtonVariant = ComponentProps<typeof Button>['variant']

export type FacetedFilterOption = {
	value: string
	label: string
	count?: number
	keywords?: string[]
	leading?: ReactNode
}

export type FacetedFilterProps = {
	label: string
	value: string[]
	options: FacetedFilterOption[]
	onValueChange: (value: string[]) => void
	icon?: ReactNode
	mode?: 'single' | 'multiple'
	buttonVariant?: ButtonVariant
	searchPlaceholder?: string
	emptyText?: string
	className?: string
	contentClassName?: string
	renderOption?: (option: FacetedFilterOption, state: { selected: boolean }) => ReactNode
	renderSelected?: (options: FacetedFilterOption[]) => ReactNode
	active?: boolean
}
