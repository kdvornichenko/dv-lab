import { Input as InputPrimitive } from '@base-ui/react/input'

import * as React from 'react'

import { cn } from '@/lib/utils'

const fieldRing = 'ring-1 ring-inset ring-input'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<InputPrimitive
			type={type}
			data-slot="input"
			className={cn(
				'h-9 w-full min-w-0 rounded-md bg-transparent px-3 text-body text-foreground transition-colors file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive',
				fieldRing,
				className
			)}
			{...props}
		/>
	)
}
export { Input }
