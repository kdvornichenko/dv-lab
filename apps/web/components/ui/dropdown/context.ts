'use client'

import { createContext, useContext } from 'react'

import { shapeMap } from '@/lib/shape-context'

const shape = shapeMap.rounded

interface DropdownMenuActions {
	unmount: () => void
	close: () => void
}
interface DropdownMenuContextValue {
	open: boolean
	actionsRef: React.RefObject<DropdownMenuActions | null>
	sub: boolean
}
const DropdownMenuContext = createContext<DropdownMenuContextValue | null>(null)
function useDropdownMenuContext() {
	const ctx = useContext(DropdownMenuContext)
	if (!ctx) throw new Error('DropdownMenu compound components must be inside <DropdownMenu>')
	return ctx
}

export { type DropdownMenuActions, DropdownMenuContext, shape, useDropdownMenuContext }
