'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

import type { MenuItemProps } from '@/components/ui/menu-item'
import type { UseFluidHoverReturn } from '@/hooks/use-fluid-hover'
import { useIcons } from '@/lib/icon-context'
import { useSize } from '@/lib/size-context'
import { cn } from '@/lib/utils'

export const SUBMENU_SIDE_OFFSET = 6
export const SUBMENU_ALIGN_OFFSET = -4
export type DropdownSubTriggerProps = Omit<MenuItemProps, 'checked' | 'onSelect' | 'closeOnClick'>
const ROW_SELECTOR = '[data-fluid-hover-index]'
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect
export function useSubmenuHost(
	containerRef: RefObject<HTMLElement | null>,
	hover: Pick<UseFluidHoverReturn, 'setActiveIndex' | 'handlers'>,
	open: boolean
) {
	const { setActiveIndex } = hover
	const { onMouseEnter: hoverEnter, onMouseMove: hoverMove, onMouseLeave: hoverLeave } = hover.handlers
	const openIndexRef = useRef<number | null>(null)
	const parentOpenRef = useRef(open)
	useIsoLayoutEffect(() => {
		parentOpenRef.current = open
	}, [open])
	const pointerRef = useRef<{
		x: number
		y: number
	} | null>(null)
	const stopListeningRef = useRef<(() => void) | null>(null)
	const listen = useCallback(() => {
		if (stopListeningRef.current) return
		const onMove = (e: PointerEvent) => {
			pointerRef.current = { x: e.clientX, y: e.clientY }
		}
		document.addEventListener('pointermove', onMove, { capture: true, passive: true })
		stopListeningRef.current = () => {
			document.removeEventListener('pointermove', onMove, { capture: true })
			stopListeningRef.current = null
		}
	}, [])
	useEffect(() => () => stopListeningRef.current?.(), [])
	const onSubmenuOpenChange = useCallback(
		(index: number, open: boolean) => {
			if (open) {
				openIndexRef.current = index
				setActiveIndex(index)
				listen()
				return
			}
			if (openIndexRef.current !== index) return
			openIndexRef.current = null
			stopListeningRef.current?.()
			if (!parentOpenRef.current) return
			const container = containerRef.current
			if (!container) return
			const focused = (document.activeElement as HTMLElement | null)?.closest?.(ROW_SELECTOR)
			if (focused && container.contains(focused)) {
				setActiveIndex(Number(focused.getAttribute('data-fluid-hover-index')))
				return
			}
			const p = pointerRef.current
			const r = container.getBoundingClientRect()
			if (p && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom) {
				hoverMove({ clientX: p.x, clientY: p.y } as React.MouseEvent)
			} else {
				setActiveIndex(null)
			}
		},
		[containerRef, setActiveIndex, hoverMove, listen]
	)
	const holding = useCallback(() => openIndexRef.current !== null, [])
	const onMouseEnter = useCallback(() => {
		if (openIndexRef.current !== null) return
		hoverEnter()
	}, [hoverEnter])
	const onMouseMove = useCallback(
		(e: React.MouseEvent) => {
			pointerRef.current = { x: e.clientX, y: e.clientY }
			if (openIndexRef.current !== null) return
			hoverMove(e)
		},
		[hoverMove]
	)
	const onMouseLeave = useCallback(() => {
		if (openIndexRef.current !== null) return
		hoverLeave()
	}, [hoverLeave])
	return { onSubmenuOpenChange, holding, onMouseEnter, onMouseMove, onMouseLeave }
}
export function useReportSubmenu(
	onSubmenuOpenChange: ((index: number, open: boolean) => void) | undefined,
	index: number,
	open: boolean
) {
	useEffect(() => {
		if (!open || !onSubmenuOpenChange) return
		onSubmenuOpenChange(index, true)
		return () => onSubmenuOpenChange(index, false)
	}, [onSubmenuOpenChange, index, open])
}
export function SubmenuChevron({ lit }: { lit: boolean }) {
	const icons = useIcons()
	const ChevronRight = icons['chevron-right']
	const sizeClasses = useSize()
	return (
		<span aria-hidden="true" className="inline-grid shrink-0 rtl:-scale-x-100">
			<ChevronRight
				size={sizeClasses.icon}
				strokeWidth={lit ? 2 : 1.5}
				className={cn('transition-[color,stroke-width] duration-80', lit ? 'text-foreground' : 'text-muted-foreground')}
			/>
		</span>
	)
}
