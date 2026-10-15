'use client'

import type { ReactNode } from 'react'

import { LazyMotion, domMin } from 'motion/react'

export function MotionFeatures({ children }: { children: ReactNode }) {
	return <LazyMotion features={domMin}>{children}</LazyMotion>
}
