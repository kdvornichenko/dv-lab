import { Slot } from '@radix-ui/react-slot'

import * as React from 'react'

import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
	'group/badge duration-160 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:size-3! h-5.5 inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border border-transparent px-2 py-0.5 text-[0.72rem] font-semibold leading-none transition-[background-color,color,border-color,box-shadow,opacity] ease-out [&>svg]:pointer-events-none',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
				secondary: 'border-sage-line bg-sage-soft text-sage [a]:hover:bg-sage-soft/80',
				destructive:
					'bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
				outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
				ghost: 'text-muted-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
)

type BadgeTone = 'green' | 'amber' | 'neutral' | 'red' | 'blue'
type BaseBadgeProps = React.ComponentProps<'span'> & {
	asChild?: boolean
}
type BadgeProps = BaseBadgeProps &
	(
		| ({ tone: BadgeTone; variant?: never } & Omit<VariantProps<typeof badgeVariants>, 'variant'>)
		| ({ tone?: never } & VariantProps<typeof badgeVariants>)
	)

function Badge({ className, variant = 'default', tone, asChild = false, ...props }: BadgeProps) {
	const Comp = asChild ? Slot : 'span'

	return (
		<Comp
			data-slot="badge"
			data-variant={variant}
			className={cn(
				badgeVariants({ variant: tone ? 'outline' : variant }),
				tone === 'green' && 'border-success-line bg-success-soft text-success',
				tone === 'amber' && 'border-warning-line bg-warning-soft text-warning',
				tone === 'neutral' && 'border-line bg-surface-muted text-ink-muted',
				tone === 'red' && 'border-danger-line bg-danger-soft text-danger',
				tone === 'blue' && 'border-sage-line bg-sage-soft text-sage',
				className
			)}
			{...props}
		/>
	)
}

export { Badge, badgeVariants }
