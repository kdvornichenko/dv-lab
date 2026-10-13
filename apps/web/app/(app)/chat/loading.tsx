import { SkeletonFallback } from '@/components/app/skeleton-swap'

import { ChatLoading } from './_components/chat-loading'

export default function Loading() {
	return (
		<SkeletonFallback>
			<ChatLoading />
		</SkeletonFallback>
	)
}
