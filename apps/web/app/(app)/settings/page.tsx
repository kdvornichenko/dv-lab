import type { Metadata } from 'next'

import { SkeletonContent } from '@/components/app/skeleton-swap'
import { requireTeacherPage } from '@/lib/session'

import { SettingsScreen } from './_components/settings-screen'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
	await requireTeacherPage()
	return (
		<SkeletonContent>
			<SettingsScreen />
		</SkeletonContent>
	)
}
