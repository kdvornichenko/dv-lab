'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import { forwardRef, useCallback, useRef } from 'react'

import { AnimatePresence, animate, m, useMotionValue } from 'motion/react'

import { useIcons } from '@/lib/icon-context'
import { useShape } from '@/lib/shape-context'
import { typeClass, useSize } from '@/lib/size-context'
import { spring } from '@/lib/springs'
import { cn } from '@/lib/utils'

import { itemLabel, itemValue, useComboboxContext, useIsoLayoutEffect, type ComboboxItemData } from './context'
import { FieldControls, fieldButtonClass, fieldVariants, type ComboboxFieldProps } from './field'

const chipRemoveClass = cn(fieldButtonClass, 'rounded hover:bg-active')

type ComboboxChipsProps = ComboboxFieldProps

function useChipRowHeight(padY: number) {
	const height = useMotionValue<number | 'auto'>('auto')
	const roRef = useRef<ResizeObserver | null>(null)
	const padRef = useRef(padY)
	useIsoLayoutEffect(() => {
		padRef.current = padY
	})
	const measure = useCallback(
		(el: HTMLDivElement | null) => {
			roRef.current?.disconnect()
			roRef.current = null
			if (!el) return
			const measure = () => {
				if (el.offsetHeight <= 0) return
				const target = el.offsetHeight + padRef.current
				if (height.get() === 'auto') height.set(target)
				else if (height.get() !== target) animate(height, target, spring.fast)
			}
			measure()
			const ro = new ResizeObserver(measure)
			ro.observe(el)
			roRef.current = ro
		},
		[height]
	)
	return { measure, height }
}

const ComboboxChips = forwardRef<HTMLInputElement, ComboboxChipsProps>(
	(
		{
			className,
			variant,
			icon: Icon,
			placeholder = 'Search…',
			error,
			clearable = false,
			size,
			id,
			'aria-describedby': describedBy,
			...props
		},
		ref
	) => {
		const icons = useIcons()
		const XIcon = icons.x
		const shape = useShape()
		const sizeClasses = useSize(size)
		const compact = sizeClasses.variant === 'compact'
		const { anchorRef, open, disabled, inputValue, values } = useComboboxContext()
		const { measure: measureChipRows, height: chipRowsHeight } = useChipRowHeight(compact ? 8 : 12)
		const errorId = error && id ? `${id}-error` : undefined

		return (
			<div className="flex flex-col gap-2">
				<ComboboxPrimitive.Chips
					ref={anchorRef}

					render={<m.div style={{ height: chipRowsHeight }} />}

					data-disabled={disabled || undefined}
					data-popup-open={open || undefined}
					className={cn(
						fieldVariants({ variant }),

						'transition-[color,background-color,border-radius,box-shadow,opacity]',

						'!items-start',
						compact ? 'min-h-7 py-1' : 'min-h-9 py-1.5',
						sizeClasses.gap,
						sizeClasses.px,
						compact ? 'min-w-[128px]' : 'min-w-[160px]',
						error && 'ring-destructive',
						className
					)}
				>
					{Icon && (
						<span className={cn('flex shrink-0 items-center', compact ? 'h-5' : 'h-6')}>
							<Icon
								size={sizeClasses.icon}
								strokeWidth={1.5}
								className="shrink-0 text-muted-foreground transition-[color,stroke-width] duration-80 group-focus-within:stroke-[2] group-focus-within:text-foreground"
							/>
						</span>
					)}
					<div
						ref={measureChipRows}
						className={cn(
							'relative flex min-w-0 flex-1 flex-wrap items-center gap-1',

							!Icon && values.length > 0 && '-ml-1'
						)}
					>
						<ComboboxPrimitive.Value>
							{(selected: ComboboxItemData[] | null) => (
								<>
									<AnimatePresence initial={false} mode="popLayout">
										{(selected ?? []).map((item) => {
											const label = itemLabel(item)
											return (
												<m.span
													key={itemValue(item)}
													layout
													initial={{ opacity: 0, scale: 0.9 }}
													animate={{ opacity: 1, scale: 1 }}
													exit={{ opacity: 0, scale: 0.9, pointerEvents: 'none', transition: spring.fast.exit }}
													transition={spring.fast}

													style={{ originX: 0 }}
													className="inline-flex max-w-full shrink-0"
												>
													<ComboboxPrimitive.Chip
														aria-label={label}
														className={cn(
															'inline-flex max-w-full shrink-0 items-center gap-0.5 bg-hover pr-0.5 pl-2 text-foreground outline-none',
															shape.variant === 'pill' ? 'rounded-full' : 'rounded-md',
															'focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)]',
															compact ? 'h-5' : 'h-6',
															typeClass('caption', compact ? 'compact' : 'default')
														)}
													>
														<span className="truncate">{label}</span>
														<ComboboxPrimitive.ChipRemove
															aria-label={`Remove ${label}`}
															className={cn(
																chipRemoveClass,
																shape.variant === 'pill' && 'rounded-full',
																compact ? 'size-4' : 'size-5'
															)}
														>
															<XIcon size={compact ? 10 : 12} strokeWidth={2} />
														</ComboboxPrimitive.ChipRemove>
													</ComboboxPrimitive.Chip>
												</m.span>
											)
										})}
									</AnimatePresence>

									<span className="flex min-w-6 flex-auto">
										<ComboboxPrimitive.Input
											ref={ref}
											id={id}
											size={Math.max(1, inputValue.length + 1)}
											placeholder={selected?.length ? undefined : placeholder}
											aria-invalid={!!error || undefined}
											aria-describedby={errorId ?? describedBy}
											className={cn(
												'w-full min-w-0 rounded-none bg-transparent font-[inherit] text-foreground outline-none placeholder:text-muted-foreground',
												sizeClasses.field,

												compact ? 'h-5 leading-5' : 'h-6 leading-6'
											)}
											{...props}
										/>
									</span>
								</>
							)}
						</ComboboxPrimitive.Value>
					</div>
					<FieldControls clearable={clearable} compact={compact} iconSize={sizeClasses.icon} />
				</ComboboxPrimitive.Chips>
				{error && (
					<span id={errorId} className="text-caption text-destructive">
						{error}
					</span>
				)}
			</div>
		)
	}
)

ComboboxChips.displayName = 'ComboboxChips'

export { ComboboxChips, type ComboboxChipsProps }
