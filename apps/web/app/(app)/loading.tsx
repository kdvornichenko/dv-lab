import { SkeletonFallback } from '@/components/app/skeleton-swap'
import { SkeletonText } from '@/components/ui/skeleton'

export default function Loading() {
	return (
		<SkeletonFallback>
			<div role="status" aria-label="Loading page" className="p-6">
				<SkeletonText />
			</div>
		</SkeletonFallback>
	)
}
