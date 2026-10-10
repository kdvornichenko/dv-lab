import * as React from 'react'

import { cn } from '@/lib/utils'

const fieldRing = 'ring-1 ring-inset ring-input'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				'flex field-sizing-content min-h-16 w-full resize-none rounded-md bg-transparent px-3 py-2 text-body text-foreground transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-destructive',
				fieldRing,
				className
			)}
			{...props}
		/>
	)
}

export { Textarea }
