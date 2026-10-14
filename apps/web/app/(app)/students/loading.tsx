import { SkeletonFallback } from '@/components/app/skeleton-swap'

import { StudentsLoading } from './_components/students-loading'

export default function Loading() {
	return (
		<SkeletonFallback>
			<StudentsLoading />
		</SkeletonFallback>
	)
}
