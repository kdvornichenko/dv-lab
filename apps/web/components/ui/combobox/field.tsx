'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox'

import { forwardRef, type InputHTMLAttributes } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { useIcons, type IconComponent } from '@/lib/icon-context'
import { useShape } from '@/lib/shape-context'
import { useSize, type SizeVariant } from '@/lib/size-context'
import { cn } from '@/lib/utils'

import { useComboboxContext } from './context'

const fieldRing = 'ring-1 ring-inset ring-input'

const fieldVariants = cva(
	[
		'group flex cursor-text items-center rounded-md ring-1 ring-inset',
		'transition-all duration-80',
		'focus-within:outline-1 focus-within:outline-offset-2 focus-within:outline-focus-ring',
		'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
	],
	{
		variants: {
			variant: {
				bordered: [fieldRing, 'bg-transparent hover:bg-hover'],

				borderless:
					'bg-transparent ring-transparent focus-within:bg-card focus-within:ring-border hover:bg-hover hover:ring-border',
			},
		},
		defaultVariants: {
			variant: 'bordered',
		},
	}
)

const fieldButtonClass =
	'flex shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors duration-80 hover:text-foreground focus-visible:ring-1 focus-visible:ring-[color:var(--focus-ring,#6B97FF)] data-[disabled]:pointer-events-none'

const clearButtonClass = cn(fieldButtonClass, 'transition-[color,background-color] hover:bg-hover active:bg-active')

interface ComboboxFieldProps
	extends
		Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'defaultValue' | 'onChange'>,
		VariantProps<typeof fieldVariants> {
	icon?: IconComponent
	placeholder?: string
	error?: string

	clearable?: boolean

	size?: SizeVariant
}

type ComboboxInputProps = ComboboxFieldProps

function FieldControls({ clearable, compact, iconSize }: { clearable: boolean; compact: boolean; iconSize: number }) {
	const icons = useIcons()
	const XIcon = icons.x
	const pill = useShape().variant === 'pill'
	return (
		<>
			{clearable && (
				<span className={cn('flex shrink-0 items-center justify-center', compact ? 'size-5' : 'size-6')}>
					<ComboboxPrimitive.Clear
						aria-label="Clear"
						className={cn(clearButtonClass, pill && 'rounded-full', compact ? 'size-5' : 'size-6')}
					>
						<XIcon size={iconSize} strokeWidth={1.5} />
					</ComboboxPrimitive.Clear>
				</span>
			)}

			<ComboboxPrimitive.Trigger
				aria-label="Open"
				tabIndex={-1}
				className={cn(fieldButtonClass, compact ? '-mr-px size-5' : '-mr-1 size-6')}
			>
				<svg
					width={iconSize}
					height={iconSize}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					className="transition-colors duration-80"
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</ComboboxPrimitive.Trigger>
		</>
	)
}

const ComboboxInput = forwardRef<HTMLInputElement, ComboboxInputProps>(
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
			onKeyDown,
			...props
		},
		ref
	) => {
		const sizeClasses = useSize(size)
		const compact = sizeClasses.variant === 'compact'
		const { anchorRef, open } = useComboboxContext()
		const errorId = error && id ? `${id}-error` : undefined

		return (
			<div className="flex flex-col gap-2">
				<ComboboxPrimitive.InputGroup
					ref={anchorRef}
					className={cn(
						fieldVariants({ variant }),
						sizeClasses.control,
						sizeClasses.gap,
						sizeClasses.px,
						compact ? 'min-w-[128px]' : 'min-w-[160px]',
						error && 'ring-destructive',
						className
					)}
				>
					{Icon && (
						<Icon
							size={sizeClasses.icon}
							strokeWidth={1.5}
							className="shrink-0 text-muted-foreground transition-[color,stroke-width] duration-80 group-focus-within:stroke-[2] group-focus-within:text-foreground"
						/>
					)}
					<ComboboxPrimitive.Input
						ref={ref}
						id={id}
						placeholder={placeholder}
						aria-invalid={!!error || undefined}
						aria-describedby={errorId ?? describedBy}
						className={cn(
							'min-w-0 flex-1 rounded-none bg-transparent font-[inherit] text-foreground outline-none placeholder:text-muted-foreground',
							sizeClasses.field,

							compact ? 'leading-5' : 'leading-6'
						)}
						{...props}
						onKeyDown={(event) => {
							onKeyDown?.(event)
							if (event.key !== 'Escape') return
							if (open) event.stopPropagation()
							else event.preventBaseUIHandler()
						}}
					/>
					<FieldControls clearable={clearable} compact={compact} iconSize={sizeClasses.icon} />
				</ComboboxPrimitive.InputGroup>
				{error && (
					<span id={errorId} className="text-caption text-destructive">
						{error}
					</span>
				)}
			</div>
		)
	}
)

ComboboxInput.displayName = 'ComboboxInput'

export {
	type ComboboxFieldProps,
	ComboboxInput,
	type ComboboxInputProps,
	FieldControls,
	fieldButtonClass,
	fieldVariants,
}
