'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import { forwardRef, useContext, useRef, type HTMLAttributes, type ReactNode } from 'react'

import { AnimatePresence, motion } from 'framer-motion'

import { useRegisterFluidHoverItem } from '@/hooks/use-fluid-hover'
import { type IconComponent } from '@/lib/icon-context'
import { useSize } from '@/lib/size-context'
import { cn } from '@/lib/utils'

import { ComboboxContentContext, ComboboxItemIndexContext, popupShape, useComboboxContext } from './context'

interface ComboboxItemProps extends HTMLAttributes<HTMLDivElement> {
	icon?: IconComponent

	value: string
	disabled?: boolean
	detail?: ReactNode
}

const ComboboxItem = forwardRef<HTMLDivElement, ComboboxItemProps>(
	({ className, children, icon: Icon, value, disabled = false, detail, ...props }, ref) => {
		const comboboxCtx = useComboboxContext()
		const contentCtx = useContext(ComboboxContentContext)
		const index = useContext(ComboboxItemIndexContext)
		const internalRef = useRef<HTMLDivElement>(null)
		const shape = popupShape
		const sizeClasses = useSize()
		const compact = sizeClasses.variant === 'compact'

		const registerItem = contentCtx?.registerItem
		useRegisterFluidHoverItem(registerItem, index, internalRef)

		const isActive = contentCtx?.activeIndex === index
		const isChecked = comboboxCtx.values.includes(value)

		const item = comboboxCtx.itemsByValue.get(value) ?? value

		return (
			<ComboboxPrimitive.Item
				value={item}
				index={index}
				disabled={disabled}
				render={
					<div
						ref={(node: HTMLDivElement | null) => {
							;(internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
							if (typeof ref === 'function') ref(node)
							else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
						}}
						data-fluid-hover-index={index}
						data-value={value}
						className={cn(
							`relative z-10 flex ${sizeClasses.control} shrink-0 items-center ${sizeClasses.gap} ${shape.item} ${sizeClasses.itemPx} ${sizeClasses.text} cursor-pointer outline-none select-none`,
							'transition-[color] duration-80',
							isActive || isChecked ? 'text-foreground' : 'text-muted-foreground',
							disabled && 'pointer-events-none opacity-50',
							className
						)}
						{...props}
					/>
				}
			>
				<span aria-hidden className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}>
					<AnimatePresence initial={false}>
						{isChecked && (
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
								className="text-foreground"
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
				</span>

				{Icon && (
					<Icon
						size={sizeClasses.icon}
						strokeWidth={isActive || isChecked ? 2 : 1.5}
						className="shrink-0 transition-[color,stroke-width] duration-80"
					/>
				)}

				<span className="-my-1 min-w-0 flex-1 truncate py-1 [text-box:trim-both_cap_alphabetic]">{children}</span>

				{detail ? <span className="shrink-0 text-muted-foreground">{detail}</span> : null}
			</ComboboxPrimitive.Item>
		)
	}
)

ComboboxItem.displayName = 'ComboboxItem'

interface ComboboxEmptyProps extends HTMLAttributes<HTMLDivElement> {
	allSelected?: ReactNode
}

const ComboboxEmpty = forwardRef<HTMLDivElement, ComboboxEmptyProps>(
	({ className, children, allSelected, ...props }, ref) => {
		const sizeClasses = useSize()
		const ctx = useComboboxContext()
		return (
			<ComboboxPrimitive.Empty
				ref={ref}
				className={cn('px-3 text-center text-muted-foreground [&:not(:empty)]:py-6', sizeClasses.text, className)}
				{...props}
			>
				{ctx.allSelected && allSelected !== undefined ? allSelected : children}
			</ComboboxPrimitive.Empty>
		)
	}
)

ComboboxEmpty.displayName = 'ComboboxEmpty'

export { ComboboxEmpty, type ComboboxEmptyProps, ComboboxItem, type ComboboxItemProps }
