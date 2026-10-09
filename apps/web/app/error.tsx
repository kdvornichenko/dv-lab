'use client'

import { startTransition } from 'react'

import { useRouter } from 'next/navigation'

import { ErrorPage } from '@/components/app/status-pages'

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
	const router = useRouter()
	return (
		<ErrorPage
			onRefresh={() =>
				startTransition(() => {
					router.refresh()
					reset()
				})
			}
		/>
	)
}
