import { Slot } from '@radix-ui/react-slot'

import * as React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
	'group/badge duration-160 focus-visible:border-ring focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:size-3! inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-xl border border-transparent px-2 py-0.5 text-xs font-medium transition-[background-color,color,border-color,box-shadow,opacity] ease-[var(--ease-out)] focus-visible:ring-[3px] [&>svg]:pointer-events-none',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
				secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
				destructive:
					'bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
				outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
				ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
				link: 'text-primary underline-offset-4 hover:underline',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
)

function Badge({
	className,
	variant = 'default',
	tone,
	asChild = false,
	...props
}: React.ComponentProps<'span'> &
	VariantProps<typeof badgeVariants> & {
		asChild?: boolean
		tone?: 'green' | 'amber' | 'neutral' | 'red' | 'blue'
	}) {
	const Comp = asChild ? Slot : 'span'

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(
				badgeVariants({ variant }),
				tone === 'green' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
				tone === 'amber' && 'border-amber-200 bg-amber-50 text-amber-700',
				tone === 'neutral' && 'border-zinc-200 bg-zinc-50 text-zinc-700',
				tone === 'red' && 'border-red-200 bg-red-50 text-red-700',
				tone === 'blue' && 'border-sky-200 bg-sky-50 text-sky-700',
				className
			)}
			{...props}
		/>
	)
}

export { Badge, badgeVariants }
