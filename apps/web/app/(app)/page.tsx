import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { getMe } from '@/lib/session'

export async function generateMetadata(): Promise<Metadata> {
	const me = await getMe()
	return me?.account.role === 'teacher' ? { title: 'Today' } : { title: { absolute: 'dv-lab' } }
}

export default async function TodayPage() {
	const me = await getMe()
	if (me?.account.role !== 'teacher') return null
	return (
		<PageScroll>
			<PageHeader title="Today" />
			<EmptyLine />
		</PageScroll>
	)
}
