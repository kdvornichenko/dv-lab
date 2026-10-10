import type { Metadata } from 'next'

import { requireTeacherPage } from '@/lib/session'

import { ScheduleScreen } from './_components/schedule-screen'

export const metadata: Metadata = { title: 'Schedule' }

export default async function SchedulePage() {
	await requireTeacherPage()
	return <ScheduleScreen />
}
