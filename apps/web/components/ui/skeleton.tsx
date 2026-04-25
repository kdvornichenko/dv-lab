import { motion } from 'motion/react'

import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<typeof motion.div>) {
	return (
		<motion.div
			data-slot="skeleton"
			className={cn('bg-accent rounded-md', className)}
			initial={{ opacity: 0.7 }}
			animate={{ opacity: [0.55, 0.9, 0.55] }}
			transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
			{...props}
		/>
	)
}

export { Skeleton }
