'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'

import { forwardRef, useContext, useRef, type HTMLAttributes } from 'react'

import { AnimatePresence, m } from 'framer-motion'

import { useRegisterFluidHoverItem } from '@/hooks/use-fluid-hover'
import type { IconComponent } from '@/lib/icon-context'
import { typeClass, useSize } from '@/lib/size-context'
import { cn } from '@/lib/utils'

import { SelectContentContext, popupShape, useSelectContext } from './context'

interface SelectItemProps extends HTMLAttributes<HTMLDivElement> {
	icon?: IconComponent
	index: number
	value: string
	disabled?: boolean
}

const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
	({ className, children, icon: Icon, value, index, disabled = false, ...props }, ref) => {
		const selectCtx = useSelectContext()
		const contentCtx = useContext(SelectContentContext)
		const internalRef = useRef<HTMLDivElement>(null)
		const shape = popupShape
		const sizeClasses = useSize()
		const compact = sizeClasses.variant === 'compact'

		const registerItem = contentCtx?.registerItem
		useRegisterFluidHoverItem(registerItem, index, internalRef)

		const isActive = contentCtx?.activeIndex === index
		const isChecked = selectCtx.value === value

		return (
			<SelectPrimitive.Item
				value={value}
				disabled={disabled}
				label={typeof children === 'string' ? children : undefined}
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
				{Icon && (
					<Icon
						size={sizeClasses.icon}
						strokeWidth={isActive || isChecked ? 2 : 1.5}
						className="shrink-0 transition-[color,stroke-width] duration-80"
					/>
				)}

				<SelectPrimitive.ItemText
					render={<span className="-my-1 min-w-0 flex-1 truncate py-1 [text-box:trim-both_cap_alphabetic]" />}
				>
					{children}
				</SelectPrimitive.ItemText>

				<span aria-hidden className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}>
					<AnimatePresence initial={false}>
						{isChecked && (
							<m.svg
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
								<m.path
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
							</m.svg>
						)}
					</AnimatePresence>
				</span>
			</SelectPrimitive.Item>
		)
	}
)

SelectItem.displayName = 'SelectItem'

function SelectGroup({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
	return (
		<div role="group" className={className} {...props}>
			{children}
		</div>
	)
}

SelectGroup.displayName = 'SelectGroup'

const SelectLabel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
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

SelectLabel.displayName = 'SelectLabel'

const SelectSeparator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
	<div ref={ref} role="separator" className={cn('-mx-1 my-1 h-px shrink-0 bg-border/60', className)} {...props} />
))

SelectSeparator.displayName = 'SelectSeparator'

export { SelectGroup, SelectItem, type SelectItemProps, SelectLabel, SelectSeparator }
