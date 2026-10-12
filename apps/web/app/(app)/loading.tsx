import { SkeletonText } from '@/components/ui/skeleton'

export default function Loading() {
	return (
		<div role="status" aria-label="Loading page" className="p-6">
			<SkeletonText />
		</div>
	)
}
