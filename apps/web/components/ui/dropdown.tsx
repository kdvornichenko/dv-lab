'use client'

import { forwardRef, useMemo, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'

import { AnimatePresence, motion } from 'framer-motion'

import { FluidHoverHighlight } from '@/components/fluid-hover-highlight'
import { DropdownEmpty, DropdownSearch, type DropdownSearchProps } from '@/components/ui/dropdown-search'
import { type DropdownSubTriggerProps } from '@/components/ui/dropdown-sub'
import {
	DropdownContext,
	useDropdown,
	useDropdownMaybe,
	type DropdownContextValue,
	type MenuItemRenderOptions,
} from '@/components/ui/menu-item'
import { useFluidHover } from '@/hooks/use-fluid-hover'
import { SelectionBackgrounds, useMergeSplitBlocks, useSelectionRuns } from '@/hooks/use-merge-split'
import { Elevated } from '@/lib/elevated'
import { isDisabledRow } from '@/lib/popup'
import { SizeProvider, typeClass, useSize, type SizeVariant } from '@/lib/size-context'
import { spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

import { DropdownContent, type DropdownContentProps } from './dropdown/content'
import { shape } from './dropdown/context'
import {
	DropdownMenu,
	DropdownSub,
	DropdownSubContent,
	DropdownSubTrigger,
	DropdownTrigger,
	type DropdownMenuProps,
	type DropdownSubContentProps,
	type DropdownSubProps,
	type DropdownTriggerProps,
} from './dropdown/menu'

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
	DropdownContent,
	DropdownEmpty,
	DropdownLabel,
	DropdownMenu,
	DropdownSearch,
	DropdownSeparator,
	DropdownSub,
	DropdownSubContent,
	DropdownSubTrigger,
	DropdownTrigger,
}
export type {
	DropdownContentProps,
	DropdownMenuProps,
	DropdownProps,
	DropdownSearchProps,
	DropdownSubContentProps,
	DropdownSubProps,
	DropdownSubTriggerProps,
	DropdownTriggerProps,
}
export default Dropdown
