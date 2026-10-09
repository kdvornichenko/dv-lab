import type { Metadata } from 'next'

import { EmptyLine } from '@/components/app/empty-line'
import { PageHeader, PageScroll } from '@/components/app/layout-parts'
import { requireTeacherPage } from '@/lib/session'

export const metadata: Metadata = { title: 'Schedule' }

export default async function SchedulePage() {
	await requireTeacherPage()
	return (
		<PageScroll>
			<PageHeader title="Schedule" />
			<EmptyLine />
		</PageScroll>
	)
}
