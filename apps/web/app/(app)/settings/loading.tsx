import { SkeletonFallback } from '@/components/app/skeleton-swap'

import { SettingsLoading } from './_components/settings-loading'

export default function Loading() {
	return (
		<SkeletonFallback>
			<SettingsLoading />
		</SkeletonFallback>
	)
}
