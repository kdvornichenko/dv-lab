import type { Metadata } from 'next'

import { getMe } from '@/lib/session'

import { TodayScreen } from './_components/today-screen'

export async function generateMetadata(): Promise<Metadata> {
	const me = await getMe()
	return me?.account.role === 'teacher' ? { title: 'Today' } : { title: { absolute: 'dv-lab' } }
}

export default async function TodayPage() {
	const me = await getMe()
	if (me?.account.role !== 'teacher') return null
	return <TodayScreen />
}
