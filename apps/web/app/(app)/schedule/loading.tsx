import { SkeletonFallback } from '@/components/app/skeleton-swap'

import { ScheduleLoading } from './_components/schedule-loading'

export default function Loading() {
	return (
		<SkeletonFallback>
			<ScheduleLoading />
		</SkeletonFallback>
	)
}
