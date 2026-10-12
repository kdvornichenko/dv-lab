'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useIsMobile } from '@/hooks/use-mobile'
import { SizeProvider } from '@/lib/size-context'

type Side = 'left' | 'right'
type Slots = Record<Side, HTMLElement | null>

const TopbarSlotContext = createContext<{
	slots: Slots
	register: (side: Side, node: HTMLElement | null) => void
} | null>(null)

export function TopbarSlotProvider({ children }: { children: ReactNode }) {
	const [slots, setSlots] = useState<Slots>({ left: null, right: null })
	const [register] = useState(
		() => (side: Side, node: HTMLElement | null) =>
			setSlots((current) => (current[side] === node ? current : { ...current, [side]: node }))
	)
	const value = useMemo(() => ({ slots, register }), [slots, register])
	return <TopbarSlotContext.Provider value={value}>{children}</TopbarSlotContext.Provider>
}

export function TopbarSlotTarget({ side, id, className }: { side: Side; id: string; className?: string }) {
	const register = useContext(TopbarSlotContext)?.register
	const ref = useCallback((node: HTMLElement | null) => register?.(side, node), [register, side])
	return <div id={id} ref={ref} className={className} />
}

export function useTopbarSlot(side: Side): HTMLElement | null {
	const context = useContext(TopbarSlotContext)
	const mobile = useIsMobile()
	if (context === null || mobile) return null
	return context.slots[side]
}

export function PageActions({ children }: { children: ReactNode }) {
	const slot = useTopbarSlot('right')
	if (slot !== null)
		return createPortal(
			<SizeProvider size="compact">
				<div className="flex items-center gap-2">{children}</div>
			</SizeProvider>,
			slot
		)
	return <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
}
