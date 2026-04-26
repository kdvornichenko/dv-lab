import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
	({ className, ...props }, ref) => {
		return (
			<textarea
				className={cn(
					'border-line-strong bg-surface placeholder:text-ink-muted focus-visible:ring-ring/35 tab-sm:text-sm text-ink duration-160 focus-visible:border-ring flex min-h-24 w-full rounded-lg border px-3.5 py-2.5 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] transition-[background-color,border-color,color,box-shadow] ease-out focus-visible:outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
					className
				)}
				ref={ref}
				{...props}
			/>
		)
	}
)
Textarea.displayName = 'Textarea'

export { Textarea }
