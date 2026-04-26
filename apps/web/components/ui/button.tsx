import { Slot } from '@radix-ui/react-slot'

import * as React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
	"duration-160 focus-visible:border-ring focus-visible:ring-ring/45 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold outline-none transition-[transform,background-color,border-color,color,box-shadow,opacity] ease-[var(--ease-out)] focus-visible:ring-[3px] active:scale-[0.98] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				primary:
					'border-primary bg-primary text-primary-foreground hover:bg-primary/92 border shadow-[0_10px_24px_-18px_var(--shadow-sage)] hover:shadow-[0_16px_34px_-22px_var(--shadow-sage)]',
				default:
					'border-primary bg-primary text-primary-foreground hover:bg-primary/92 border shadow-[0_10px_24px_-18px_var(--shadow-sage)] hover:shadow-[0_16px_34px_-22px_var(--shadow-sage)]',
				destructive:
					'border-destructive bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 border text-white shadow-[0_10px_24px_-18px_rgba(166,66,53,0.55)]',
				outline:
					'border-line-strong bg-surface text-ink hover:border-sage-line hover:bg-sage-soft/70 hover:text-sage border shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]',
				secondary:
					'border-sage-line bg-sage-soft text-secondary-foreground hover:border-sage hover:bg-sage-soft/80 hover:text-sage border shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]',
				ghost: 'text-ink-muted hover:bg-sage-soft/70 hover:text-sage',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2 has-[>svg]:px-3.5',
				sm: 'h-8.5 gap-1.5 rounded-lg px-3 has-[>svg]:px-2.5',
				lg: 'h-11 rounded-lg px-6 has-[>svg]:px-4',
				icon: 'size-9 rounded-lg active:scale-[0.95]',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
)

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean
	}) {
	const Comp = asChild ? Slot : 'button'

	return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
