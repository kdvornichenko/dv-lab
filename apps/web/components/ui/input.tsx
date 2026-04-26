import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				'border-line-strong bg-surface selection:bg-primary selection:text-primary-foreground file:text-foreground placeholder:text-ink-muted tab-sm:text-sm text-ink duration-160 h-10 w-full min-w-0 rounded-lg border px-3.5 py-2 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] outline-none transition-[background-color,border-color,color,box-shadow] ease-[var(--ease-out)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
				'focus-visible:border-ring focus-visible:bg-surface focus-visible:ring-ring/35 focus-visible:ring-[3px]',
				'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
				className
			)}
			{...props}
		/>
	)
}

export { Input }
