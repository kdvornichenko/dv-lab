'use client'
import { Menu } from '@base-ui/react/menu'

import {
	forwardRef,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ComponentProps,
	type ReactNode,
} from 'react'

import { AnimatePresence, motion } from 'framer-motion'

import { FluidHoverHighlight } from '@/components/fluid-hover-highlight'
import { DropdownSearchHostContext, useDropdownSearchHost } from '@/components/ui/dropdown-search'
import { useSubmenuHost } from '@/components/ui/dropdown-sub'
import { DropdownContext, type MenuItemRenderOptions } from '@/components/ui/menu-item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isOwnEvent, useFluidHover } from '@/hooks/use-fluid-hover'
import { SelectionBackgrounds, useMergeSplitBlocks, useSelectionRuns } from '@/hooks/use-merge-split'
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

import { shape, useDropdownMenuContext } from './context'

type MenuPositionerProps = ComponentProps<typeof Menu.Positioner>
type LitBy = 'open' | 'pointer' | 'keyboard'
interface DropdownContentProps {
	children: ReactNode
	className?: string
	checkedIndex?: number
	checkedIndices?: number[]
	side?: MenuPositionerProps['side']
	align?: MenuPositionerProps['align']
	sideOffset?: number
	alignOffset?: number
}
const DropdownContent = forwardRef<HTMLDivElement, DropdownContentProps>(
	(
		{
			className,
			children,
			checkedIndex,
			checkedIndices,
			side = 'bottom',
			align = 'start',
			sideOffset = 6,
			alignOffset = 0,
		},
		ref
	) => {
		const { open, actionsRef, sub } = useDropdownMenuContext()
		const containerRef = useRef<HTMLDivElement>(null)
		const compactFade = useCompactFade(containerRef, open)
		const hover = useFluidHover(containerRef, { isItemDisabled: isDisabledRow })
		const { activeIndex, setActiveIndex, itemRects, handlers, registerItem, remeasure } = hover
		const submenus = useSubmenuHost(containerRef, hover, open)
		const {
			host: searchHost,
			hasSearch,
			searchTakesFocus,
			searchMounted,
			onKeyDownCapture: redirectTypingToSearch,
		} = useDropdownSearchHost(open)
		useEffect(() => {
			if (!open || sub) return
			let inner: number | undefined
			const outer = requestAnimationFrame(() => {
				inner = requestAnimationFrame(() => {
					if (hasSearch()) return
					const container = containerRef.current
					if (!container || (container.contains(document.activeElement) && document.activeElement !== container)) return
					const first = container.querySelector<HTMLElement>(
						'[role="menuitem"]:not([aria-disabled="true"]), [role="menuitemradio"]:not([aria-disabled="true"]), [role="menuitemcheckbox"]:not([aria-disabled="true"])'
					)
					first?.focus()
				})
			})
			return () => {
				cancelAnimationFrame(outer)
				if (inner !== undefined) cancelAnimationFrame(inner)
			}
		}, [open, sub, hasSearch])
		useEffect(() => {
			if (open) return
			const id = setTimeout(() => actionsRef.current?.unmount(), exitFallbackMs(spring.fast))
			return () => clearTimeout(id)
		}, [open, actionsRef])
		useEffect(() => {
			if (!open) return
			remeasure()
		}, [open, remeasure])
		const multiple = checkedIndices != null
		const checkedRect = !multiple && checkedIndex != null ? itemRects[checkedIndex] : null
		const litByRef = useRef<LitBy>('open')
		const [litBy, setLitBy] = useState<LitBy>('open')
		const [litByOpen, setLitByOpen] = useState(open)
		if (litByOpen !== open) {
			setLitByOpen(open)
			if (open) setLitBy('open')
		}
		useEffect(() => {
			if (open) litByRef.current = 'open'
		}, [open])
		const markLitBy = (by: LitBy) => {
			litByRef.current = by
			setLitBy(by)
		}
		const runs = useSelectionRuns(checkedIndices ?? [])
		const blocks = useMergeSplitBlocks(runs, open ? itemRects : [], shape.bgRadius)
		const renderMenuItem = useCallback(
			({
				radio,
				checkbox,
				checked,
				value,
				disabled,
				label,
				closeOnClick,
				onActivate,
				element,
				children,
			}: MenuItemRenderOptions) =>
				checkbox ? (
					<Menu.CheckboxItem
						checked={!!checked}
						disabled={disabled}
						label={label}
						closeOnClick={closeOnClick}
						onClick={onActivate}
						render={element}
					>
						{children}
					</Menu.CheckboxItem>
				) : radio ? (
					<Menu.RadioItem
						value={value}
						disabled={disabled}
						label={label}
						closeOnClick={closeOnClick}
						onClick={onActivate}
						render={element}
					>
						{children}
					</Menu.RadioItem>
				) : (
					<Menu.Item
						disabled={disabled}
						label={label}
						closeOnClick={closeOnClick}
						onClick={onActivate}
						render={element}
					>
						{children}
					</Menu.Item>
				),
			[]
		)
		const contentCtx = useMemo(
			() => ({
				registerItem,
				activeIndex,
				checkedIndex,
				multiple,
				checkedIndices,
				inMenu: true,
				renderMenuItem,
				onSubmenuOpenChange: submenus.onSubmenuOpenChange,
			}),
			[registerItem, activeIndex, checkedIndex, multiple, checkedIndices, renderMenuItem, submenus.onSubmenuOpenChange]
		)
		return (
			<Menu.Portal>
				<Menu.Positioner
					side={side}
					align={align}
					sideOffset={sideOffset}
					alignOffset={alignOffset}
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
						<DropdownContext.Provider value={contentCtx}>
							<DropdownSearchHostContext.Provider value={searchHost}>
								<Menu.Popup
									render={<Elevated offset={2} shadowLevel={3} ref={ref} />}
									onKeyDownCapture={(e) => {
										if (!isOwnEvent(e)) return
										markLitBy('keyboard')
										redirectTypingToSearch(e)
									}}
									onMouseEnter={(e) => {
										if (!isOwnEvent(e)) return
										markLitBy('pointer')
										submenus.onMouseEnter()
									}}
									onMouseMove={(e) => {
										if (!isOwnEvent(e)) return
										markLitBy('pointer')
										submenus.onMouseMove(e)
									}}
									onClick={handlers.onClick}
									onMouseLeave={(e) => {
										if (!isOwnEvent(e)) return
										submenus.onMouseLeave()
									}}
									onFocus={(e) => {
										if (!isOwnEvent(e)) return
										const indexAttr = (e.target as HTMLElement)
											.closest('[data-fluid-hover-index]')
											?.getAttribute('data-fluid-hover-index')
										if (indexAttr != null) {
											if (litByRef.current === 'open' && searchTakesFocus()) return
											setActiveIndex(Number(indexAttr))
										} else if (e.target !== e.currentTarget) {
											setActiveIndex(null)
										}
									}}
									onBlur={(e) => {
										if (!isOwnEvent(e)) return
										if (e.currentTarget.contains(e.relatedTarget as Node)) return
										if (submenus.holding()) return
										setActiveIndex(null)
									}}
									className={cn(
										`flex flex-col ${sub ? 'w-56' : 'w-72 min-w-[var(--anchor-width)]'} max-h-[min(480px,var(--available-height))] max-w-full overflow-hidden ${shape.container} outline-none select-none`,
										className
									)}
								>
									<ScrollArea
										className={cn(popupScrollAreaClass, compactFade && popupCompactFadeClass)}
										viewportClassName={cn(popupViewportClass, !searchMounted && 'scroll-fade')}
									>
										<div ref={containerRef} className="relative flex flex-col p-1">
											{multiple && <SelectionBackgrounds blocks={blocks} />}

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

											<FluidHoverHighlight
												hover={hover}
												from={litBy === 'pointer' ? checkedRect : null}
												className={shape.bg}
											/>

											<Menu.RadioGroup value={checkedIndex ?? null} className="contents">
												{children}
											</Menu.RadioGroup>
										</div>
									</ScrollArea>
								</Menu.Popup>
							</DropdownSearchHostContext.Provider>
						</DropdownContext.Provider>
					</motion.div>
				</Menu.Positioner>
			</Menu.Portal>
		)
	}
)
DropdownContent.displayName = 'DropdownContent'

export { DropdownContent, type DropdownContentProps }
