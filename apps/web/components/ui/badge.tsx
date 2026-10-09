'use client'
import { forwardRef, type HTMLAttributes } from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { useShape } from '@/lib/shape-context'
import { useSizeVariant } from '@/lib/size-context'
import { cn } from '@/lib/utils'

const badgeColors = {
	gray: '#a3a3a3',
	red: '#ef4444',
	orange: '#f97316',
	amber: '#f59e0b',
	yellow: '#eab308',
	lime: '#84cc16',
	green: '#22c55e',
	emerald: '#10b981',
	teal: '#14b8a6',
	cyan: '#06b6d4',
	blue: '#3b82f6',
	indigo: '#6366f1',
	violet: '#8b5cf6',
	purple: '#a855f7',
	fuchsia: '#d946ef',
	pink: '#ec4899',
	rose: '#f43f5e',
} as const
type BadgeColor = keyof typeof badgeColors
const badgeVariants = cva('inline-flex items-center whitespace-nowrap', {
	variants: {
		variant: {
			solid: '',
			dot: 'border border-border text-foreground',
		},
		size: {
			default: 'h-6 gap-1.5 px-2.5 text-[length:var(--fs-caption,12px)] leading-[var(--lh-caption,16px)]',
			compact: 'h-5 gap-1 px-2 text-[length:var(--fs-caption-compact,11px)] leading-[var(--lh-caption-compact,14px)]',
		},
	},
	defaultVariants: {
		variant: 'solid',
		size: 'default',
	},
})
type BadgeSizeCanonical = 'default' | 'compact'
type BadgeSize = BadgeSizeCanonical | 'sm' | 'md' | 'lg'
const legacySizeAliases: Partial<Record<BadgeSize, BadgeSizeCanonical>> = {
	sm: 'compact',
	md: 'default',
	lg: 'default',
}
interface BadgeProps
	extends Omit<HTMLAttributes<HTMLSpanElement>, 'color'>, Omit<VariantProps<typeof badgeVariants>, 'size'> {
	color?: BadgeColor
	size?: BadgeSize
}
const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
	({ className, variant = 'solid', size: sizeProp, color = 'gray', children, style, ...props }, ref) => {
		const shape = useShape()
		const contextSize = useSizeVariant()
		const size: BadgeSizeCanonical = sizeProp
			? (legacySizeAliases[sizeProp] ?? (sizeProp as BadgeSizeCanonical))
			: contextSize === 'compact'
				? 'compact'
				: 'default'
		const colorValue = badgeColors[color]
		const isSolid = variant === 'solid'
		const dotSize = size === 'compact' ? 6 : 7
		const colorStyle = isSolid
			? color === 'gray'
				? { backgroundColor: 'var(--accent)', color: 'var(--foreground)' }
				: {
						color: 'var(--foreground)',
						backgroundColor: `color-mix(in srgb, ${colorValue} 15%, var(--background))`,
					}
			: {}
		const dotColor = color === 'gray' ? 'var(--muted-foreground)' : colorValue
		return (
			<span
				ref={ref}
				className={cn(badgeVariants({ variant, size }), shape.item, className)}
				style={{ ...colorStyle, ...style }}
				{...props}
			>
				{!isSolid && (
					<span
						className="shrink-0 rounded-full"
						style={{
							width: dotSize,
							height: dotSize,
							backgroundColor: dotColor,
						}}
					/>
				)}

				<span className="[text-box:trim-both_cap_alphabetic]">{children}</span>
			</span>
		)
	}
)
Badge.displayName = 'Badge'
export { Badge, badgeVariants, badgeColors }
export type { BadgeProps, BadgeColor, BadgeSize }
