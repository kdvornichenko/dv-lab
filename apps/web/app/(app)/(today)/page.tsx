import type { Metadata } from 'next'

import { SkeletonContent } from '@/components/app/skeleton-swap'
import { getMe } from '@/lib/session'

import { TodayScreen } from '../_components/today-screen'

export async function generateMetadata(): Promise<Metadata> {
	const me = await getMe()
	return me?.account.role === 'teacher' ? { title: 'Today' } : { title: { absolute: 'dv-lab' } }
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ dialog?: string | string[] }> }) {
	const me = await getMe()
	if (me?.account.role !== 'teacher') return null
	const { dialog } = await searchParams
	return (
		<SkeletonContent>
			<TodayScreen arrival={{ payment: dialog === 'payment' }} />
		</SkeletonContent>
	)
}
