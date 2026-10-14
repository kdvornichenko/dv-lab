import type { Metadata } from 'next'

import { SkeletonContent } from '@/components/app/skeleton-swap'
import { requireTeacherPage } from '@/lib/session'

import { ScheduleScreen } from './_components/schedule-screen'

export const metadata: Metadata = { title: 'Schedule' }

type Param = string | string[] | undefined

function single(value: Param): string | null {
	return typeof value === 'string' ? value : null
}

export default async function SchedulePage({
	searchParams,
}: {
	searchParams: Promise<{ week?: Param; lesson?: Param; day?: Param }>
}) {
	await requireTeacherPage()
	const { week, lesson, day } = await searchParams
	return (
		<SkeletonContent>
			<ScheduleScreen arrival={{ week: single(week), lesson: single(lesson), day: single(day) }} />
		</SkeletonContent>
	)
}
