'use client'

import { createContext, useContext } from 'react'

import { shapeMap } from '@/lib/shape-context'

interface SelectContextValue {
	value: string
	open: boolean
	actionsRef: React.RefObject<{ unmount: () => void } | null>
}

const SelectContext = createContext<SelectContextValue | null>(null)

function useSelectContext() {
	const ctx = useContext(SelectContext)
	if (!ctx) throw new Error('Select compound components must be inside <Select>')
	return ctx
}

interface SelectContentContextValue {
	registerItem: (index: number, element: HTMLElement | null) => void
	activeIndex: number | null
	checkedIndex?: number
}

const SelectContentContext = createContext<SelectContentContextValue | null>(null)

const popupShape = shapeMap.rounded

export { popupShape, SelectContentContext, SelectContext, useSelectContext }
