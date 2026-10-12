'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'

import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { AnimatePresence, motion } from 'framer-motion'

import { FluidHoverHighlight } from '@/components/fluid-hover-highlight'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFluidHover } from '@/hooks/use-fluid-hover'
import { useKeyboardNavGate } from '@/hooks/use-keyboard-nav-gate'
import { Elevated } from '@/lib/elevated'
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

import { SelectContentContext, popupShape, useSelectContext } from './context'

interface SelectContentProps {
	className?: string
	children: ReactNode
}

const SelectContent = forwardRef<HTMLDivElement, SelectContentProps>(({ className, children }, ref) => {
	const { open, value, actionsRef } = useSelectContext()
	const shape = popupShape
	const containerRef = useRef<HTMLDivElement>(null)
	const compactFade = useCompactFade(containerRef, open)

	const hover = useFluidHover(containerRef, { isItemDisabled: isDisabledRow, holdInGaps: true })
	const { activeIndex, setActiveIndex, itemRects, isMeasured, handlers, registerItem, remeasure } = hover

	const [focusedIndex, setFocusedIndex] = useState<number | null>(null)

	const { keyboardNavRef, trackKeyboardNav } = useKeyboardNavGate(open)
	const [checkedIndex, setCheckedIndex] = useState<number | undefined>(undefined)

	useEffect(() => {
		if (open) return
		const id = setTimeout(() => actionsRef.current?.unmount(), exitFallbackMs(spring.fast))
		return () => clearTimeout(id)
	}, [open, actionsRef])

	useEffect(() => {
		if (!open) return
		remeasure()
	}, [open, remeasure])

	useEffect(() => {
		if (!open) return

		let inner: number
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => {
				const container = containerRef.current
				if (container) {
					const items = Array.from(container.querySelectorAll('[data-fluid-hover-index]')) as HTMLElement[]
					const idx = items.findIndex((el) => el.getAttribute('data-value') === value)
					setCheckedIndex(idx !== -1 ? idx : undefined)
				}
			})
		})
		return () => {
			cancelAnimationFrame(outer)
			cancelAnimationFrame(inner)
		}
	}, [open, value])

	const [overlaysOpen, setOverlaysOpen] = useState(open)
	if (overlaysOpen !== open) {
		setOverlaysOpen(open)
		if (!open) {
			setCheckedIndex(undefined)
			setActiveIndex(null)
			setFocusedIndex(null)
		}
	}

	const checkedRect = isMeasured && checkedIndex != null ? itemRects[checkedIndex] : null
	const focusRect = isMeasured && focusedIndex !== null ? itemRects[focusedIndex] : null

	const contentCtx = useMemo(
		() => ({ registerItem, activeIndex, checkedIndex }),
		[registerItem, activeIndex, checkedIndex]
	)

	return (
		<SelectPrimitive.Portal>
			<SelectPrimitive.Positioner
				side="bottom"
				align="start"
				sideOffset={6}
				alignItemWithTrigger={false}
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
					<SelectContentContext.Provider value={contentCtx}>
						<SelectPrimitive.Popup
							render={<Elevated offset={2} shadowLevel={4} ref={ref} />}

							onKeyDownCapture={trackKeyboardNav}
							onMouseEnter={() => {
								handlers.onMouseEnter()
								setFocusedIndex(null)
							}}
							onMouseMove={handlers.onMouseMove}
							onMouseLeave={handlers.onMouseLeave}
							onClick={handlers.onClick}
							onFocus={(e) => {
								const indexAttr = (e.target as HTMLElement)
									.closest('[data-fluid-hover-index]')
									?.getAttribute('data-fluid-hover-index')
								if (indexAttr != null) {
									const idx = Number(indexAttr)
									setActiveIndex(idx)
									setFocusedIndex(
										keyboardNavRef.current && (e.target as HTMLElement).matches(':focus-visible') ? idx : null
									)
								}
							}}
							onBlur={(e) => {
								if (e.currentTarget.contains(e.relatedTarget as Node)) return
								setFocusedIndex(null)
								setActiveIndex(null)
							}}
							className={cn(
								`flex max-h-[min(300px,var(--available-height))] min-w-[var(--anchor-width)] flex-col overflow-hidden ${shape.container} outline-none select-none`,
								className
							)}
						>
							<ScrollArea
								className={cn(popupScrollAreaClass, compactFade && popupCompactFadeClass)}
								viewportClassName={cn(popupViewportClass, 'scroll-fade')}
							>
								<div ref={containerRef} className="relative flex flex-col p-1">
									{open && (
										<AnimatePresence>
											{checkedRect && (
												<motion.div
													className={`absolute ${shape.bg} pointer-events-none bg-active`}

													initial={false}
													animate={{
														top: checkedRect.top,
														left: checkedRect.left,
														width: checkedRect.width,
														height: checkedRect.height,
														opacity: 1,
													}}
													exit={{ opacity: 0, transition: spring.moderate.exit }}
													transition={{
														...spring.moderate,
														opacity: { duration: 0.08 },
													}}
												/>
											)}
										</AnimatePresence>
									)}

									<FluidHoverHighlight hover={hover} hidden={!open} className={shape.bg} />

									{open && (
										<AnimatePresence>
											{focusRect && (
												<motion.div
													className={`absolute ${shape.focusRing} pointer-events-none z-20 border border-[color:var(--focus-ring,#6B97FF)]`}
													initial={false}
													animate={{
														left: focusRect.left - 2,
														top: focusRect.top - 2,
														width: focusRect.width + 4,
														height: focusRect.height + 4,
													}}
													exit={{ opacity: 0, transition: spring.fast.exit }}
													transition={{
														...spring.fast,
														opacity: { duration: 0.08 },
													}}
												/>
											)}
										</AnimatePresence>
									)}

									{children}
								</div>
							</ScrollArea>
						</SelectPrimitive.Popup>
					</SelectContentContext.Provider>
				</motion.div>
			</SelectPrimitive.Positioner>
		</SelectPrimitive.Portal>
	)
})

SelectContent.displayName = 'SelectContent'

export { SelectContent, type SelectContentProps }
