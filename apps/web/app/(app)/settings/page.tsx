import type { Metadata } from 'next'

import { requireTeacherPage } from '@/lib/session'

import { SettingsScreen } from './_components/settings-screen'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
	await requireTeacherPage()
	const { tab } = await searchParams
	return <SettingsScreen tab={Array.isArray(tab) ? tab[0] : tab} />
}
