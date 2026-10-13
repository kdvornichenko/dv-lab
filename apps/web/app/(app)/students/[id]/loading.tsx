import { SkeletonFallback } from '@/components/app/skeleton-swap'

import { ProfileLoading } from './_components/profile-loading'

export default function Loading() {
	return (
		<SkeletonFallback>
			<ProfileLoading />
		</SkeletonFallback>
	)
}
