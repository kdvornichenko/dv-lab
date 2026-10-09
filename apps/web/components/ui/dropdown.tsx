'use client'
import { useDirection } from '@base-ui/react/direction-provider'
import { Menu } from '@base-ui/react/menu'
import type { MenuTriggerProps } from '@base-ui/react/menu'

import {
	useRef,
	useState,
	useEffect,
	useCallback,
	useMemo,
	createContext,
	useContext,
	forwardRef,
	type ReactNode,
	type HTMLAttributes,
	type ComponentProps,
} from 'react'

import { motion, AnimatePresence } from 'framer-motion'

import { FluidHoverHighlight } from '@/components/fluid-hover-highlight'
import {
	DropdownSearch,
	DropdownEmpty,
	DropdownSearchHostContext,
	useDropdownSearchHost,
	type DropdownSearchProps,
} from '@/components/ui/dropdown-search'
import {
	SUBMENU_SIDE_OFFSET,
	SUBMENU_ALIGN_OFFSET,
	useSubmenuHost,
	useReportSubmenu,
	SubmenuChevron,
	type DropdownSubTriggerProps,
} from '@/components/ui/dropdown-sub'
import {
	DropdownContext,
	MenuItem,
	useControllableOpen,
	useDropdown,
	useDropdownMaybe,
	type DropdownContextValue,
	type MenuItemRenderOptions,
} from '@/components/ui/menu-item'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useFluidHover, isOwnEvent } from '@/hooks/use-fluid-hover'
import { useMergeSplitBlocks, useSelectionRuns, SelectionBackgrounds } from '@/hooks/use-merge-split'
import { Elevated } from '@/lib/elevated'
import { popupMotionClass, popupScrollAreaClass, popupViewportClass, isDisabledRow } from '@/lib/popup'
import { shapeMap } from '@/lib/shape-context'
import { SizeProvider, useSize, typeClass, type SizeVariant } from '@/lib/size-context'
import { spring, exitFallbackMs } from '@/lib/springs'
import { cn } from '@/lib/utils'

