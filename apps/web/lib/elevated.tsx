'use client'
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'

import { surfaceClasses } from '@/lib/surface-classes'
import { useSurface, SurfaceProvider } from '@/lib/surface-context'
import { cn } from '@/lib/utils'

interface ElevatedProps extends ComponentPropsWithoutRef<'div'> {
	offset: number
	shadowLevel?: number
	children?: ReactNode
}
const Elevated = forwardRef<HTMLDivElement, ElevatedProps>(
	({ offset, shadowLevel, className, children, ...props }, ref) => {
		const substrate = useSurface()
		const level = Math.min(substrate + offset, 8)
		return (
			<SurfaceProvider value={level}>
				<div ref={ref} className={cn(surfaceClasses(level, shadowLevel ?? level), className)} {...props}>
					{children}
				</div>
			</SurfaceProvider>
		)
	}
)
Elevated.displayName = 'Elevated'
export { Elevated }
