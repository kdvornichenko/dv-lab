import { SkeletonFallback } from '@/components/app/skeleton-swap'

import { TodayLoading } from '../_components/today-screen'

export default function Loading() {
	return (
		<SkeletonFallback>
			<TodayLoading />
		</SkeletonFallback>
	)
}