const shape = shapeMap.rounded
export { useDropdown, useDropdownMaybe }
export type { DropdownContextValue, MenuItemRenderOptions }
interface DropdownProps extends HTMLAttributes<HTMLDivElement> {
	children: ReactNode
	checkedIndex?: number
	checkedIndices?: number[]
	size?: SizeVariant
}
const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
	({ children, checkedIndex, checkedIndices, size, className, ...props }, ref) => {
		const containerRef = useRef<HTMLDivElement>(null)
		const hover = useFluidHover(containerRef, { isItemDisabled: isDisabledRow })
		const { activeIndex, setActiveIndex, itemRects, handlers, registerItem } = hover
		const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
		const multiple = checkedIndices != null
		const checkedRect = !multiple && checkedIndex != null ? itemRects[checkedIndex] : null
		const focusRect = focusedIndex !== null ? itemRects[focusedIndex] : null
		const runs = useSelectionRuns(checkedIndices ?? [])
		const blocks = useMergeSplitBlocks(runs, itemRects, shape.bgRadius)
		const panelCtx = useMemo(
			() => ({ registerItem, activeIndex, checkedIndex, multiple, checkedIndices }),
			[registerItem, activeIndex, checkedIndex, multiple, checkedIndices]
		)
		const panel = (
			<DropdownContext.Provider value={panelCtx}>
				<Elevated
					offset={2}
					shadowLevel={3}
					ref={(node) => {
						;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
						if (typeof ref === 'function') ref(node)
						else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
					}}
					onMouseEnter={handlers.onMouseEnter}
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
							setFocusedIndex((e.target as HTMLElement).matches(':focus-visible') ? idx : null)
						}
					}}
					onBlur={(e) => {
						if (containerRef.current?.contains(e.relatedTarget as Node)) return
						setFocusedIndex(null)
						setActiveIndex(null)
					}}
					onKeyDown={(e) => {
						const items = Array.from(
							containerRef.current?.querySelectorAll(
								'[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]'
							) ?? []
						) as HTMLElement[]
						const currentIdx = items.indexOf(e.target as HTMLElement)
						if (currentIdx === -1) return
						if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) {
							e.preventDefault()
							const next = ['ArrowDown', 'ArrowRight'].includes(e.key)
								? (currentIdx + 1) % items.length
								: (currentIdx - 1 + items.length) % items.length
							items[next].focus()
						} else if (e.key === 'Home') {
							e.preventDefault()
							items[0]?.focus()
						} else if (e.key === 'End') {
							e.preventDefault()
							items[items.length - 1]?.focus()
						}
					}}
					role="group"
					className={cn(`relative flex w-72 max-w-full flex-col ${shape.container} p-1 select-none`, className)}
					{...props}
				>
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

					<FluidHoverHighlight hover={hover} from={checkedRect} className={shape.bg} />

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

					{children}
				</Elevated>
			</DropdownContext.Provider>
		)
		return size ? <SizeProvider size={size}>{panel}</SizeProvider> : panel
	}
)
Dropdown.displayName = 'Dropdown'
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
interface DropdownMenuProps {
	children: ReactNode
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
	disabled?: boolean
	size?: SizeVariant
}
function DropdownMenu({
	children,
	open: openProp,
	defaultOpen = false,
	onOpenChange,
	disabled = false,
	size,
}: DropdownMenuProps) {
	const [open, handleOpenChange] = useControllableOpen(openProp, defaultOpen, onOpenChange)
	const actionsRef = useRef<DropdownMenuActions | null>(null)
	const ctx = useMemo(() => ({ open, actionsRef, sub: false }), [open])
	const root = (
		<DropdownMenuContext.Provider value={ctx}>
			<Menu.Root open={open} onOpenChange={handleOpenChange} actionsRef={actionsRef} disabled={disabled} modal={false}>
				{children}
			</Menu.Root>
		</DropdownMenuContext.Provider>
	)
	return size ? <SizeProvider size={size}>{root}</SizeProvider> : root
}
DropdownMenu.displayName = 'DropdownMenu'
type DropdownTriggerProps = MenuTriggerProps
const DropdownTrigger = Menu.Trigger
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
										className={popupScrollAreaClass}
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
interface DropdownSubProps {
	children: ReactNode
	open?: boolean
	defaultOpen?: boolean
	onOpenChange?: (open: boolean) => void
}
function DropdownSub({ children, open: openProp, defaultOpen = false, onOpenChange }: DropdownSubProps) {
	const [open, handleOpenChange] = useControllableOpen(openProp, defaultOpen, onOpenChange)
	const actionsRef = useRef<DropdownMenuActions | null>(null)
	const ctx = useMemo(() => ({ open, actionsRef, sub: true }), [open])
	return (
		<DropdownMenuContext.Provider value={ctx}>
			<Menu.SubmenuRoot open={open} onOpenChange={handleOpenChange} actionsRef={actionsRef}>
				{children}
			</Menu.SubmenuRoot>
		</DropdownMenuContext.Provider>
	)
}
DropdownSub.displayName = 'DropdownSub'
const DropdownSubTrigger = forwardRef<HTMLDivElement, DropdownSubTriggerProps>(({ index, ...props }, ref) => {
	const parent = useDropdown()
	const { open } = useDropdownMenuContext()
	useReportSubmenu(parent.onSubmenuOpenChange, index, open)
	const lit = parent.activeIndex === index
	const renderMenuItem = useCallback(
		({ disabled, label, onActivate, element, children }: MenuItemRenderOptions) => (
			<Menu.SubmenuTrigger disabled={disabled} label={label} onClick={onActivate} render={element}>
				{children}
				<SubmenuChevron lit={lit} />
			</Menu.SubmenuTrigger>
		),
		[lit]
	)
	const ctx = useMemo(() => ({ ...parent, renderMenuItem }), [parent, renderMenuItem])
	return (
		<DropdownContext.Provider value={ctx}>
			<MenuItem ref={ref} index={index} {...props} />
		</DropdownContext.Provider>
	)
})
DropdownSubTrigger.displayName = 'DropdownSubTrigger'
type DropdownSubContentProps = Omit<DropdownContentProps, 'side' | 'align'>
const DropdownSubContent = forwardRef<HTMLDivElement, DropdownSubContentProps>(
	({ sideOffset = SUBMENU_SIDE_OFFSET, alignOffset = SUBMENU_ALIGN_OFFSET, ...props }, ref) => {
		const direction = useDirection()
		return (
			<DropdownContent
				ref={ref}
				side={direction === 'rtl' ? 'left' : 'right'}
				align="start"
				sideOffset={sideOffset}
				alignOffset={alignOffset}
				{...props}
			/>
		)
	}
)
DropdownSubContent.displayName = 'DropdownSubContent'
const DropdownLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
	const compact = useSize().variant === 'compact'
	return (
		<div
			ref={ref}
			className={cn(
				'shrink-0 px-2 py-1.5 text-muted-foreground',
				typeClass('caption', compact ? 'compact' : 'default'),
				className
			)}
			{...props}
		/>
	)
})
DropdownLabel.displayName = 'DropdownLabel'
const DropdownSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
	<div ref={ref} role="separator" className={cn('-mx-1 my-1 h-px shrink-0 bg-border/60', className)} {...props} />
))
DropdownSeparator.displayName = 'DropdownSeparator'
export {
	Dropdown,
	DropdownLabel,
	DropdownSeparator,
	DropdownMenu,
	DropdownTrigger,
	DropdownContent,
	DropdownSub,
	DropdownSubTrigger,
	DropdownSubContent,
	DropdownSearch,
	DropdownEmpty,
}
export type {
	DropdownProps,
	DropdownMenuProps,
	DropdownTriggerProps,
	DropdownContentProps,
	DropdownSubProps,
	DropdownSubTriggerProps,
	DropdownSubContentProps,
	DropdownSearchProps,
}
export default Dropdown
