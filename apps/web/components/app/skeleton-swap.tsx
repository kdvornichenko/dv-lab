import { ViewTransition, type ReactNode } from 'react'

export function SkeletonFallback({ children }: { children: ReactNode }) {
	return (
		<ViewTransition exit="skeleton-exit" default="none">
			{children}
		</ViewTransition>
	)
}

export function SkeletonContent({ children }: { children: ReactNode }) {
	return (
		<ViewTransition enter="content-enter" default="none">
			{children}
		</ViewTransition>
	)
}
