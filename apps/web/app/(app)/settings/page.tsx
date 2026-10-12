import type { Metadata } from 'next'

import { requireTeacherPage } from '@/lib/session'

import { SettingsScreen } from './_components/settings-screen'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
	await requireTeacherPage()
	return <SettingsScreen />
}
