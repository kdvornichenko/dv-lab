'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'

import { forwardRef, type HTMLAttributes } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import type { IconComponent } from '@/lib/icon-context'
import { useSize, type SizeVariant } from '@/lib/size-context'
import { cn } from '@/lib/utils'

const fieldRing = 'ring-1 ring-inset ring-input'

const triggerVariants = cva(
	[
		'group hit-slop relative inline-flex cursor-pointer items-center justify-between rounded-md',
		'transition-all duration-80',
		'disabled:pointer-events-none disabled:opacity-50',
		'aria-invalid:ring-destructive',
	],
	{
		variants: {
			variant: {
				bordered: [fieldRing, 'bg-transparent text-foreground hover:bg-hover'],
				borderless: 'border border-transparent bg-transparent text-foreground hover:bg-hover',
			},
		},
		defaultVariants: {
			variant: 'bordered',
		},
	}
)

interface SelectTriggerProps
	extends Omit<HTMLAttributes<HTMLButtonElement>, 'children'>, VariantProps<typeof triggerVariants> {
	icon?: IconComponent
	placeholder?: string
	error?: string

	size?: SizeVariant
}

const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
	(
		{
			className,
			variant,
			icon: Icon,
			placeholder = 'Select…',
			error,
			size,
			id,
			'aria-describedby': describedBy,
			...props
		},
		ref
	) => {
		const sizeClasses = useSize(size)
		const compact = sizeClasses.variant === 'compact'
		const errorId = error && id ? `${id}-error` : undefined

		return (
			<div className="flex flex-col gap-2">
				<SelectPrimitive.Trigger
					ref={ref}
					id={id}
					aria-invalid={!!error || undefined}
					aria-describedby={errorId ?? describedBy}
					className={cn(
						triggerVariants({ variant }),
						sizeClasses.control,
						sizeClasses.field,
						sizeClasses.px,
						sizeClasses.gap,
						compact ? 'min-w-[128px]' : 'min-w-[160px]',
						className
					)}
					{...props}
				>
					<span className={cn('flex min-w-0 flex-1 items-center', sizeClasses.gap)}>
						{Icon && (
							<Icon
								size={sizeClasses.icon}
								strokeWidth={1.5}
								className="shrink-0 text-muted-foreground transition-[color,stroke-width] duration-80 group-hover:stroke-[2] group-hover:text-foreground"
							/>
						)}
						<SelectPrimitive.Value
							placeholder={placeholder}

							className="min-w-0 flex-1 truncate text-left leading-5 data-[placeholder]:text-muted-foreground"
						/>
					</span>

					<svg
						width={sizeClasses.icon}
						height={sizeClasses.icon}
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth={2}
						strokeLinecap="round"
						strokeLinejoin="round"
						className="shrink-0 text-muted-foreground transition-colors duration-80 group-hover:text-foreground"
					>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</SelectPrimitive.Trigger>
				{error && (
					<span id={errorId} className="text-caption text-destructive">
						{error}
					</span>
				)}
			</div>
		)
	}
)

SelectTrigger.displayName = 'SelectTrigger'

export { SelectTrigger, type SelectTriggerProps, triggerVariants }
