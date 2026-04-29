import { Slot } from '@radix-ui/react-slot'

import * as React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
	"duration-160 focus-visible:border-ring focus-visible:ring-ring/45 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 focus-visible:ring-3 inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold outline-none transition-colors ease-out disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				primary: 'border-primary bg-primary text-primary-foreground hover:bg-primary/92 border',
				default: 'border-primary bg-primary text-primary-foreground hover:bg-primary/92 border',
				destructive:
					'border-destructive bg-destructive hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40 border text-white',
				outline:
					'border-line-strong bg-surface text-ink hover:border-sage-line hover:bg-sage-soft/70 hover:text-sage border',
				secondary:
					'border-sage-line bg-sage-soft text-secondary-foreground hover:border-sage hover:bg-sage-soft/80 hover:text-sage border',
				ghost: 'text-ink-muted hover:bg-sage-soft/70 hover:text-sage',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default: 'h-10 px-4 py-2 has-[>svg]:px-3.5',
				sm: 'h-8.5 gap-1.5 rounded-lg px-3 has-[>svg]:px-2.5',
				lg: 'h-11 rounded-lg px-6 has-[>svg]:px-4',
				icon: 'size-9 rounded-lg',
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
