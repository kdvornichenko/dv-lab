'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import { forwardRef, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { motion } from 'framer-motion'

import { FluidHoverHighlight } from '@/components/fluid-hover-highlight'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFluidHover, type ItemRect } from '@/hooks/use-fluid-hover'
import { SelectionBackgrounds, useMergeSplitBlocks, useSelectionRuns } from '@/hooks/use-merge-split'
import { Elevated } from '@/lib/elevated'
import { useIcons } from '@/lib/icon-context'
import {
	isDisabledRow,
	popupCompactFadeClass,
	popupMotionClass,
	popupScrollAreaClass,
	popupViewportClass,
	useCompactFade,
} from '@/lib/popup'
import { exitFallbackMs, spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

import {
	ComboboxContentContext,
	ComboboxHighlightContext,
	ComboboxItemIndexContext,
	CREATE_VALUE,
	isCreateItem,
	itemValue,
	popupShape,
	useComboboxContext,
	type ComboboxItemData,
} from './context'
import { ComboboxEmpty, ComboboxItem } from './items'

const POPUP_SELECTOR = '[data-slot="combobox-popup"]'
const HIGHLIGHT_EXIT = { duration: 0.15 }

type PositionerProps = React.ComponentProps<typeof ComboboxPrimitive.Positioner>

interface ComboboxContentProps {
	className?: string
	children: ReactNode
	side?: PositionerProps['side']
	align?: PositionerProps['align']
	sideOffset?: number
}

const ComboboxContent = forwardRef<HTMLDivElement, ComboboxContentProps>(
	({ className, children, side = 'bottom', align = 'start', sideOffset = 4 }, ref) => {
		const { open, actionsRef, anchorRef } = useComboboxContext()

		useEffect(() => {
			if (open) return
			const id = setTimeout(() => actionsRef.current?.unmount(), exitFallbackMs(spring.fast))
			return () => clearTimeout(id)
		}, [open, actionsRef])

		return (
			<ComboboxPrimitive.Portal>
				<ComboboxPrimitive.Positioner
					anchor={anchorRef}
					side={side}
					align={align}
					sideOffset={sideOffset}
					className="z-50 outline-none"
				>
					<motion.div
						className={popupMotionClass}
						initial={{ opacity: 0, y: 'var(--popup-enter-y)', scaleY: 0.96 }}
						animate={open ? { opacity: 1, y: 0, scaleY: 1 } : { opacity: 0, y: 'var(--popup-enter-y)', scaleY: 0.96 }}
						transition={open ? spring.fast : spring.fast.exit}

						onAnimationComplete={() => {
							if (!open) actionsRef.current?.unmount()
						}}
					>
						<ComboboxPrimitive.Popup
							ref={ref}
							data-slot="combobox-popup"
							render={<Elevated offset={2} shadowLevel={4} />}
							className={cn(
								'flex max-h-72 w-[var(--anchor-width)] flex-col overflow-hidden rounded-xl p-1 outline-none select-none',
								className
							)}
						>
							{children}
						</ComboboxPrimitive.Popup>
					</motion.div>
				</ComboboxPrimitive.Positioner>
			</ComboboxPrimitive.Portal>
		)
	}
)

ComboboxContent.displayName = 'ComboboxContent'

interface ComboboxListProps {
	className?: string

	children: (item: ComboboxItemData, index: number) => ReactNode

	emptyTitle?: ReactNode
	emptyHint?: ReactNode
}

const ComboboxList = forwardRef<HTMLDivElement, ComboboxListProps>(
	({ className, children, emptyTitle, emptyHint }, ref) => {
		const { open, values, multiple, inputValue, createRow } = useComboboxContext()
		const highlight = useContext(ComboboxHighlightContext)
		const icons = useIcons()
		const PlusIcon = icons.plus
		const shape = popupShape
		const containerRef = useRef<HTMLDivElement>(null)
		const compactFade = useCompactFade(containerRef, open)

		const hover = useFluidHover(containerRef, { isItemDisabled: isDisabledRow, holdInGaps: true })
		const { activeIndex, setActiveIndex, itemRects, isMeasured, handlers, registerItem, remeasure } = hover

		const [checkedIndices, setCheckedIndices] = useState<number[]>([])

		useEffect(() => {
			if (!open) return
			remeasure()
		}, [open, remeasure])

		const [reflow, setReflow] = useState<{
			query: string
			armedRects: ItemRect[] | null
		}>(() => ({ query: inputValue, armedRects: null }))
		if (reflow.query !== inputValue) {
			setReflow({ query: inputValue, armedRects: itemRects })
		}
		const reflowSnap = reflow.armedRects !== null
		const reflowLanded = reflow.armedRects !== null && itemRects !== reflow.armedRects
		useEffect(() => {
			if (!reflowLanded) return
			const armed = reflow.armedRects
			const frame = requestAnimationFrame(() =>
				setReflow((r) => (r.armedRects === armed ? { ...r, armedRects: null } : r))
			)
			return () => cancelAnimationFrame(frame)
		}, [reflowLanded, reflow.armedRects])

		useEffect(() => {
			if (!open) return

			let inner: number
			const outer = requestAnimationFrame(() => {
				inner = requestAnimationFrame(() => {
					const container = containerRef.current
					if (container) {
						const rows = Array.from(container.querySelectorAll('[data-fluid-hover-index]')) as HTMLElement[]
						const next: number[] = []
						rows.forEach((el, i) => {
							if (values.includes(el.getAttribute('data-value') ?? '')) next.push(i)
						})
						setCheckedIndices(next)
					}
				})
			})
			return () => {
				cancelAnimationFrame(outer)
				cancelAnimationFrame(inner)
			}
		}, [open, values, inputValue])

		const pointerOwnedRef = useRef(false)
		const { onMouseMove: hoverMouseMove } = handlers
		const handleMouseMove = useCallback(
			(event: React.MouseEvent) => {
				pointerOwnedRef.current = true
				hoverMouseMove(event)
			},
			[hoverMouseMove]
		)

		useEffect(() => {
			pointerOwnedRef.current = false
		}, [open, inputValue])

		const { onMouseLeave: hoverMouseLeave } = handlers
		const handleMouseLeave = useCallback(
			(event: React.MouseEvent) => {
				const popup = containerRef.current?.closest(POPUP_SELECTOR)
				if (popup && event.relatedTarget instanceof Node && popup.contains(event.relatedTarget)) return
				hoverMouseLeave()
			},
			[hoverMouseLeave]
		)

		useEffect(() => {
			if (!open) return
			const popup = containerRef.current?.closest(POPUP_SELECTOR)
			if (!popup) return
			popup.addEventListener('mouseleave', hoverMouseLeave)
			return () => popup.removeEventListener('mouseleave', hoverMouseLeave)
		}, [open, hoverMouseLeave])

		useEffect(() => {
			if (highlight?.reason === 'keyboard') {
				pointerOwnedRef.current = false
				setActiveIndex(highlight.index)
				return
			}
			if (pointerOwnedRef.current) return
			if (!highlight) setActiveIndex(null)
			else if (highlight.reason === 'none') setActiveIndex(highlight.index)
		}, [highlight, setActiveIndex])

		const [overlaysOpen, setOverlaysOpen] = useState(open)
		if (overlaysOpen !== open) {
			setOverlaysOpen(open)
			if (!open) {
				setCheckedIndices([])
				setActiveIndex(null)
			}
		}

		const runs = useSelectionRuns(multiple ? checkedIndices : [])
		const blocks = useMergeSplitBlocks(runs, isMeasured && open ? itemRects : [], shape.bgRadius)

		const contentCtx = useMemo(() => ({ registerItem, activeIndex }), [registerItem, activeIndex])

		return (
			<ComboboxContentContext.Provider value={contentCtx}>
				<ScrollArea
					className={cn(popupScrollAreaClass, compactFade && popupCompactFadeClass)}
					viewportClassName={cn(popupViewportClass, 'scroll-fade')}
				>
					<ComboboxPrimitive.List
						ref={(node: HTMLDivElement | null) => {
							;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
							if (typeof ref === 'function') ref(node)
							else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
						}}
						onMouseEnter={handlers.onMouseEnter}
						onMouseMove={handleMouseMove}
						onMouseLeave={handleMouseLeave}
						onClick={handlers.onClick}
						className={cn('relative flex flex-col outline-none', className)}
					>
						{open && multiple && (
							<SelectionBackgrounds blocks={reflowSnap ? blocks.map((b) => ({ ...b, instant: true })) : blocks} />
						)}

						{open && (
							<FluidHoverHighlight
								hover={hover}
								exit={HIGHLIGHT_EXIT}
								className={cn(shape.bg, 'bg-active')}
								transition={reflowSnap ? false : undefined}
							/>
						)}

						<ComboboxPrimitive.Collection>
							{(item: ComboboxItemData, index: number) => (
								<ComboboxItemIndexContext.Provider key={itemValue(item)} value={index}>
									{isCreateItem(item) ? (
										<ComboboxItem value={CREATE_VALUE} icon={PlusIcon}>
											{createRow}
										</ComboboxItem>
									) : (
										children(item, index)
									)}
								</ComboboxItemIndexContext.Provider>
							)}
						</ComboboxPrimitive.Collection>
					</ComboboxPrimitive.List>
				</ScrollArea>
				{emptyTitle ? (
					<ComboboxEmpty>
						<div className="text-body text-muted-foreground">{emptyTitle}</div>
						{emptyHint ? <div className="text-caption text-muted-foreground">{emptyHint}</div> : null}
					</ComboboxEmpty>
				) : null}
			</ComboboxContentContext.Provider>
		)
	}
)

ComboboxList.displayName = 'ComboboxList'

export { ComboboxContent, type ComboboxContentProps, ComboboxList, type ComboboxListProps }
