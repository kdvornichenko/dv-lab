import type { Metadata } from 'next'

import { SkeletonContent } from '@/components/app/skeleton-swap'
import { requireTeacherPage } from '@/lib/session'

import { ScheduleScreen } from './_components/schedule-screen'

export const metadata: Metadata = { title: 'Schedule' }

export default async function SchedulePage() {
	await requireTeacherPage()
	return (
		<SkeletonContent>
			<ScheduleScreen />
		</SkeletonContent>
	)
}
