'use client'
import {
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
	forwardRef,
	type HTMLAttributes,
	type ReactElement,
	type ReactNode,
} from 'react'

import { motion, AnimatePresence } from 'framer-motion'

import { useRegisterFluidHoverItem } from '@/hooks/use-fluid-hover'
import { fontWeights } from '@/lib/font-weight'
import type { IconComponent } from '@/lib/icon-context'
import { shapeMap } from '@/lib/shape-context'
import { useSize } from '@/lib/size-context'
import { cn } from '@/lib/utils'

const shape = shapeMap.rounded
export interface MenuItemRenderOptions {
	radio: boolean
	checkbox: boolean
	checked?: boolean
	value: number
	disabled?: boolean
	label: string
	closeOnClick: boolean
	onActivate?: (e: React.MouseEvent<HTMLDivElement>) => void
	element: ReactElement
	children: ReactNode
}
export interface DropdownContextValue {
	registerItem: (index: number, element: HTMLElement | null) => void
	activeIndex: number | null
	checkedIndex?: number
	multiple?: boolean
	checkedIndices?: number[]
	inMenu?: boolean
	renderMenuItem?: (opts: MenuItemRenderOptions) => ReactElement
	onSubmenuOpenChange?: (index: number, open: boolean) => void
}
export const DropdownContext = createContext<DropdownContextValue | null>(null)
export function useDropdown() {
	const ctx = useContext(DropdownContext)
	if (!ctx) throw new Error('useDropdown must be used within a Dropdown')
	return ctx
}
export function useDropdownMaybe() {
	return useContext(DropdownContext)
}
export function useControllableOpen(
	openProp: boolean | undefined,
	defaultOpen: boolean,
	onOpenChange?: (open: boolean) => void
) {
	const [internalOpen, setInternalOpen] = useState(defaultOpen)
	const open = openProp !== undefined ? openProp : internalOpen
	const setOpen = useCallback(
		(next: boolean) => {
			if (openProp === undefined) setInternalOpen(next)
			onOpenChange?.(next)
		},
		[openProp, onOpenChange]
	)
	return [open, setOpen] as const
}
export interface MenuItemProps extends HTMLAttributes<HTMLDivElement> {
	icon?: IconComponent
	label: string
	index: number
	checked?: boolean
	onSelect?: () => void
	disabled?: boolean
	closeOnClick?: boolean
}
const MenuItem = forwardRef<HTMLDivElement, MenuItemProps>(
	({ icon: Icon, label, index, checked, onSelect, disabled, closeOnClick, className, onClick, ...props }, ref) => {
		const internalRef = useRef<HTMLDivElement>(null)
		const { registerItem, activeIndex, checkedIndex, multiple, checkedIndices, renderMenuItem } = useDropdown()
		const isCheckbox = !!multiple && typeof checked === 'boolean'
		useRegisterFluidHoverItem(registerItem, index, internalRef)
		const isActive = activeIndex === index
		const sizeClasses = useSize()
		const mergeRef = (node: HTMLDivElement | null) => {
			;(internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
			if (typeof ref === 'function') ref(node)
			else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
		}
		const handleActivate = disabled
			? undefined
			: (e: React.MouseEvent<HTMLDivElement>) => {
					onClick?.(e)
					onSelect?.()
				}
		const itemClassName = cn(
			`relative z-10 flex ${sizeClasses.control} shrink-0 items-center ${sizeClasses.gap} ${shape.item} ${sizeClasses.itemPx} cursor-pointer outline-none`,
			disabled && 'pointer-events-none opacity-50',
			className
		)
		const content = (
			<>
				{Icon && (
					<span className="inline-grid">
						<span className="invisible col-start-1 row-start-1">
							<Icon size={sizeClasses.icon} strokeWidth={2} />
						</span>
						<Icon
							size={sizeClasses.icon}
							strokeWidth={isActive || checked ? 2 : 1.5}
							className={cn(
								'col-start-1 row-start-1 transition-[color,stroke-width] duration-80',
								isActive || checked ? 'text-foreground' : 'text-muted-foreground'
							)}
						/>
					</span>
				)}

				<span className={cn('inline-grid flex-1', sizeClasses.text)}>
					<span
						className="invisible col-start-1 row-start-1 [text-box:trim-both_cap_alphabetic]"
						style={{ fontVariationSettings: fontWeights.semibold }}
						aria-hidden="true"
					>
						{label}
					</span>
					<span
						className={cn(
							'col-start-1 row-start-1 transition-[color,font-variation-settings] duration-80 [text-box:trim-both_cap_alphabetic]',
							isActive || checked ? 'text-foreground' : 'text-muted-foreground'
						)}
						style={{
							fontVariationSettings: checked ? fontWeights.semibold : fontWeights.normal,
						}}
					>
						{label}
					</span>
				</span>

				<AnimatePresence initial={false}>
					{checked && (
						<motion.svg
							key="check"
							width={sizeClasses.icon}
							height={sizeClasses.icon}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
							className="shrink-0 text-foreground"
							initial={{ opacity: 1 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 1 }}
						>
							<motion.path
								d="M4 12L9 17L20 6"
								initial={{ pathLength: 0 }}
								animate={{
									pathLength: 1,
									transition: { duration: 0.08, ease: 'easeOut' },
								}}
								exit={{
									pathLength: 0,
									transition: { duration: 0.04, ease: 'easeIn' },
								}}
							/>
						</motion.svg>
					)}
				</AnimatePresence>
			</>
		)
		if (renderMenuItem) {
			return renderMenuItem({
				radio: !isCheckbox && typeof checked === 'boolean',
				checkbox: isCheckbox,
				checked,
				value: index,
				disabled,
				label,
				closeOnClick: closeOnClick ?? !multiple,
				onActivate: handleActivate,
				element: (
					<div ref={mergeRef} data-fluid-hover-index={index} aria-label={label} className={itemClassName} {...props} />
				),
				children: content,
			})
		}
		return (
			<div
				ref={mergeRef}
				data-fluid-hover-index={index}
				tabIndex={!disabled && index === (checkedIndex ?? checkedIndices?.[0] ?? 0) ? 0 : -1}
				role={isCheckbox ? 'menuitemcheckbox' : typeof checked === 'boolean' ? 'menuitemradio' : 'menuitem'}
				aria-checked={typeof checked === 'boolean' ? checked : undefined}
				aria-disabled={disabled || undefined}
				aria-label={label}
				onClick={handleActivate}
				onKeyDown={(e) => {
					if (disabled) return
					if (e.key === ' ' || e.key === 'Enter') {
						e.preventDefault()
						onSelect?.()
					}
				}}
				className={itemClassName}
				{...props}
			>
				{content}
			</div>
		)
	}
)
MenuItem.displayName = 'MenuItem'
export { MenuItem }
export default MenuItem
